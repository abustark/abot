'use strict';
/**
 * Shared chat-request security core.
 * Used by BOTH backends so validation & limits stay in sync:
 *   - server.js          (local/self-host, CommonJS require)
 *   - api/chat.js        (Vercel serverless, ESM default-import — bundler interop)
 */

const crypto = require('crypto');

const LIMITS = {
  MAX_MESSAGES: 40,                  // messages per request
  MAX_MESSAGE_CHARS: 8000,           // per-message length (free-tier token burn guard)
  MAX_TOTAL_CHARS: 200000,           // whole-payload guard
  MAX_MODEL_LENGTH: 200,
  MODEL_PATTERN: /^[a-zA-Z0-9._\-/]+$/, // no spaces, control chars, or URL metachars
  MODEL_SEGMENT_PATTERN: /^[a-zA-Z0-9._-]+$/, // for the part interpolated into URLs
  ALLOWED_PROVIDERS: ['google/', 'groq/', 'nvidia/', 'deepseek/', 'qwen/', 'z-ai/', 'cognitivecomputations/'],
  CHAT_WINDOW_MS: 15 * 60 * 1000,    // rate-limit window
  CHAT_MAX_REQUESTS: 30,             // per identity per window (uid, else hashed IP)
  UPSTREAM_TIMEOUT_MS: 55000,        // under Vercel maxDuration (60s)
  MAX_TRACKED_IDENTITIES: 5000,      // memory bound for the in-memory limiter
};

/** Validate {model, messages} from a chat request. Returns {ok, model, cleanedMessages} or {ok:false, code, message}. */
function validateChatRequest(body) {
  const { model, messages } = body || {};

  if (!model || typeof model !== 'string' || model.length > LIMITS.MAX_MODEL_LENGTH) {
    return { ok: false, code: 400, message: 'Invalid model parameter' };
  }
  if (!LIMITS.MODEL_PATTERN.test(model) || model.includes('..') || model.includes('//')) {
    return { ok: false, code: 400, message: 'Invalid model parameter' };
  }
  const modelSegment = model.split('/')[1] || '';
  if (!LIMITS.MODEL_SEGMENT_PATTERN.test(modelSegment)) {
    return { ok: false, code: 400, message: 'Invalid model parameter' };
  }
  if (!LIMITS.ALLOWED_PROVIDERS.some((p) => model.startsWith(p))) {
    return { ok: false, code: 400, message: 'Invalid model provider' };
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, code: 400, message: 'Invalid messages parameter' };
  }
  if (messages.length > LIMITS.MAX_MESSAGES) {
    return { ok: false, code: 413, message: 'Too many messages in request' };
  }

  let total = 0;
  for (const msg of messages) {
    if (!msg || typeof msg !== 'object' ||
        !['system', 'user', 'assistant'].includes(msg.role) ||
        typeof msg.content !== 'string') {
      return { ok: false, code: 400, message: 'Invalid message format' };
    }
    total += msg.content.length;
    if (msg.content.length > LIMITS.MAX_MESSAGE_CHARS) {
      return { ok: false, code: 413, message: 'Message too long' };
    }
  }
  if (total > LIMITS.MAX_TOTAL_CHARS) {
    return { ok: false, code: 413, message: 'Conversation too large' };
  }

  const cleanedMessages = messages.map(({ role, content }) => ({ role, content }));

  /**
   * Optional per-message composer options (v1.0.3 B3/B4). Strictly coerced to
   * booleans — no free-form pass-through: an `options` object from the client
   * can only ever widen to web-search grounding / extended thinking, which the
   * provider layer additionally re-gates per model family. Absent/invalid
   * fields default to false (cost-free behavior identical to pre-1.0.3).
   */
  const opts = body && body.options;
  const chatOptions = {
    webSearch: !!(opts && opts.webSearch === true),
    thinking: !!(opts && opts.thinking === true),
  };

  return { ok: true, model, cleanedMessages, chatOptions };
}

/**
 * Tier-1 in-memory fixed-window rate limiter.
 * NOTE (serverless): state is per-warm-instance and resets on cold start.
 * Documented limitation of the zero-cost tier.
 */
class MemoryRateLimiter {
  constructor({ windowMs = LIMITS.CHAT_WINDOW_MS, max = LIMITS.CHAT_MAX_REQUESTS } = {}) {
    this.windowMs = windowMs;
    this.max = max;
    this.hits = new Map(); // key -> { count, windowStart }
  }

  check(key) {
    this._sweep();
    const now = Date.now();
    let entry = this.hits.get(key);
    if (!entry || now - entry.windowStart >= this.windowMs) {
      entry = { count: 0, windowStart: now };
      this.hits.set(key, entry);
      if (this.hits.size > LIMITS.MAX_TRACKED_IDENTITIES) this._evictOldest();
    }
    entry.count += 1;
    const allowed = entry.count <= this.max;
    const retryAfterSec = allowed ? 0 : Math.ceil((entry.windowStart + this.windowMs - now) / 1000);
    return { allowed, retryAfterSec, remaining: Math.max(0, this.max - entry.count) };
  }

  _sweep() {
    const now = Date.now();
    for (const [k, v] of this.hits) {
      if (now - v.windowStart >= this.windowMs) this.hits.delete(k);
    }
  }

  _evictOldest() {
    let oldestKey = null, oldestStart = Infinity;
    for (const [k, v] of this.hits) {
      if (v.windowStart < oldestStart) { oldestStart = v.windowStart; oldestKey = k; }
    }
    if (oldestKey) this.hits.delete(oldestKey);
  }
}

/** Identity for rate limiting: prefer uid; fall back to hashed client IP (never stored raw). */
function identityKey(uid, ip) {
  if (uid) return `u:${uid}`;
  return `i:${crypto.createHash('sha256').update(String(ip || 'unknown')).digest('hex').slice(0, 24)}`;
}

/** Best-effort client IP (Vercel sets x-forwarded-for / x-real-ip). */
function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  if (req.headers['x-real-ip']) return String(req.headers['x-real-ip']);
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

/** Abort signal that fires after `ms` (upstream hang guard). */
function upstreamTimeout(ms = LIMITS.UPSTREAM_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  if (typeof t.unref === 'function') t.unref();
  return ctrl.signal;
}

/** Uniform, sanitized SSE error envelope. NEVER include upstream/provider details. */
function sseError(res, userMessage) {
  if (res.writableEnded) return;
  res.write(`event: error\ndata: ${JSON.stringify({ message: userMessage })}\n\n`);
}

/** Log provider/upstream failures with truncation (full bodies never reach the client). */
function logProviderError(scope, status, bodyText) {
  const snippet = String(bodyText || '').replace(/[\r\n]+/g, ' ').slice(0, 500);
  console.error(`[chat:${scope}] upstream ${status || 'network-failure'}: ${snippet}`);
}

module.exports = { LIMITS, validateChatRequest, MemoryRateLimiter, identityKey, clientIp, upstreamTimeout, sseError, logProviderError };
