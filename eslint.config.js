import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'output/', 'coverage/', 'dist/'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: globals.node },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },
  {
    // The Vite frontend: browser ES modules. Build DOM with app/src/lib/dom.js.
    files: ['app/**/*.js'],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]',
          message: 'Build DOM nodes with app/src/lib/dom.js (textContent), never innerHTML.',
        },
        {
          selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
          message: 'Build DOM nodes with app/src/lib/dom.js (textContent), never insertAdjacentHTML.',
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
