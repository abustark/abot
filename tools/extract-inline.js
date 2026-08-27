'use strict';
/**
 * Phase 2 tooling — extracts the inline script blocks from index.html.
 * Bounds (1-based, inclusive, tags EXCLUDED):
 *   theme block : 338–346
 *   sw block    : 350–357
 *   main module : 852–2522
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
// Since Phase 2, index.html no longer contains the inline blocks. The extractor
// reads the historical monolith from git (last commit before the rewire).
const { execSync } = require('child_process');
// Last commits that still contain the monolith (history may be pruned — try in order)
const CANDIDATES = [process.env.EXTRACT_REF, '6cc93c8', 'a31d318', 'c242d2d'].filter(Boolean);
let REF = null;
for (const ref of CANDIDATES) {
  try { execSync(`git cat-file -e ${ref}:index.html`, { cwd: ROOT }); REF = ref; break; } catch {}
}
if (!REF) throw new Error('No reachable commit contains the monolith index.html');
const html = execSync(`git show ${REF}:index.html`, { cwd: ROOT, encoding: 'utf8' }).split('\n');
const OUT = path.join(__dirname, '..', 'tmp');

fs.mkdirSync(OUT, { recursive: true });

const blocks = {
  'theme.js': [338, 346],
  'sw.js': [350, 357],
  'main-module.js': [852, 2522],
};

for (const [name, [start, end]] of Object.entries(blocks)) {
  const lines = html.slice(start - 1, end);
  fs.writeFileSync(path.join(OUT, name), lines.join('\n') + '\n');
  console.log(`${name}: ${lines.length} lines extracted`);
}

// Sanity: verify the fences we cut between
const fence = (n) => html[n - 1].trim();
console.log('fence check 337:', JSON.stringify(fence(337)));
console.log('fence check 347:', JSON.stringify(fence(347)));
console.log('fence check 349:', JSON.stringify(fence(349)));
console.log('fence check 358:', JSON.stringify(fence(358)));
console.log('fence check 851:', JSON.stringify(fence(851)));
console.log('fence check 2523:', JSON.stringify(fence(2523)));
