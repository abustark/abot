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

// OpenRouter :free tier — colons allowed, org prefixes validated (v2.0.10/11)
assert(V({ model: 'qwen/qwen3-coder:free', messages: [{ role: 'user', content: 'a' }] }).ok, ':free suffix passes validation');
assert(V({ model: 'openai/gpt-oss-120b:free', messages: [{ role: 'user', content: 'a' }] }).ok, 'openai org :free accepted');
assert(V({ model: 'poolside/laguna-s-2.1:free', messages: [{ role: 'user', content: 'a' }] }).ok, 'poolside S 2.1 accepted');
assert(V({ model: 'thinkingmachines/inkling:free', messages: [{ role: 'user', content: 'a' }] }).ok, 'thinkingmachines accepted');
assert(V({ model: 'inclusionai/ling-3.0-flash-vl:free', messages: [{ role: 'user', content: 'a' }] }).ok, 'inclusionai accepted');
assert(V({ model: 'groq/openai/gpt-oss-20b', messages: [{ role: 'user', content: 'a' }] }).ok, 'groq nested-org model accepted');
assert(V({ model: 'groq/minimaxai/minimax-m2.7', messages: [{ role: 'user', content: 'a' }] }).ok, 'minimaxai via groq accepted');
assert(!V({ model: 'google/../gemma:free', messages: [{ role: 'user', content: 'a' }] }).ok, 'traversal still blocked with :free');
assert(!V({ model: 'groq/m:free;rm-rf', messages: [{ role: 'user', content: 'a' }] }).ok, 'semicolon still blocked with :free');
assert(!V({ model: 'evilcorp/agent:free', messages: [{ role: 'user', content: 'a' }] }).ok, 'unknown org :free rejected');
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

// --- email verification (H1) ---
const E = sec.verifyUserEmailStatus;
assert(E(null).allowed === false && E(null).code === 401, 'null token blocked 401');
assert(E(undefined).allowed === false && E(undefined).code === 401, 'undefined token blocked 401');

const unverifiedPass = { uid: 'u1', firebase: { sign_in_provider: 'password' }, email_verified: false };
const verifiedPass = { uid: 'u2', firebase: { sign_in_provider: 'password' }, email_verified: true };
const unverifiedCheck = E(unverifiedPass);
assert(!unverifiedCheck.allowed && unverifiedCheck.code === 403, 'unverified password user blocked 403');
assert(unverifiedCheck.error.includes('Email verification required'), 'clear email verification error message');
assert(E(verifiedPass).allowed === true, 'verified password user allowed');

const googleUser = { uid: 'u3', firebase: { sign_in_provider: 'google.com' }, email_verified: false };
assert(E(googleUser).allowed === true, 'google user allowed');
const anonUser = { uid: 'u4', firebase: { sign_in_provider: 'anonymous' } };
assert(E(anonUser).allowed === true, 'anonymous guest user allowed');

// --- v2.0.16 regression: API-surface drift guard ---
// api/chat.js + server.js destructure these names from the lib; if the lib
// loses one (sandbox resets have done exactly this), production 500s with
// "X is not a function" on every provider error. Verify presence + behavior.
const REQUIRED_API = ['validateChatRequest', 'verifyUserEmailStatus', 'MemoryRateLimiter', 'identityKey', 'clientIp', 'upstreamTimeout', 'sseError', 'providerStatusError', 'logProviderError', 'LIMITS'];
for (const name of REQUIRED_API) {
  assert(sec[name] !== undefined, `lib export drift: ${name} missing`);
}
// providerStatusError must write a code-tagged SSE envelope and stop silently on ended streams
{
  let written = '', ended = false;
  const fakeRes = {
    get writableEnded() { return ended; },
    write(chunk) { written += chunk; return true; },
  };
  sec.providerStatusError(fakeRes, 'groq', 404);
  assert(written.includes('event: error'), 'providerStatusError writes SSE event');
  assert(written.includes('model_unavailable'), '404 maps to model_unavailable');
  assert(written.includes('"code"'), 'envelope carries a machine code');
  ended = true;
  written = '';
  sec.providerStatusError(fakeRes, 'groq', 429);
  assert(written === '', 'ended stream is not written to');
}

console.log('ALL CHAT-SECURITY TESTS PASSED ✅');
