"""
ABot Security Health Checker
Verifies local/staging server security headers, CSP, and endpoint auth policies.

Usage: python tools/test-security.py [base_url]     (default http://127.0.0.1:3000)
Exit:  0 = every check passed; 1 = at least one failure (server offline counts).
"""
import sys
import urllib.request
import urllib.error

BASE_URL = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3000").rstrip("/")

passed = 0
failures = []


def ok(msg):
    global passed
    passed += 1
    print(f"  [PASS] {msg}")


def fail(msg):
    failures.append(msg)
    print(f"  [FAIL] {msg}")


def info(msg):
    print(f"  [INFO] {msg}")


def get_headers():
    """Fetch root URL; return lowercased header dict or None on any error."""
    try:
        req = urllib.request.Request(f"{BASE_URL}/", method="GET")
        with urllib.request.urlopen(req, timeout=5) as resp:
            print(f"[Security Check] Root URL: {BASE_URL} -> HTTP {resp.status}")
            if resp.status != 200:
                fail(f"root URL returned HTTP {resp.status}, expected 200")
                return None
            return {k.lower(): v for k, v in resp.headers.items()}
    except Exception as e:
        fail(f"server offline or unreachable: {e}")
        return None


def check_headers(headers):
    # Content-Security-Policy: present, and script-src must not allow inline.
    csp = headers.get("content-security-policy", "")
    if not csp:
        fail("Content-Security-Policy header missing")
    else:
        script_src = next(
            (d for d in csp.split(";") if d.strip().lower().startswith("script-src") and not d.strip().lower().startswith("script-src-attr")),
            "",
        )
        if "'unsafe-inline'" in script_src:
            fail("CSP script-src allows 'unsafe-inline'")
        else:
            ok("CSP present, script-src has no 'unsafe-inline'")

    xcto = headers.get("x-content-type-options", "")
    if xcto == "nosniff":
        ok("X-Content-Type-Options: nosniff")
    else:
        fail(f"X-Content-Type-Options is '{xcto}', expected 'nosniff'")

    xfo = headers.get("x-frame-options", "").upper()
    if xfo in ("DENY", "SAMEORIGIN"):
        ok(f"X-Frame-Options: {xfo}")
    else:
        fail(f"X-Frame-Options is '{xfo}', expected DENY or SAMEORIGIN")

    hsts = headers.get("strict-transport-security", "")
    if "max-age=" in hsts:
        ok(f"Strict-Transport-Security: {hsts}")
    else:
        fail("Strict-Transport-Security missing or without max-age")

    if headers.get("referrer-policy"):
        ok(f"Referrer-Policy: {headers['referrer-policy']}")
    else:
        fail("Referrer-Policy header missing")

    pp = headers.get("permissions-policy", "")
    if "camera=()" in pp and "microphone=()" in pp and "geolocation=()" in pp:
        ok("Permissions-Policy locks camera/microphone/geolocation")
    else:
        fail(f"Permissions-Policy missing or too permissive: '{pp}'")


def check_chat_endpoint():
    chat_url = f"{BASE_URL}/api/chat"
    print(f"[Security Check] Chat endpoint: {chat_url}")

    # GET must be rejected (no route) with 405/404 — 401 also acceptable.
    try:
        req = urllib.request.Request(chat_url, method="GET")
        with urllib.request.urlopen(req, timeout=5) as resp:
            fail(f"GET /api/chat returned {resp.status}, expected rejection")
    except urllib.error.HTTPError as e:
        if e.code in (401, 404, 405):
            ok(f"GET /api/chat rejected with HTTP {e.code}")
        elif e.code == 429:
            fail("GET /api/chat got HTTP 429 (rate limited) — wait ~15 min and rerun")
        else:
            fail(f"GET /api/chat returned unexpected HTTP {e.code}")
    except Exception as e:
        fail(f"GET /api/chat unreachable: {e}")

    # POST without an auth token must be rejected with 401.
    body = b'{"model":"groq/openai/gpt-oss-120b","messages":[{"role":"user","content":"hi"}]}'
    try:
        post_req = urllib.request.Request(
            chat_url,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(post_req, timeout=5) as resp:
            fail(f"POST /api/chat succeeded without auth token: HTTP {resp.status}")
    except urllib.error.HTTPError as e:
        if e.code == 401:
            ok("Unauthenticated POST rejected with HTTP 401")
        elif e.code == 429:
            fail("POST /api/chat got HTTP 429 (rate limited) — wait ~15 min and rerun")
        else:
            fail(f"POST /api/chat rejected with HTTP {e.code}, expected 401")
    except Exception as e:
        fail(f"POST /api/chat unreachable: {e}")


if __name__ == "__main__":
    headers = get_headers()
    if headers is not None:
        check_headers(headers)
    check_chat_endpoint()

    if failures:
        print(f"\n[Security Check] {passed} passed, {len(failures)} FAILED:")
        for f in failures:
            print(f"  - {f}")
        sys.exit(1)
    print(f"\n[Security Check] All {passed} checks passed.")
    sys.exit(0)
