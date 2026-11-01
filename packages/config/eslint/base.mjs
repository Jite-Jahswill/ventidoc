import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export const baseConfig = tseslint.config(js.configs.recommended, ...tseslint.configs.recommended, {
  languageOptions: {
    globals: {
      ...globals.node,
    },
  },
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
  },
});

export default baseConfig;
