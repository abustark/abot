/*
 * html-validate config for ABot — part of the `npm run test:html` gate.
 *
 * no-inline-style: off — the app intentionally drives dynamic state via inline
 * styles (app-container display toggle, header grid template, modal
 * open/close transforms) under style-src 'unsafe-inline'. Hardcoded inline
 * hex colors are independently hard-failed by the ui-audit G03 check.
 */
module.exports = {
    extends: ['html-validate:recommended'],
    rules: {
        'no-inline-style': 'off',
    },
};
