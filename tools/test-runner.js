#!/usr/bin/env node
'use strict';
/**
 * ABot jsdom test runner (2.9.3).
 *
 * The three jsdom suites were separate `npm test` chained commands. They are
 * self-contained scripts that call `process.exit()` themselves, so they cannot
 * be required into one process — this runner spawns each as a child process and
 * aggregates the exit codes into a single pass/fail.
 *
 * Coverage is unchanged: every suite runs exactly as before, same order.
 *
 * Added: `--only=<name>` to run one suite while iterating, and a summary line.
 *
 * Suite: chat-security (Node, pure) · smoke (jsdom boot paths) ·
 *        interaction (clicks every shell control) · cycle (regression cases)
 */

const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Order matters: cheapest and most fundamental first, so a broken security
// contract or a failed boot fails fast before the long UI suites run.
const SUITES = [
    { name: 'chat-security', file: 'tests/chat-security.test.js', label: 'Security contract' },
    { name: 'smoke', file: 'tools/smoke-node.js', label: 'jsdom boot paths' },
    { name: 'interaction', file: 'tools/interaction-test.js', label: 'Full-shell interaction' },
    { name: 'cycle', file: 'tools/cycle-test.js', label: 'Cycle/regression cases' },
];

const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.split('=')[1] : null;

if (only && !SUITES.some((s) => s.name === only)) {
    console.error(`Unknown suite "${only}". Choose from: ${SUITES.map((s) => s.name).join(', ')}`);
    process.exit(2);
}

const selected = only ? SUITES.filter((s) => s.name === only) : SUITES;
const results = [];
let failed = 0;

for (const suite of selected) {
    const started = Date.now();
    console.log(`\n${'─'.repeat(64)}\n▶ ${suite.name} — ${suite.label} (${suite.file})\n${'─'.repeat(64)}`);

    const res = spawnSync(process.execPath, [path.join(ROOT, suite.file)], {
        cwd: ROOT,
        stdio: 'inherit', // stream output live; we only need the exit code
    });

    const ms = Date.now() - started;
    const code = res.status === null ? 1 : res.status;
    const crashed = !!res.error;

    if (crashed) {
        console.error(`✗ ${suite.name} could not start: ${res.error.message}`);
        failed++;
    } else if (code !== 0) {
        failed++;
    }

    results.push({ name: suite.name, code, ms, crashed });
}

// ------------------------------------------------------------------ summary
console.log(`\n${'═'.repeat(64)}\nJSDOM TEST SUMMARY\n${'═'.repeat(64)}`);
for (const r of results) {
    const ok = !r.crashed && r.code === 0;
    const status = ok ? 'PASS' : (r.crashed ? 'ERROR' : 'FAIL');
    console.log(`  ${status.padEnd(5)} ${r.name.padEnd(14)} ${(r.ms / 1000).toFixed(1)}s${ok ? '' : ` (exit ${r.code})`}`);
}

if (failed) {
    console.log(`\n${failed} SUITE(S) FAILED ❌\n`);
    process.exit(1);
}

console.log('\nAll suites passed ✅\n');
process.exit(0);
