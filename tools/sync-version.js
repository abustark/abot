'use strict';
/**
 * Version sync — makes the release number impossible to forget.
 *
 * Run automatically by .githooks/pre-commit (which has no access to the commit
 * subject) in `--from-history` mode: it reads the newest `### <version> - ...`
 * entry from COMMIT-HISTORY.md. It then does three things:
 *
 *   1. refuses to run when that version is malformed or its third number is
 *      past `.10` (the roll-over rule lives in AGENTS.md §1);
 *   2. writes `APP_VERSION` in js/config.js — the single value the UI reads;
 *   3. writes `version` in package.json, so npm metadata can't drift;
 *   4. advances the `📌 Next version` line in COMMIT-HISTORY.md (`x.y.10` →
 *      `x.(y+1).0`, never `.11`).
 *
 * Any file it rewrites is staged, so the fix lands inside the same commit
 * (which is why it must run in pre-commit: git builds the tree right after).
 * `.githooks/commit-msg` then aborts if the subject's version disagrees.
 *
 * Manual use:  node tools/sync-version.js 2.6.10
 *              node tools/sync-version.js --from-history
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_FILE = path.join(ROOT, 'js', 'config.js');
const PACKAGE_FILE = path.join(ROOT, 'package.json');
const HISTORY_FILE = path.join(ROOT, 'COMMIT-HISTORY.md');

const fromHistory = process.argv.includes('--from-history');
let version = '';

if (fromHistory) {
    // The newest entry is authoritative: write the history line first, and the
    // version in code follows it — one place for a session to get right.
    const newest = fs.readFileSync(HISTORY_FILE, 'utf8').match(/^### (\d+\.\d+\.\d+) - /m);
    if (!newest) {
        console.error('[sync-version] COMMIT-HISTORY.md has no "### <version> - ..." entry.');
        process.exit(1);
    }
    version = newest[1];
} else {
    version = String(process.argv[2] || '').trim();
}

if (!/^\d+\.\d+\.\d+$/.test(version)) {
    console.error(`[sync-version] "${version}" is not a version (expected e.g. 2.6.10).`);
    process.exit(1);
}

const [major, minor, patch] = version.split('.').map(Number);

if (patch > 10) {
    console.error(`[sync-version] ${version}: the third number never exceeds .10.`);
    console.error(`[sync-version] Use ${major}.${minor + 1}.0 instead.`);
    process.exit(1);
}

const next = patch >= 10
    ? `${major}.${minor + 1}.0`
    : `${major}.${minor}.${patch + 1}`;

// --- 1. the history entry must exist -----------------------------------------
const history = fs.readFileSync(HISTORY_FILE, 'utf8');
const entryRe = new RegExp(`^### ${version.replace(/\./g, '\\.')} - `, 'm');

if (!entryRe.test(history)) {
    console.error(`[sync-version] COMMIT-HISTORY.md has no "### ${version} - ..." entry.`);
    console.error('[sync-version] Add the entry first — the commit is refused until it exists.');
    process.exit(1);
}

// --- 2. js/config.js ---------------------------------------------------------
const config = fs.readFileSync(CONFIG_FILE, 'utf8');

if (!/^export const APP_VERSION = '[^']*';$/m.test(config)) {
    console.error('[sync-version] could not find `export const APP_VERSION` in js/config.js.');
    process.exit(1);
}

const nextConfig = config.replace(
    /^export const APP_VERSION = '[^']*';$/m,
    `export const APP_VERSION = '${version}';`
);

// --- 3. package.json ---------------------------------------------------------
const pkg = fs.readFileSync(PACKAGE_FILE, 'utf8');

if (!/^ {2}"version": "[^"]*",$/m.test(pkg)) {
    console.error('[sync-version] could not find the top-level "version" in package.json.');
    process.exit(1);
}

const nextPkg = pkg.replace(/^ {2}"version": "[^"]*",$/m, `  "version": "${version}",`);

// --- 4. the next-version line ------------------------------------------------
const nextLineRe = /^> - \*\*`main` → `\d+\.\d+\.\d+`\*\* \(current head is `\d+\.\d+\.\d+`\)$/m;

if (!nextLineRe.test(history)) {
    console.error('[sync-version] could not find the "📌 Next version" main line in COMMIT-HISTORY.md.');
    process.exit(1);
}

const nextHistory = history.replace(
    nextLineRe,
    `> - **\`main\` → \`${next}\`** (current head is \`${version}\`)`
);

// --- write + stage -----------------------------------------------------------
const changed = [];

if (nextConfig !== config) {
    fs.writeFileSync(CONFIG_FILE, nextConfig);
    changed.push('js/config.js');
}
if (nextPkg !== pkg) {
    fs.writeFileSync(PACKAGE_FILE, nextPkg);
    changed.push('package.json');
}
if (nextHistory !== history) {
    fs.writeFileSync(HISTORY_FILE, nextHistory);
    changed.push('COMMIT-HISTORY.md');
}

if (changed.length) {
    execFileSync('git', ['add', ...changed], { cwd: ROOT, stdio: 'inherit' });
    console.log(`[sync-version] ${version} → version synced, next version is ${next} (${changed.join(', ')}).`);
} else {
    console.log(`[sync-version] ${version} already in sync; next version is ${next}.`);
}
