// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import i18next from 'eslint-plugin-i18next';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/dev-dist/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'apps/web/src/routeTree.gen.ts',
      'apps/api/data/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  // Plain JS files (root config, scripts, the e2e provider stub) are not part of any tsconfig project.
  {
    files: ['*.js', '*.mjs', '*.cjs', 'scripts/**/*.{js,mjs,cjs}', 'apps/web/e2e/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      globals: globals.node,
    },
  },

  // Node-side packages.
  {
    files: ['apps/api/**/*.ts', 'packages/shared/**/*.ts'],
    languageOptions: { globals: globals.node },
  },

  // Web app: React + hooks + hard-coded string guard.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, __APP_VERSION__: 'readonly' } },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      i18next,
    },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true, allowExportNames: ['Route'] },
      ],
    },
  },
  {
    // TanStack Router owns HMR for route files and code-splits only the
    // `Route` export, so screen components stay local (not exported) there.
    files: ['apps/web/src/routes/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // Every user-facing string in UI code must go through a translation key.
    files: ['apps/web/src/**/*.tsx'],
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-text-only',
          'should-validate-template': true,
          'jsx-attributes': {
            include: ['aria-label', 'title', 'placeholder', 'alt'],
          },
        },
      ],
    },
  },

  // Tests and tooling may use literal strings and looser typing.
  {
    files: ['**/test/**', '**/e2e/**', '**/*.test.{ts,tsx}', '**/*.config.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      'i18next/no-literal-string': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },

  prettier,
);
