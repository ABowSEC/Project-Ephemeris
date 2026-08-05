import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

// Rules shared by the JS and TS blocks. The TS block cannot simply inherit the
// JS one: typescript-eslint replaces core rules like no-unused-vars with its
// own, so the varsIgnorePattern the codebase relies on (`MotionBox`-style
// aliases ESLint can't see used inside JSX) has to be restated there.
const reactRules = {
  ...reactHooks.configs.recommended.rules,
  // Mark variables referenced in JSX (e.g. `<motion.div>`) as used.
  'react/jsx-uses-vars': 'error',
  'react/jsx-uses-react': 'error',
  'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
}

const reactPlugins = {
  react,
  'react-hooks': reactHooks,
  'react-refresh': reactRefresh,
}

export default [
  // .wrangler holds the bundled worker `wrangler pages dev` generates from
  // functions/ — machine-written, and linting it reports on esbuild's output
  // rather than on anything anyone can fix.
  { ignores: ['dist', 'src/wasm', 'crates', '.wrangler'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: reactPlugins,
    rules: {
      ...js.configs.recommended.rules,
      ...reactRules,
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { ...reactPlugins, '@typescript-eslint': tseslint.plugin },
    rules: {
      ...js.configs.recommended.rules,
      ...reactRules,
      // The base rule can't see type-only references; its TS counterpart
      // carries the same varsIgnorePattern the JS block uses.
      'no-unused-vars': 'off',
      'no-undef': 'off', // tsc owns this; ESLint has no type info here
      '@typescript-eslint/no-unused-vars': [
        'error',
        { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // Pages Functions target the Workers runtime, not the browser.
    files: ['functions/**/*.{js,ts}'],
    languageOptions: {
      globals: { ...globals.worker, caches: 'readonly', HTMLRewriter: 'readonly' },
    },
  },
  {
    // Build scripts run in Node.
    files: ['scripts/**/*.mjs', '*.config.js', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
]
