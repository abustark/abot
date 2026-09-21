/**
 * ABot ESLint (flat config, ESLint 9)
 * - js/ + api/ : browser/serverless ESM
 * - server.js, lib/, tests/, tools/ : Node CJS
 * Pragmatic for a legacy-grown vanilla codebase: recommended rules, no style policing.
 */
const js = require('@eslint/js');
const globals = require('globals');

const BROWSER_EXTRA = {
    firebase: 'readonly',
    marked: 'readonly',
    hljs: 'readonly',
    VANTA: 'readonly',
    google: 'readonly',
    speechSynthesis: 'readonly',
    SpeechSynthesisUtterance: 'readonly',
};

module.exports = [
    js.configs.recommended,
    { ignores: ['node_modules/**', 'dist/**', 'vendor/**', 'tmp/**', 'npx/**', '.claude/**', '.agents/**', '.freebuff/**', '.github/**', 'skills-lock.json'] },

    // Browser ESM app modules
    {
        files: ['js/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: { ...globals.browser, ...BROWSER_EXTRA },
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'no-empty': ['error', { allowEmptyCatch: true }],
        },
    },

    // Vercel serverless function (ESM, Node globals)
    {
        files: ['api/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: { ...globals.node },
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-empty': ['error', { allowEmptyCatch: true }],
        },
    },

    // Node CJS: server, lib, tests, tools
    {
        files: ['server.js', 'lib/**/*.js', 'tests/**/*.js', 'tools/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: { ...globals.node },
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-empty': ['error', { allowEmptyCatch: true }],
        },
    },

    // Config files at root (CJS)
    {
        files: ['*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: { ...globals.node },
        },
    },
    // Service worker: browser SW globals + Cache Storage
    {
        files: ['service-worker.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: { ...globals.serviceworker },
        },
    },

    // Tools that embed browser-context code inside puppeteer page.evaluate()
    // callbacks: those callbacks execute in the page, not in Node, so both
    // global sets are legitimate for these two files.
    {
        files: ['tools/visual-check.js', 'tools/interaction-test.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: { ...globals.node, ...globals.browser },
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'no-empty': ['error', { allowEmptyCatch: true }],
        },
    },

    { ignores: ['eslint.config.js', 'tailwind.config.js'] },
];
