-- ============================================================================
-- TIBA SCAN - CLINICAL RECORDS INDEX (server-side search, filters & paging)
-- Run once in the Supabase SQL Editor. Fully idempotent (safe to re-run).
--
-- Provides:
--   * public.clinical_records            unified view over the 7 clinical tables,
--                                        incl. completion status (missing roles)
--   * public.list_clinical_records(...)  keyset-paginated records + full payload
--   * public.clinical_records_summary(...) exact counts per model / status
--   * public.list_patients_with_activity(...) keyset-paginated patients + activity
--
-- NOTE: the completion rules below mirror lib/formStatus.ts — keep them in sync.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Indexes for ordering / paging / joins
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_rad_created_id        ON public.radiation_exposure_logs (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_edu_created_id        ON public.health_education_assessments (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_fall_screen_created_id ON public.fall_risk_screenings (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_fall_adult_created_id ON public.fall_risk_adult_assessments (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_fall_ped_created_id   ON public.fall_risk_pediatric_assessments (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_assessment_created_id ON public.patient_assessments (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_transfer_created_id   ON public.patient_transfers (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_edu_patient           ON public.health_education_assessments (patient_id);
CREATE INDEX IF NOT EXISTS idx_edu_topics_assessment ON public.health_education_topic_entries (assessment_id);

-- ----------------------------------------------------------------------------
-- 2. Helper functions
-- ----------------------------------------------------------------------------

-- Mirrors JS: Boolean(v && v.trim() && v !== "-")
CREATE OR REPLACE FUNCTION public.cr_nonblank(v text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT v IS NOT NULL AND btrim(v, E' \t\r\n') <> '' AND v <> '-'
$$;

-- Lower-case + Eastern Arabic / Persian digits -> Western digits
CREATE OR REPLACE FUNCTION public.cr_normalize_digits(v text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT translate(lower(coalesce(v, '')), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789')
$$;

CREATE OR REPLACE FUNCTION public.cr_like_escape(v text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT replace(replace(replace(coalesce(v, ''), '\', '\\'), '%', '\%'), '_', '\_')
$$;

-- Name / MRN (any digit script) / procedure text search
CREATE OR REPLACE FUNCTION public.cr_matches_search(p_name text, p_mrn text, p_detail text, p_query text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p_query IS NULL
      OR btrim(p_query) = ''
      OR lower(coalesce(p_name, '')) LIKE '%' || public.cr_like_escape(lower(btrim(p_query))) || '%'
      OR public.cr_normalize_digits(p_mrn) LIKE '%' || public.cr_like_escape(public.cr_normalize_digits(btrim(p_query))) || '%'
      OR lower(coalesce(p_detail, '')) LIKE '%' || public.cr_like_escape(lower(btrim(p_query))) || '%'
$$;

-- Procedure classification (Echo / U/S / Doppler -> radiologist, X-Ray / MRI / CT -> technician)
CREATE OR REPLACE FUNCTION public.cr_proc_needs_radio(p text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(coalesce(p, '')) ~ '(echo|u/s|doppler|سونار|ايكو|دوبلر)'
$$;

CREATE OR REPLACE FUNCTION public.cr_proc_needs_tech(p text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(coalesce(p, '')) ~ '(x-ray|xray|mri|ct|رنين|مقطعية|اشعة عادية)'
$$;

-- "Other" procedure, or both / neither category -> both radiologist and technician involved
CREATE OR REPLACE FUNCTION public.cr_proc_both_or_other(p text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(coalesce(p, '')) ~ '(أخرى|اخرى)'
      OR public.cr_proc_needs_radio(p) = public.cr_proc_needs_tech(p)
$$;

-- JS: value?.includes(needle) for a JSON array (exact element) or string (substring)
CREATE OR REPLACE FUNCTION public.cr_json_includes(j jsonb, needle text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE jsonb_typeof(j)
    WHEN 'array'  THEN j @> jsonb_build_array(needle)
    WHEN 'string' THEN (j #>> '{}') LIKE '%' || public.cr_like_escape(needle) || '%'
    ELSE false
  END
$$;

-- JS: array?.some((x) => x?.includes(needle))
CREATE OR REPLACE FUNCTION public.cr_json_any_contains(j jsonb, needle text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN jsonb_typeof(j) = 'array' THEN EXISTS (
    SELECT 1 FROM jsonb_array_elements(j) AS x(v)
    WHERE jsonb_typeof(x.v) = 'string'
      AND (x.v #>> '{}') LIKE '%' || public.cr_like_escape(needle) || '%'
  ) ELSE false END
$$;

-- Comprehensive Patient Assessment: missing roles (see getFormStatusInfo "assessment")
CREATE OR REPLACE FUNCTION public.cr_assessment_missing_roles(
  p_proc text, p_nurse_sig text, p_physician_sig text, p_plans jsonb
)
RETURNS text[] LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  plans jsonb := CASE WHEN jsonb_typeof(p_plans) = 'array' THEN p_plans ELSE '[]'::jsonb END;
  fall_plan jsonb;
  doc_plan jsonb;
  tech_plan jsonb;
  has_nurse boolean;
  has_phys boolean;
  has_tech boolean;
  both_or_other boolean := public.cr_proc_both_or_other(p_proc);
  missing text[] := '{}';
BEGIN
  SELECT t.e INTO fall_plan
  FROM jsonb_array_elements(plans) WITH ORDINALITY AS t(e, i)
  WHERE public.cr_json_includes(t.e -> 'responsible', 'التمريض')
     OR public.cr_json_includes(t.e -> 'problem', 'السقوط')
  ORDER BY t.i LIMIT 1;

  SELECT t.e INTO doc_plan
  FROM jsonb_array_elements(plans) WITH ORDINALITY AS t(e, i)
  WHERE public.cr_json_includes(t.e -> 'responsible', 'أخصائي الأشعة')
     OR public.cr_json_includes(t.e -> 'responsible', 'طبيب الأشعة')
     OR public.cr_json_any_contains(t.e -> 'interventions', 'فوائد ومخاطر')
     OR (public.cr_json_includes(t.e -> 'problem', 'التصوير')
         AND NOT public.cr_json_includes(t.e -> 'problem', 'السلامة والجرعة'))
  ORDER BY t.i LIMIT 1;

  SELECT t.e INTO tech_plan
  FROM jsonb_array_elements(plans) WITH ORDINALITY AS t(e, i)
  WHERE NOT public.cr_json_any_contains(t.e -> 'responsible', 'طبيب')
    AND NOT public.cr_json_any_contains(t.e -> 'responsible', 'أخصائي')
    AND (
      public.cr_json_includes(t.e -> 'responsible', 'فني الأشعة')
      OR public.cr_json_includes(t.e -> 'problem', 'السلامة والجرعة')
      OR public.cr_json_any_contains(t.e -> 'interventions', 'جرعة الإشعاع')
      OR public.cr_json_any_contains(t.e -> 'interventions', 'دليل الاجراءات')
    )
  ORDER BY t.i LIMIT 1;

  has_nurse := public.cr_nonblank(p_nurse_sig) OR public.cr_nonblank(fall_plan ->> 'confirmed_by');
  has_phys  := public.cr_nonblank(p_physician_sig) OR public.cr_nonblank(doc_plan ->> 'confirmed_by');
  has_tech  := public.cr_nonblank(tech_plan ->> 'confirmed_by');

  IF NOT has_nurse THEN
    missing := missing || 'nurse'::text;
  END IF;
  IF NOT has_phys AND (both_or_other OR public.cr_proc_needs_radio(p_proc)) THEN
    missing := missing || 'radiologist'::text;
  END IF;
  IF NOT has_tech AND (both_or_other OR public.cr_proc_needs_tech(p_proc)) THEN
    missing := missing || 'technician'::text;
  END IF;
  RETURN missing;
END;
$$;

-- Health Education: missing roles (see getFormStatusInfo "education")
CREATE OR REPLACE FUNCTION public.cr_education_missing_roles(p_assessment_id uuid, p_proc text)
RETURNS text[] LANGUAGE sql STABLE AS $$
  WITH entries AS (
    SELECT te.topic_name
    FROM public.health_education_topic_entries te
    WHERE te.assessment_id = p_assessment_id
      AND te.is_comprehended IS NOT NULL
      AND btrim(coalesce(te.educator_name, ''), E' \t\r\n') <> ''
  ),
  flags AS (
    SELECT
      (SELECT bool_and(EXISTS (SELECT 1 FROM entries e WHERE e.topic_name LIKE '%' || x.prefix || '%'))
         FROM unnest(ARRAY['تحضير', 'التنبيه علي السيدة', 'السقوط']) AS x(prefix)) AS has_nurse,
      (SELECT bool_and(EXISTS (SELECT 1 FROM entries e WHERE e.topic_name LIKE '%' || x.prefix || '%'))
         FROM unnest(ARRAY['المخاطر المحتملة', 'بالصبغة', 'تعليمات ما بعد الإجراء']) AS x(prefix)) AS has_second,
      public.cr_proc_needs_radio(p_proc) AS radio,
      public.cr_proc_both_or_other(p_proc) AS both_or_other
  )
  SELECT array_remove(ARRAY[
    CASE WHEN NOT f.has_nurse THEN 'nurse' END,
    CASE WHEN NOT f.has_second AND (f.both_or_other OR NOT f.radio) THEN 'technician' END,
    CASE WHEN NOT f.has_second AND (f.both_or_other OR f.radio) THEN 'radiologist' END
  ], NULL)
  FROM flags f
$$;

-- Status filter: all | complete | incomplete | pending_my_role ('admin' role = any role)
CREATE OR REPLACE FUNCTION public.cr_status_matches(p_missing text[], p_status text, p_role text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE coalesce(p_status, 'all')
    WHEN 'complete'        THEN cardinality(p_missing) = 0
    WHEN 'incomplete'      THEN cardinality(p_missing) > 0
    WHEN 'pending_my_role' THEN cardinality(p_missing) > 0 AND (p_role = 'admin' OR p_role = ANY (p_missing))
    ELSE true
  END
$$;

-- ----------------------------------------------------------------------------
-- 2b. Stored completion status (missing_roles), maintained by triggers.
--     Reads never recompute status, so status filters / counts stay instant.
-- ----------------------------------------------------------------------------
ALTER TABLE public.patient_assessments          ADD COLUMN IF NOT EXISTS missing_roles text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.patient_transfers            ADD COLUMN IF NOT EXISTS missing_roles text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.health_education_assessments ADD COLUMN IF NOT EXISTS missing_roles text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.cr_transfer_missing_roles(p_physician_sig text, p_nurse_sig text)
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT array_remove(ARRAY[
    CASE WHEN NOT public.cr_nonblank(p_physician_sig) THEN 'radiologist' END,
    CASE WHEN NOT public.cr_nonblank(p_nurse_sig) THEN 'nurse' END
  ], NULL)
$$;

-- Patient assessment: recompute on every insert / update
CREATE OR REPLACE FUNCTION public.cr_trg_assessment_status()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.missing_roles := public.cr_assessment_missing_roles(NEW.procedure_name, NEW.nurse_signature, NEW.physician_signature, NEW.plan_of_care);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_assessment_status ON public.patient_assessments;
CREATE TRIGGER trg_assessment_status BEFORE INSERT OR UPDATE ON public.patient_assessments
  FOR EACH ROW EXECUTE FUNCTION public.cr_trg_assessment_status();

-- Patient transfer: recompute on every insert / update
CREATE OR REPLACE FUNCTION public.cr_trg_transfer_status()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.missing_roles := public.cr_transfer_missing_roles(NEW.receiving_physician_signature, NEW.receiving_nurse_signature);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_transfer_status ON public.patient_transfers;
CREATE TRIGGER trg_transfer_status BEFORE INSERT OR UPDATE ON public.patient_transfers
  FOR EACH ROW EXECUTE FUNCTION public.cr_trg_transfer_status();

-- Health education: status depends on the assessment's procedure + its topic entries
CREATE OR REPLACE FUNCTION public.cr_trg_education_status()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.missing_roles := public.cr_education_missing_roles(NEW.id, NEW.procedure_name);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_education_status ON public.health_education_assessments;
CREATE TRIGGER trg_education_status BEFORE INSERT OR UPDATE OF procedure_name ON public.health_education_assessments
  FOR EACH ROW EXECUTE FUNCTION public.cr_trg_education_status();

CREATE OR REPLACE FUNCTION public.cr_trg_education_topic_status()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    UPDATE public.health_education_assessments e
       SET missing_roles = public.cr_education_missing_roles(e.id, e.procedure_name)
     WHERE e.id = NEW.assessment_id;
  END IF;
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.assessment_id IS DISTINCT FROM NEW.assessment_id) THEN
    UPDATE public.health_education_assessments e
       SET missing_roles = public.cr_education_missing_roles(e.id, e.procedure_name)
     WHERE e.id = OLD.assessment_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_education_topic_status ON public.health_education_topic_entries;
CREATE TRIGGER trg_education_topic_status AFTER INSERT OR UPDATE OR DELETE ON public.health_education_topic_entries
  FOR EACH ROW EXECUTE FUNCTION public.cr_trg_education_topic_status();

-- Backfill existing rows (only rows whose stored value is out of date are written)
UPDATE public.patient_assessments a
   SET missing_roles = public.cr_assessment_missing_roles(a.procedure_name, a.nurse_signature, a.physician_signature, a.plan_of_care)
 WHERE a.missing_roles IS DISTINCT FROM public.cr_assessment_missing_roles(a.procedure_name, a.nurse_signature, a.physician_signature, a.plan_of_care);
UPDATE public.patient_transfers t
   SET missing_roles = public.cr_transfer_missing_roles(t.receiving_physician_signature, t.receiving_nurse_signature)
 WHERE t.missing_roles IS DISTINCT FROM public.cr_transfer_missing_roles(t.receiving_physician_signature, t.receiving_nurse_signature);
UPDATE public.health_education_assessments e
   SET missing_roles = public.cr_education_missing_roles(e.id, e.procedure_name)
 WHERE e.missing_roles IS DISTINCT FROM public.cr_education_missing_roles(e.id, e.procedure_name);

-- Partial indexes so complete / incomplete list filters use created_at ordering per table
-- (predicate must match list_clinical_records status checks: = '{}' vs <> '{}')
CREATE INDEX IF NOT EXISTS idx_assessment_incomplete_created_id
  ON public.patient_assessments (created_at DESC, id DESC) WHERE missing_roles <> '{}'::text[];
CREATE INDEX IF NOT EXISTS idx_assessment_complete_created_id
  ON public.patient_assessments (created_at DESC, id DESC) WHERE missing_roles = '{}'::text[];
CREATE INDEX IF NOT EXISTS idx_transfer_incomplete_created_id
  ON public.patient_transfers (created_at DESC, id DESC) WHERE missing_roles <> '{}'::text[];
CREATE INDEX IF NOT EXISTS idx_transfer_complete_created_id
  ON public.patient_transfers (created_at DESC, id DESC) WHERE missing_roles = '{}'::text[];
CREATE INDEX IF NOT EXISTS idx_edu_incomplete_created_id
  ON public.health_education_assessments (created_at DESC, id DESC) WHERE missing_roles <> '{}'::text[];
CREATE INDEX IF NOT EXISTS idx_edu_complete_created_id
  ON public.health_education_assessments (created_at DESC, id DESC) WHERE missing_roles = '{}'::text[];
CREATE INDEX IF NOT EXISTS idx_assessment_missing_roles_gin
  ON public.patient_assessments USING GIN (missing_roles);
CREATE INDEX IF NOT EXISTS idx_transfer_missing_roles_gin
  ON public.patient_transfers USING GIN (missing_roles);
CREATE INDEX IF NOT EXISTS idx_edu_missing_roles_gin
  ON public.health_education_assessments USING GIN (missing_roles);

-- ----------------------------------------------------------------------------
-- 3. Unified view over the 7 clinical models
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.clinical_records WITH (security_invoker = true) AS
  SELECT 'radiation'::text AS form_type, r.id, r.patient_id, r.created_at,
         nullif(r.procedure_name, '') AS detail,
         '{}'::text[] AS missing_roles
  FROM public.radiation_exposure_logs r
UNION ALL
  SELECT 'education'::text, e.id, e.patient_id, e.created_at,
         nullif(e.procedure_name, ''),
         e.missing_roles
  FROM public.health_education_assessments e
UNION ALL
  SELECT 'fall_screen'::text, fs.id, fs.patient_id, fs.created_at, NULL::text, '{}'::text[]
  FROM public.fall_risk_screenings fs
UNION ALL
  SELECT 'fall_adult'::text, fa.id, fa.patient_id, fa.created_at, NULL::text, '{}'::text[]
  FROM public.fall_risk_adult_assessments fa
UNION ALL
  SELECT 'fall_ped'::text, fp.id, fp.patient_id, fp.created_at, NULL::text, '{}'::text[]
  FROM public.fall_risk_pediatric_assessments fp
UNION ALL
  SELECT 'assessment'::text, a.id, a.patient_id, a.created_at,
         coalesce(nullif(a.procedure_name, ''), nullif(a.diagnosis, '')),
         a.missing_roles
  FROM public.patient_assessments a
UNION ALL
  SELECT 'transfer'::text, t.id, t.patient_id, t.created_at,
         nullif(t.from_location, ''),
         t.missing_roles
  FROM public.patient_transfers t;

-- Full row payload for one record (same shape the app used to get from select("*"))
CREATE OR REPLACE FUNCTION public.cr_record_payload(p_form_type text, p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  result jsonb;
BEGIN
  CASE p_form_type
    WHEN 'radiation' THEN
      SELECT to_jsonb(r) INTO result FROM public.radiation_exposure_logs r WHERE r.id = p_id;
    WHEN 'education' THEN
      SELECT to_jsonb(e) || jsonb_build_object(
        'form_submissions', (SELECT jsonb_build_object('data', fs.data) FROM public.form_submissions fs WHERE fs.id = e.submission_id),
        'health_education_topic_entries', coalesce((
          SELECT jsonb_agg(to_jsonb(te) ORDER BY te.created_at, te.id)
          FROM public.health_education_topic_entries te WHERE te.assessment_id = e.id
        ), '[]'::jsonb)
      ) INTO result
      FROM public.health_education_assessments e WHERE e.id = p_id;
    WHEN 'fall_screen' THEN
      SELECT to_jsonb(x) INTO result FROM public.fall_risk_screenings x WHERE x.id = p_id;
    WHEN 'fall_adult' THEN
      SELECT to_jsonb(x) INTO result FROM public.fall_risk_adult_assessments x WHERE x.id = p_id;
    WHEN 'fall_ped' THEN
      SELECT to_jsonb(x) INTO result FROM public.fall_risk_pediatric_assessments x WHERE x.id = p_id;
    WHEN 'assessment' THEN
      SELECT to_jsonb(x) INTO result FROM public.patient_assessments x WHERE x.id = p_id;
    WHEN 'transfer' THEN
      SELECT to_jsonb(x) INTO result FROM public.patient_transfers x WHERE x.id = p_id;
    ELSE
      result := NULL;
  END CASE;
  RETURN result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. RPC: keyset-paginated clinical records (newest first)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_clinical_records(
  p_form_type text DEFAULT NULL,          -- NULL / 'all' = every model
  p_status text DEFAULT 'all',            -- all | complete | incomplete | pending_my_role
  p_role text DEFAULT NULL,               -- current user role, 'admin' = every role
  p_search text DEFAULT NULL,             -- patient name / MRN / procedure
  p_from timestamptz DEFAULT NULL,        -- created_at >= p_from
  p_patient_id uuid DEFAULT NULL,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_limit int DEFAULT 200
)
RETURNS TABLE (
  form_type text,
  id uuid,
  created_at timestamptz,
  missing_roles text[],
  record jsonb,
  patient jsonb
)
LANGUAGE sql STABLE AS $$
  WITH page AS (
    SELECT c.form_type, c.id, c.created_at, c.missing_roles, c.patient_id
    FROM public.clinical_records c
    LEFT JOIN public.patients p ON p.id = c.patient_id
    WHERE (p_form_type IS NULL OR p_form_type = 'all' OR c.form_type = p_form_type)
      AND (p_from IS NULL OR c.created_at >= p_from)
      AND (p_patient_id IS NULL OR c.patient_id = p_patient_id)
      AND (p_cursor_created_at IS NULL OR (c.created_at, c.id) < (p_cursor_created_at, p_cursor_id))
      AND public.cr_matches_search(p.full_name, p.mrn, c.detail, p_search)
      -- Sargable status predicates (enables partial indexes on missing_roles); keep in sync with cr_status_matches
      AND (
        coalesce(p_status, 'all') = 'all'
        OR (p_status = 'complete' AND c.missing_roles = '{}'::text[])
        OR (p_status = 'incomplete' AND c.missing_roles <> '{}'::text[])
        OR (
          p_status = 'pending_my_role'
          AND c.missing_roles <> '{}'::text[]
          AND (p_role = 'admin' OR p_role = ANY (c.missing_roles))
        )
      )
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT least(greatest(coalesce(p_limit, 200), 1), 5000)
  )
  SELECT pg.form_type,
         pg.id,
         pg.created_at,
         pg.missing_roles,
         public.cr_record_payload(pg.form_type, pg.id),
         (SELECT jsonb_build_object('id', p.id, 'full_name', p.full_name, 'mrn', p.mrn, 'age', p.age, 'gender', p.gender)
            FROM public.patients p WHERE p.id = pg.patient_id)
  FROM page pg
  ORDER BY pg.created_at DESC, pg.id DESC
$$;

-- ----------------------------------------------------------------------------
-- 5. RPC: exact counts per model, split by status (same filters as the list)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clinical_records_summary(
  p_role text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_patient_id uuid DEFAULT NULL
)
RETURNS TABLE (
  form_type text,
  total bigint,
  complete bigint,
  incomplete bigint,
  pending_my_role bigint
)
LANGUAGE sql STABLE AS $$
  SELECT c.form_type,
         count(*),
         count(*) FILTER (WHERE c.missing_roles = '{}'::text[]),
         count(*) FILTER (WHERE c.missing_roles <> '{}'::text[]),
         count(*) FILTER (
           WHERE c.missing_roles <> '{}'::text[]
             AND (p_role = 'admin' OR p_role = ANY (c.missing_roles))
         )
  FROM public.clinical_records c
  LEFT JOIN public.patients p ON p.id = c.patient_id
  WHERE (p_from IS NULL OR c.created_at >= p_from)
    AND (p_patient_id IS NULL OR c.patient_id = p_patient_id)
    AND public.cr_matches_search(p.full_name, p.mrn, c.detail, p_search)
  GROUP BY c.form_type
$$;

-- ----------------------------------------------------------------------------
-- 6. RPC: keyset-paginated patients ordered by latest clinical activity
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_patients_with_activity(
  p_search text DEFAULT NULL,
  p_cursor_sort_at timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_limit int DEFAULT 200
)
RETURNS TABLE (
  id uuid,
  mrn text,
  full_name text,
  gender text,
  age int,
  phone text,
  created_at timestamptz,
  submissions_count bigint,
  latest_activity timestamptz,
  sort_at timestamptz,
  total_count bigint
)
LANGUAGE sql STABLE AS $$
  WITH activity AS (
    SELECT u.patient_id, count(*) AS n, max(u.created_at) AS latest
    FROM (
      SELECT patient_id, created_at FROM public.radiation_exposure_logs
      UNION ALL SELECT patient_id, created_at FROM public.health_education_assessments
      UNION ALL SELECT patient_id, created_at FROM public.fall_risk_screenings
      UNION ALL SELECT patient_id, created_at FROM public.fall_risk_adult_assessments
      UNION ALL SELECT patient_id, created_at FROM public.fall_risk_pediatric_assessments
      UNION ALL SELECT patient_id, created_at FROM public.patient_assessments
      UNION ALL SELECT patient_id, created_at FROM public.patient_transfers
    ) u
    GROUP BY u.patient_id
  ),
  base AS (
    SELECT p.id, p.mrn::text AS mrn, p.full_name, p.gender::text AS gender, p.age, p.phone::text AS phone,
           p.created_at,
           coalesce(a.n, 0) AS submissions_count,
           a.latest AS latest_activity,
           coalesce(a.latest, p.created_at, 'epoch'::timestamptz) AS sort_at
    FROM public.patients p
    LEFT JOIN activity a ON a.patient_id = p.id
    WHERE public.cr_matches_search(p.full_name, p.mrn, NULL, p_search)
  ),
  counted AS (
    SELECT b.*, count(*) OVER () AS total_count FROM base b
  )
  SELECT c.id, c.mrn, c.full_name, c.gender, c.age, c.phone, c.created_at,
         c.submissions_count, c.latest_activity, c.sort_at, c.total_count
  FROM counted c
  WHERE p_cursor_sort_at IS NULL OR (c.sort_at, c.id) < (p_cursor_sort_at, p_cursor_id)
  ORDER BY c.sort_at DESC, c.id DESC
  LIMIT least(greatest(coalesce(p_limit, 200), 1), 5000)
$$;

-- ----------------------------------------------------------------------------
-- 7. Permissions + refresh PostgREST schema cache
-- ----------------------------------------------------------------------------
GRANT SELECT ON public.clinical_records TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_clinical_records(text, text, text, text, timestamptz, uuid, timestamptz, uuid, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clinical_records_summary(text, text, timestamptz, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_patients_with_activity(text, timestamptz, uuid, int) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
