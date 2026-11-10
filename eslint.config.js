import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'output/', 'coverage/'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: globals.node },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },
  {
    // Browser pages load these as classic scripts that share globals.
    // Phase 3 of docs/overhaul-plan.md replaces them with bundled ES modules.
    files: ['web/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.browser, supabase: 'readonly', supabaseClient: 'readonly' },
    },
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: "AssignmentExpression[left.property.name='innerHTML']",
          message: 'Build DOM nodes with textContent instead of innerHTML.',
        },
      ],
    },
  },
  {
    // Callbacks passed to page.addInitScript and page.evaluate run in the browser.
    files: ['tests/e2e/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
