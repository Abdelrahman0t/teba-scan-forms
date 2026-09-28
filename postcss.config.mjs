const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    // Convert oklch()/oklab() colors to rgb() for older browsers
    // (Chrome < 111 on Windows 7 does not support oklch — Tailwind v4 uses it by default)
    "@csstools/postcss-oklab-function": { preserve: true },
  },
};

export default config;
