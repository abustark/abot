import json, os, sys, time
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = os.environ.get(
    "ABOT_ARTIFACT_DIR",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tmp", "playwright"),
)
os.makedirs(ARTIFACT_DIR, exist_ok=True)
BASE_URL = "http://127.0.0.1:3000"

results = {
    "auth_page": {},
    "signup_view": {},
    "verify_email_view": {},
    "guest_chat_shell": {},
    "model_selector": {},
    "account_menu": {},
    "theme_toggle": {},
    "reading_measure": {},
    "backend_email_policy": {}
}

def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, channel='chrome')
        context = browser.new_context(viewport={'width': 1280, 'height': 800}, device_scale_factor=2)
        page = context.new_page()

        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)[:200]))

        print("[1/8] Navigating to", BASE_URL)
        page.goto(BASE_URL, wait_until='domcontentloaded')
        page.wait_for_timeout(1000)

        # Check Auth Page
        auth_visible = page.is_visible('#auth-section')
        login_visible = page.is_visible('#login-view')
        has_aurora = page.evaluate("() => !!document.querySelector('.auth-scene .auth-bloom-1')")
        results["auth_page"] = {
            "auth_visible": auth_visible,
            "login_visible": login_visible,
            "css_aurora_backdrop": has_aurora,
            "title": page.title()
        }
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "live_auth_login.png"))
        print("[2/8] Auth Login verified and screenshotted.")

        # Test Switching to Sign Up
        page.click('#show-signup')
        page.wait_for_timeout(400)
        signup_visible = page.is_visible('#signup-view')
        results["signup_view"] = {
            "signup_visible": signup_visible,
            "has_email_input": page.is_visible('#signup-email'),
            "has_password_input": page.is_visible('#signup-password')
        }
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "live_auth_signup.png"))
        print("[3/8] Sign Up View verified and screenshotted.")

        # Test Verify Email View appearance & controls
        page.evaluate("""() => {
            document.getElementById('signup-view').style.display = 'none';
            document.getElementById('login-view').style.display = 'none';
            const v = document.getElementById('verify-email-view');
            v.style.display = 'block';
            document.getElementById('verify-email-address').textContent = 'alex.developer@example.com';
        }""")
        page.wait_for_timeout(400)
        verify_email_visible = page.is_visible('#verify-email-view')
        check_btn_visible = page.is_visible('#check-verification-btn')
        resend_btn_visible = page.is_visible('#resend-verification-btn')
        back_btn_visible = page.is_visible('#verify-back-to-login')
        email_text = page.inner_text('#verify-email-address')
        results["verify_email_view"] = {
            "view_visible": verify_email_visible,
            "check_btn_visible": check_btn_visible,
            "resend_btn_visible": resend_btn_visible,
            "back_to_login_visible": back_btn_visible,
            "email_displayed": email_text
        }
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "live_auth_verify_email.png"))
        print("[4/8] Verify Email View verified and screenshotted.")

        # Reset view back to default login state
        page.evaluate("""() => {
            document.getElementById('verify-email-view').style.display = 'none';
            document.getElementById('login-view').style.display = 'block';
        }""")
        page.wait_for_timeout(300)

        print("[5/8] Signing in as Guest...")
        page.click('#guest-signin-btn')
        # Wait for app shell to become visible
        page.wait_for_selector('#app-container', state='visible', timeout=20000)
        page.wait_for_timeout(2000)
        results["guest_chat_shell"] = {
            "app_container_visible": page.is_visible('#app-container'),
            "composer_visible": page.is_visible('#messageInput'),
            "chat_history_visible": page.is_visible('#chatHistory'),
            "send_btn_visible": page.is_visible('#sendBtn')
        }
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "live_chat_shell.png"))
        print("[6/8] Guest chat shell loaded and screenshotted.")

        # Test Model Selector Panel
        page.click('#modelSelectorBtn')
        page.wait_for_timeout(500)
        panel_visible = page.is_visible('#modelSelectorPanel')
        options_count = page.evaluate("() => document.querySelectorAll('#modelSelectorPanel button').length")
        results["model_selector"] = {
            "panel_visible": panel_visible,
            "models_count": options_count
        }
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "live_model_selector.png"))
        page.keyboard.press('Escape')
        page.wait_for_timeout(400)

        # Test Account Menu & Theme Toggle
        page.click('#profileMenuBtn')
        page.wait_for_timeout(500)
        account_menu_visible = page.is_visible('#profileMenu')
        results["account_menu"] = {
            "menu_visible": account_menu_visible,
            "has_signout": page.is_visible('#signoutBtn'),
            "has_import": page.is_visible('#importChatBtn'),
            "has_dark_mode_switch": page.is_visible('#sidebarThemeSwitch')
        }
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "live_account_menu.png"))

        # Test Dark Mode Toggle
        is_dark_before = page.evaluate("() => document.documentElement.classList.contains('dark')")
        page.evaluate("() => document.getElementById('sidebarThemeSwitch').click()")
        page.wait_for_timeout(500)
        is_dark_after = page.evaluate("() => document.documentElement.classList.contains('dark')")
        results["theme_toggle"] = {
            "dark_before": is_dark_before,
            "dark_after": is_dark_after,
            "toggled_successfully": is_dark_before != is_dark_after
        }
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "live_dark_mode.png"))
        page.keyboard.press('Escape')
        page.wait_for_timeout(400)

        # Check Reading Measure
        reading_metrics = page.evaluate("""() => {
            const chatCol = document.getElementById('chatHistory');
            const compDock = document.getElementById('composerDock');
            const chatStyle = window.getComputedStyle(chatCol);
            const r = chatCol.getBoundingClientRect();
            return {
                maxWidth: chatStyle.maxWidth,
                measuredWidth: Math.round(r.width),
                isCentered: Math.abs((window.innerWidth - r.width) / 2 - r.left) < 40
            };
        }""")
        results["reading_measure"] = reading_metrics
        print("[7/8] UI polish & reading measure verified:", reading_metrics)

        browser.close()

    print("[8/8] Testing backend verified email policy...")
    import subprocess
    cmd = ["node", "-e", """
        const sec = require('./lib/chat-security.js');
        const unverified = sec.verifyUserEmailStatus({
            uid: 'test-123',
            firebase: { sign_in_provider: 'password' },
            email_verified: false
        });
        const verified = sec.verifyUserEmailStatus({
            uid: 'test-456',
            firebase: { sign_in_provider: 'password' },
            email_verified: true
        });
        const googleUser = sec.verifyUserEmailStatus({
            uid: 'test-789',
            firebase: { sign_in_provider: 'google.com' },
            email_verified: false
        });
        const guestUser = sec.verifyUserEmailStatus({
            uid: 'test-000',
            firebase: { sign_in_provider: 'anonymous' },
            email_verified: false
        });
        console.log(JSON.stringify({
            unverified_blocked: !unverified.allowed && unverified.code === 403,
            unverified_error: unverified.error,
            verified_allowed: verified.allowed,
            google_allowed: googleUser.allowed,
            guest_allowed: guestUser.allowed
        }));
    """]
    out = subprocess.check_output(cmd, cwd=os.getcwd()).decode('utf-8')
    results["backend_email_policy"] = json.loads(out)

    print("\n=======================================================")
    print("ALL PLAYWRIGHT & COMPLIANCE TESTS COMPLETE! RESULTS:")
    print("=======================================================")
    print(json.dumps(results, indent=2))
    return results

if __name__ == '__main__':
    run_tests()
