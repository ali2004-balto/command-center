// ESLint flat config (Next.js rules, plus ignores for generated output).
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: ['.next/**', 'node_modules/**', 'bridge/dist/**', 'bridge/dist-send/**', 'next-env.d.ts', 'bridge/**/*.js', 'bridge/build.mjs', 'automations/*.mjs'] },
  { rules: { '@typescript-eslint/no-explicit-any': 'off' } },
];

export default config;
