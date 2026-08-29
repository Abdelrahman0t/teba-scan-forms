-- ============================================================================
-- TIBA SCAN RADIOLOGY CENTER - COMPLETE DATABASE SCHEMA FOR SUPABASE
-- Fully Idempotent Migration Script (Works on New & Existing Databases)
-- ============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Centralized Patients Registry Table
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mrn VARCHAR(50) UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all patient columns exist if table was created previously
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS age INT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS phone VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_patients_mrn ON public.patients(mrn);
CREATE INDEX IF NOT EXISTS idx_patients_name_trgm ON public.patients USING gin (full_name gin_trgm_ops);

-- 3. Form Templates Registry
CREATE TABLE IF NOT EXISTS public.form_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    title_ar TEXT NOT NULL,
    title_en TEXT NOT NULL,
    version INT DEFAULT 1,
    schema_json JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure header_code column exists if table was created previously
ALTER TABLE public.form_templates ADD COLUMN IF NOT EXISTS header_code VARCHAR(30) DEFAULT 'TRC.MRS';

-- 4. Unified Form Submissions Table
CREATE TABLE IF NOT EXISTS public.form_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES public.form_templates(id),
    data JSONB NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure form_code column exists if table was created previously
ALTER TABLE public.form_submissions ADD COLUMN IF NOT EXISTS form_code VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_submissions_data ON public.form_submissions USING gin (data);
CREATE INDEX IF NOT EXISTS idx_submissions_patient ON public.form_submissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_submissions_template ON public.form_submissions(template_id);
CREATE INDEX IF NOT EXISTS idx_submissions_form_code ON public.form_submissions(form_code);

-- ----------------------------------------------------------------------------
-- 5. SPECIALIZED NORMALIZED TABLES FOR ALL 7 FORMS
-- ----------------------------------------------------------------------------

-- FORM 1: Radiation Exposure Logs (TRC_MRS_DOSE)
CREATE TABLE IF NOT EXISTS public.radiation_exposure_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID REFERENCES public.form_submissions(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    exposure_date DATE NOT NULL DEFAULT CURRENT_DATE,
    exposure_time TIME NOT NULL DEFAULT CURRENT_TIME,
    height_cm NUMERIC(5,2),
    weight_kg NUMERIC(5,2),
    age INT,
    procedure_name TEXT NOT NULL,
    procedure_location TEXT,
    radiation_dose NUMERIC(10,3) NOT NULL,
    cumulative_dose NUMERIC(10,3) NOT NULL,
    tech_signature TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rad_patient ON public.radiation_exposure_logs(patient_id);

-- FORM 2: Health Education Assessments & Topics (TRC_MRS_EDU)
CREATE TABLE IF NOT EXISTS public.health_education_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID REFERENCES public.form_submissions(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    procedure_name TEXT,
    procedure_location TEXT,
    education_level VARCHAR(50),
    learning_receptivity VARCHAR(50),
    barriers TEXT[],
    target_recipient VARCHAR(50),
    education_method TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.health_education_topic_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID REFERENCES public.health_education_assessments(id) ON DELETE CASCADE,
    topic_name TEXT NOT NULL,
    educator_name TEXT NOT NULL,
    is_comprehended BOOLEAN NOT NULL DEFAULT TRUE,
    reeducation_required BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FORM 3: Fall Risk Screening (TRC_MRS_FALL_SCREEN - المسح المبدئي لخطر السقوط)
CREATE TABLE IF NOT EXISTS public.fall_risk_screenings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID REFERENCES public.form_submissions(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    gender VARCHAR(20),
    age INT,
    gait_disturbance BOOLEAN DEFAULT FALSE,
    use_mobility_aids BOOLEAN DEFAULT FALSE,
    bed_ridden BOOLEAN DEFAULT FALSE,
    mental_disability BOOLEAN DEFAULT FALSE,
    sensory_impairment BOOLEAN DEFAULT FALSE,
    child_under_15 BOOLEAN DEFAULT FALSE,
    is_high_risk BOOLEAN DEFAULT FALSE,
    f_badge_applied BOOLEAN DEFAULT FALSE,
    wheelchair_used BOOLEAN DEFAULT FALSE,
    education_provided BOOLEAN DEFAULT FALSE,
    screener_signature TEXT NOT NULL,
    screening_date DATE NOT NULL DEFAULT CURRENT_DATE,
    screening_time TIME NOT NULL DEFAULT CURRENT_TIME,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fall_screen_patient ON public.fall_risk_screenings(patient_id);

-- FORM 4: Adult Fall Risk Assessment (TRC_ICD_FALL_ADULT - تقييم مخاطر السقوط للكبار Hendrich II)
CREATE TABLE IF NOT EXISTS public.fall_risk_adult_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID REFERENCES public.form_submissions(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    gender VARCHAR(20),
    age INT,
    assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    assessment_time TIME NOT NULL DEFAULT CURRENT_TIME,
    bed_ridden BOOLEAN DEFAULT FALSE,
    physical_disability BOOLEAN DEFAULT FALSE,
    mental_disability BOOLEAN DEFAULT FALSE,
    anesthesia_first_24h BOOLEAN DEFAULT FALSE,
    confusion_disorientation_score INT DEFAULT 0,
    symptomatic_depression_score INT DEFAULT 0,
    altered_elimination_score INT DEFAULT 0,
    dizziness_vertigo_score INT DEFAULT 0,
    male_gender_score INT DEFAULT 0,
    antiepileptics_sedatives_score INT DEFAULT 0,
    antidepressants_score INT DEFAULT 0,
    get_up_and_go_score INT DEFAULT 0,
    total_score INT NOT NULL DEFAULT 0,
    is_high_risk BOOLEAN NOT NULL DEFAULT FALSE,
    interventions JSONB DEFAULT '[]'::jsonb,
    assessor_signature TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fall_adult_patient ON public.fall_risk_adult_assessments(patient_id);

-- FORM 5: Pediatric Fall Risk Assessment (TRC_ICD_FALL_PEDIATRIC - مقياس سقوط الأطفال Humpty Dumpty)
CREATE TABLE IF NOT EXISTS public.fall_risk_pediatric_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID REFERENCES public.form_submissions(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    gender VARCHAR(20),
    age INT,
    assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    assessment_time TIME NOT NULL DEFAULT CURRENT_TIME,
    bed_ridden BOOLEAN DEFAULT FALSE,
    critical_unit BOOLEAN DEFAULT FALSE,
    anesthesia_48h BOOLEAN DEFAULT FALSE,
    mental_disability BOOLEAN DEFAULT FALSE,
    neonate BOOLEAN DEFAULT FALSE,
    physical_disability BOOLEAN DEFAULT FALSE,
    age_score INT NOT NULL DEFAULT 1,
    gender_score INT NOT NULL DEFAULT 1,
    diagnosis_score INT NOT NULL DEFAULT 1,
    environmental_score INT NOT NULL DEFAULT 1,
    medications_score INT NOT NULL DEFAULT 1,
    cognitive_score INT NOT NULL DEFAULT 1,
    surgery_anesthesia_score INT NOT NULL DEFAULT 1,
    total_score INT NOT NULL DEFAULT 7,
    risk_level VARCHAR(20) NOT NULL DEFAULT 'متوسط المخاطر',
    nurse_signature TEXT NOT NULL,
    precautions_applied JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fall_ped_patient ON public.fall_risk_pediatric_assessments(patient_id);

-- FORM 6: Comprehensive Patient Assessment (TRC_ICD_PATIENT_ASSESSMENT - نموذج تقييم المريض)
CREATE TABLE IF NOT EXISTS public.patient_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID REFERENCES public.form_submissions(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    visit_time TIME NOT NULL DEFAULT CURRENT_TIME,
    attending_physician TEXT,
    physician_phone TEXT,
    weight_kg NUMERIC(5,2),
    height_cm NUMERIC(5,2),
    blood_pressure VARCHAR(20),
    temperature NUMERIC(4,1),
    heart_rate INT,
    respiratory_rate INT,
    oxygen_saturation NUMERIC(4,1),
    diagnosis TEXT,
    procedure_name TEXT,
    medical_surgical_history TEXT,
    allergy_types TEXT[],
    allergy_details TEXT,
    is_smoker BOOLEAN DEFAULT FALSE,
    mobility_status VARCHAR(50),
    lmp_date DATE,
    menopause BOOLEAN DEFAULT FALSE,
    delayed_period BOOLEAN DEFAULT FALSE,
    contraceptive_use BOOLEAN DEFAULT FALSE,
    planning_pregnancy BOOLEAN DEFAULT FALSE,
    pregnant_or_suspected BOOLEAN DEFAULT FALSE,
    lactating BOOLEAN DEFAULT FALSE,
    kidney_disease BOOLEAN DEFAULT FALSE,
    kidney_disease_details TEXT,
    heart_disease BOOLEAN DEFAULT FALSE,
    heart_disease_details TEXT,
    anticoagulants BOOLEAN DEFAULT FALSE,
    anticoagulants_details TEXT,
    pacemaker BOOLEAN DEFAULT FALSE,
    aneurysm_clip BOOLEAN DEFAULT FALSE,
    immunocompromised BOOLEAN DEFAULT FALSE,
    psychological_status VARCHAR(50),
    mental_status VARCHAR(50),
    abuse_neglect_signs BOOLEAN DEFAULT FALSE,
    abuse_neglect_details TEXT,
    lab_gfr NUMERIC(6,2),
    lab_bun NUMERIC(6,2),
    lab_potassium NUMERIC(4,2),
    lab_sodium NUMERIC(5,2),
    lab_urea NUMERIC(6,2),
    lab_creatinine NUMERIC(5,2),
    plan_of_care JSONB DEFAULT '[]'::jsonb,
    connections JSONB DEFAULT '[]'::jsonb,
    medications JSONB DEFAULT '[]'::jsonb,
    nurse_signature TEXT,
    physician_signature TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assessment_patient ON public.patient_assessments(patient_id);
ALTER TABLE public.patient_assessments ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE public.patient_assessments ADD COLUMN IF NOT EXISTS age INT;

-- FORM 7: Patient Transfer Form (TRC_ACT_PATIENT_TRANSFER - نموذج نقل المريض)
CREATE TABLE IF NOT EXISTS public.patient_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID REFERENCES public.form_submissions(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
    transfer_time TIME NOT NULL DEFAULT CURRENT_TIME,
    transfer_period VARCHAR(10) DEFAULT 'AM',
    from_location TEXT NOT NULL,
    to_location TEXT NOT NULL,
    transfer_reason TEXT NOT NULL,
    hemodynamic_score INT DEFAULT 0,
    arrhythmias_score INT DEFAULT 0,
    ecg_monitoring_score INT DEFAULT 0,
    iv_line_score INT DEFAULT 0,
    pacemaker_score INT DEFAULT 0,
    respiration_score INT DEFAULT 0,
    airway_score INT DEFAULT 0,
    respiratory_support_score INT DEFAULT 0,
    neurological_score INT DEFAULT 0,
    prematurely_score INT DEFAULT 0,
    techno_pharmacological_score INT DEFAULT 0,
    total_rstp_score INT NOT NULL DEFAULT 0,
    group_code VARCHAR(10) NOT NULL DEFAULT '0',
    recommended_vehicle TEXT NOT NULL,
    recommended_staff TEXT NOT NULL,
    continuous_monitoring_applicable BOOLEAN DEFAULT FALSE,
    transfer_instructions TEXT,
    receiving_nurse_signature TEXT,
    receiving_physician_signature TEXT,
    receiving_time TIME,
    receiving_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transfer_patient ON public.patient_transfers(patient_id);
ALTER TABLE public.patient_transfers ADD COLUMN IF NOT EXISTS pacemaker_score INT DEFAULT 0;
ALTER TABLE public.patient_transfers ADD COLUMN IF NOT EXISTS provisional_pacemaker_score INT DEFAULT 0;

-- ----------------------------------------------------------------------------
-- 6. SEED / UPDATE ALL 7 FORM TEMPLATES
-- ----------------------------------------------------------------------------
INSERT INTO public.form_templates (code, header_code, title_ar, title_en, version, schema_json) VALUES
(
    'TRC_MRS_DOSE',
    'TRC.MRS',
    'نموذج تسجيل التعرض لجرعات الأشعة',
    'Radiation Exposure Registration Form',
    1,
    '{"code": "TRC_MRS_DOSE", "header": "TRC.MRS"}'::jsonb
),
(
    'TRC_MRS_EDU',
    'TRC.MRS',
    'نموذج التثقيف الصحي للمريض والأسرة',
    'Patient and Family Health Education Form',
    1,
    '{"code": "TRC_MRS_EDU", "header": "TRC.MRS"}'::jsonb
),
(
    'TRC_MRS_FALL_SCREEN',
    'TRC.MRS',
    'المسح (الفحص المبدئي) لخطر السقوط',
    'Fall Risk Screening Form',
    1,
    '{"code": "TRC_MRS_FALL_SCREEN", "header": "TRC.MRS"}'::jsonb
),
(
    'TRC_ICD_FALL_ADULT',
    'TRC-ICD',
    'تقييم مخاطر السقوط للكبار (Hendrich II)',
    'Hendrich II Fall Risk Assessment for Adults',
    1,
    '{"code": "TRC_ICD_FALL_ADULT", "header": "TRC-ICD"}'::jsonb
),
(
    'TRC_ICD_FALL_PEDIATRIC',
    'TRC.ICD',
    'مقياس مخاطر سقوط الأطفال (Humpty Dumpty)',
    'Humpty Dumpty Pediatric Fall Scale',
    1,
    '{"code": "TRC_ICD_FALL_PEDIATRIC", "header": "TRC.ICD"}'::jsonb
),
(
    'TRC_ICD_PATIENT_ASSESSMENT',
    'TRC-ICD',
    'نموذج تقييم المريض الشامل',
    'Comprehensive Patient Assessment Form',
    1,
    '{"code": "TRC_ICD_PATIENT_ASSESSMENT", "header": "TRC-ICD"}'::jsonb
),
(
    'TRC_ACT_PATIENT_TRANSFER',
    'TRC.ACT',
    'نموذج نقل المريض (RSTP)',
    'Patient Transfer Form (RSTP Score)',
    1,
    '{"code": "TRC_ACT_PATIENT_TRANSFER", "header": "TRC.ACT"}'::jsonb
)
ON CONFLICT (code) DO UPDATE SET
    header_code = EXCLUDED.header_code,
    title_ar = EXCLUDED.title_ar,
    title_en = EXCLUDED.title_en,
    schema_json = EXCLUDED.schema_json;

-- ----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radiation_exposure_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_education_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_education_topic_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fall_risk_screenings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fall_risk_adult_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fall_risk_pediatric_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_transfers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to prevent conflicts
DROP POLICY IF EXISTS "Allow public read on patients" ON public.patients;
DROP POLICY IF EXISTS "Allow public insert on patients" ON public.patients;
DROP POLICY IF EXISTS "Allow public update on patients" ON public.patients;
DROP POLICY IF EXISTS "Allow public delete on patients" ON public.patients;
DROP POLICY IF EXISTS "Allow public read on templates" ON public.form_templates;
DROP POLICY IF EXISTS "Allow public manage submissions" ON public.form_submissions;
DROP POLICY IF EXISTS "Allow public manage rad logs" ON public.radiation_exposure_logs;
DROP POLICY IF EXISTS "Allow public manage edu assessments" ON public.health_education_assessments;
DROP POLICY IF EXISTS "Allow public manage edu topics" ON public.health_education_topic_entries;
DROP POLICY IF EXISTS "Allow public manage fall screenings" ON public.fall_risk_screenings;
DROP POLICY IF EXISTS "Allow public manage fall adult" ON public.fall_risk_adult_assessments;
DROP POLICY IF EXISTS "Allow public manage fall ped" ON public.fall_risk_pediatric_assessments;
DROP POLICY IF EXISTS "Allow public manage patient assessments" ON public.patient_assessments;
DROP POLICY IF EXISTS "Allow public manage patient transfers" ON public.patient_transfers;

-- Create Permissive Policies
CREATE POLICY "Allow public read on patients" ON public.patients FOR SELECT USING (true);
CREATE POLICY "Allow public insert on patients" ON public.patients FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on patients" ON public.patients FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on patients" ON public.patients FOR DELETE USING (true);

CREATE POLICY "Allow public read on templates" ON public.form_templates FOR SELECT USING (true);
CREATE POLICY "Allow public manage submissions" ON public.form_submissions FOR ALL USING (true);
CREATE POLICY "Allow public manage rad logs" ON public.radiation_exposure_logs FOR ALL USING (true);
CREATE POLICY "Allow public manage edu assessments" ON public.health_education_assessments FOR ALL USING (true);
CREATE POLICY "Allow public manage edu topics" ON public.health_education_topic_entries FOR ALL USING (true);
CREATE POLICY "Allow public manage fall screenings" ON public.fall_risk_screenings FOR ALL USING (true);
CREATE POLICY "Allow public manage fall adult" ON public.fall_risk_adult_assessments FOR ALL USING (true);
CREATE POLICY "Allow public manage fall ped" ON public.fall_risk_pediatric_assessments FOR ALL USING (true);
CREATE POLICY "Allow public manage patient assessments" ON public.patient_assessments FOR ALL USING (true);
CREATE POLICY "Allow public manage patient transfers" ON public.patient_transfers FOR ALL USING (true);

-- ----------------------------------------------------------------------------
-- 8. AUTOMATIC TIMESTAMP TRIGGERS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_patients_timestamp ON public.patients;
CREATE TRIGGER update_patients_timestamp BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_submissions_timestamp ON public.form_submissions;
CREATE TRIGGER update_submissions_timestamp BEFORE UPDATE ON public.form_submissions FOR EACH ROW EXECUTE FUNCTION update_timestamp();
