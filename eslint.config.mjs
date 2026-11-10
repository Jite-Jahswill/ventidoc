import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import { baseConfig } from './packages/config/eslint/base.mjs';

export default [
  {
    ignores: [
      '**/.next/**',
      '**/.turbo/**',
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },
  ...baseConfig,
  ...nextCoreWebVitals.map((config) =>
    'ignores' in config && Object.keys(config).length === 1
      ? config
      : { ...config, files: ['apps/web/**/*.{js,jsx,mjs,ts,tsx,mts,cts}'] },
  ),
  {
    files: ['apps/web/**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@ventidoc/db/system',
              message:
                'apps/web must never import @ventidoc/db/system: withSystem() runs as the ' +
                'ventidoc_owner role and bypasses Row-Level Security entirely. Use withTenant() ' +
                'from @ventidoc/db instead.',
            },
          ],
        },
      ],
    },
  },
];
