"""
ABot Security Health Checker
Verifies local/staging server security headers, CSP, and endpoint auth policies.
Usage: python tools/test-security.py [base_url]
"""
import sys
import urllib.request
import urllib.error

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3000"

def check_headers():
    print(f"[Security Check] Testing root URL: {BASE_URL}")
    try:
        req = urllib.request.Request(BASE_URL, method='GET')
        with urllib.request.urlopen(req, timeout=5) as resp:
            headers = dict(resp.headers)
            status = resp.status
            print(f"  HTTP Status: {status}")

            csp = headers.get('Content-Security-Policy') or headers.get('content-security-policy')
            if csp:
                print("  [PASS] Content-Security-Policy is present")
            else:
                print("  [WARN] Content-Security-Policy missing")

            xfo = headers.get('X-Frame-Options') or headers.get('x-frame-options')
            if xfo:
                print(f"  [PASS] X-Frame-Options: {xfo}")
            else:
                print("  [WARN] X-Frame-Options missing")

            xcto = headers.get('X-Content-Type-Options') or headers.get('x-content-type-options')
            if xcto:
                print(f"  [PASS] X-Content-Type-Options: {xcto}")
            else:
                print("  [WARN] X-Content-Type-Options missing")
    except Exception as e:
        print(f"  [INFO] Could not connect to {BASE_URL} (server might be offline): {e}")

def check_chat_endpoint():
    chat_url = f"{BASE_URL}/api/chat"
    print(f"[Security Check] Testing chat endpoint: {chat_url}")
    try:
        req = urllib.request.Request(chat_url, method='GET')
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                print(f"  [WARN] GET /api/chat returned {resp.status} (expected rejection)")
        except urllib.error.HTTPError as e:
            if e.code in (404, 405):
                print(f"  [PASS] GET /api/chat rejected with HTTP {e.code}")
            else:
                print(f"  [INFO] GET /api/chat returned HTTP {e.code}")

        post_req = urllib.request.Request(
            chat_url,
            data=b'{"model":"groq/llama-3.3-70b-versatile","messages":[{"role":"user","content":"hi"}]}',
            headers={"Content-Type": "application/json"},
            method='POST'
        )
        try:
            with urllib.request.urlopen(post_req, timeout=5) as resp:
                print(f"  [FAIL] POST /api/chat succeeded without auth token: {resp.status}")
        except urllib.error.HTTPError as e:
            if e.code == 401:
                print("  [PASS] Unauthenticated POST rejected with HTTP 401 Unauthorized")
            else:
                print(f"  [INFO] POST /api/chat rejected with HTTP {e.code}")
    except Exception as e:
        print(f"  [INFO] Chat endpoint check skipped: {e}")

if __name__ == '__main__':
    check_headers()
    check_chat_endpoint()
    print("[Security Check] Done.")
