'use strict';
/**
 * Syntax gate: every app module must parse as a valid ES module, every Node
 * file as CommonJS. Cheap, fast, catches truncation/malformed edits in CI.
 */
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const ROOT = path.join(__dirname, '..');
let failures = 0;

function check(rel, sourceType) {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) return;
    try {
        acorn.parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 2022, sourceType });
        console.log(`OK   ${rel}`);
    } catch (e) {
        failures++;
        console.error(`FAIL ${rel}: ${e.message}`);
    }
}

// App modules (ESM)
for (const f of fs.readdirSync(path.join(ROOT, 'js'))) {
    if (f.endsWith('.js')) check(path.join('js', f), 'module');
}
check(path.join('api', 'chat.js'), 'module');

// Node files (CJS)
for (const rel of ['server.js', 'lib/chat-security.js', 'tests/chat-security.test.js', 'service-worker.js', 'tools/build-split.js', 'tools/verify-parity.js', 'tools/extract-inline.js']) {
    check(rel, 'commonjs');
}

if (failures) {
    console.error(`\n${failures} file(s) failed syntax check`);
    process.exit(1);
}
console.log('\nAll files parse cleanly.');
