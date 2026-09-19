'use strict';
/**
 * Security-core tests — run: node tests/chat-security.test.js
 * No framework needed (per repo constraint: keep tooling light).
 */
const assert = require('assert');
const sec = require('../lib/chat-security.js');
const V = sec.validateChatRequest;

// --- validation ---
let r = V({ model: 'groq/llama-3.1-8b-instant', messages: [{ role: 'user', content: 'hi' }] });
assert(r.ok && r.cleanedMessages.length === 1, 'valid request passes');

assert(!V({ model: 'evil/x', messages: [{ role: 'user', content: 'a' }] }).ok, 'disallowed provider rejected');
assert(!V({ model: 'groq/x; rm -rf', messages: [{ role: 'user', content: 'a' }] }).ok, 'shell metachars rejected');
assert(!V({ model: 'google/../secret', messages: [{ role: 'user', content: 'a' }] }).ok, 'path traversal rejected');
assert(!V({ model: 'google//x', messages: [{ role: 'user', content: 'a' }] }).ok, 'empty segment rejected');
assert(!V({ model: 'google/', messages: [{ role: 'user', content: 'a' }] }).ok, 'missing segment rejected');
assert(!V({ model: 'x'.repeat(201), messages: [{ role: 'user', content: 'a' }] }).ok, 'model length cap');

assert(!V({ model: 'groq/m', messages: Array(41).fill({ role: 'user', content: 'a'.repeat(100) }) }).ok, 'message count cap');
assert(V({ model: 'groq/m', messages: Array(40).fill({ role: 'user', content: 'a'.repeat(100) }) }).ok, '40 messages allowed');
assert(!V({ model: 'groq/m', messages: [{ role: 'user', content: 'a'.repeat(8001) }] }).ok, 'per-message char cap');
assert(V({ model: 'groq/m', messages: [{ role: 'user', content: 'a'.repeat(8000) }] }).ok, '8000 chars allowed');

r = V({ model: 'groq/m', messages: [{ role: 'user', content: 'hi', evil: '<script>' }] });
assert(!('evil' in r.cleanedMessages[0]), 'extra fields stripped');

assert(!V({ model: 'groq/m', messages: [{ role: 'tool', content: 'x' }] }).ok, 'bad role rejected');
assert(!V({ model: 'groq/m', messages: [{ role: 'user', content: 42 }] }).ok, 'non-string content rejected');
assert(!V(null).ok, 'null body rejected');

// --- composer options (v1.0.3 B3/B4): strict boolean coercion, no pass-through ---
r = V({ model: 'groq/m', messages: [{ role: 'user', content: 'a' }], options: { webSearch: true, thinking: true } });
assert(r.ok && r.chatOptions.webSearch === true && r.chatOptions.thinking === true, 'valid options pass through as booleans');

r = V({ model: 'groq/m', messages: [{ role: 'user', content: 'a' }], options: { webSearch: 'yes', thinking: 1 } });
assert(r.ok && r.chatOptions.webSearch === false && r.chatOptions.thinking === false, 'non-strict-true values coerce to false');

r = V({ model: 'groq/m', messages: [{ role: 'user', content: 'a' }], options: { webSearch: true, injected: '<script>' } });
assert(r.ok && !('injected' in r.chatOptions) && Object.keys(r.chatOptions).length === 2, 'unknown option keys stripped');

r = V({ model: 'groq/m', messages: [{ role: 'user', content: 'a' }], options: 'delete-everything' });
assert(r.ok && r.chatOptions.webSearch === false && r.chatOptions.thinking === false, 'non-object options ignored safely');

r = V({ model: 'groq/m', messages: [{ role: 'user', content: 'a' }] });
assert(r.ok && r.chatOptions.webSearch === false && r.chatOptions.thinking === false, 'absent options default to false');

// --- rate limiter ---
const L = new sec.MemoryRateLimiter({ windowMs: 1000, max: 3 });
assert(L.check('a').allowed && L.check('a').allowed && L.check('a').allowed, '3 allowed');
const blocked = L.check('a');
assert(!blocked.allowed && blocked.retryAfterSec > 0, '4th blocked with Retry-After');
assert(L.check('b').allowed, 'independent keys');

// --- identity ---
assert(sec.identityKey('uid1', '1.2.3.4') === 'u:uid1', 'uid identity');
assert(sec.identityKey(null, '1.2.3.4').startsWith('i:'), 'ip hashed');
assert(sec.identityKey(null, '1.2.3.4') !== sec.identityKey(null, '5.6.7.8'), 'distinct IPs distinct keys');

console.log('ALL CHAT-SECURITY TESTS PASSED ✅');
