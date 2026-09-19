import json, os, sys, time
from playwright.sync_api import sync_playwright

OUT = os.path.join(os.environ.get('TEMP', '/tmp'), 'abot-ui')
os.makedirs(OUT, exist_ok=True)
BASE = 'http://localhost:3000'
report = {}

def shot(page, name):
    page.screenshot(path=os.path.join(OUT, name + '.png'), full_page=False)

def measure_header(page, label):
    boxes = page.evaluate("""() => {
        const ids = ['sidebarToggle','chatTitle','renameChatBtn','headerNewChatBtn','modelSelectorBtn','searchToggleBtn','promptBtn','themeToggle'];
        const out = [];
        for (const id of ids) {
            const el = document.getElementById(id);
            if (!el) continue;
            const cs = getComputedStyle(el);
            if (cs.display === 'none') { out.push({id, hidden:true}); continue; }
            const r = el.getBoundingClientRect();
            out.push({id, x: Math.round(r.x), w: Math.round(r.width), right: Math.round(r.right)});
        }
        const vis = out.filter(o => !o.hidden && o.w > 0);
        vis.sort((a,b) => a.x - b.x);
        let overlaps = [];
        for (let i=1;i<vis.length;i++) if (vis[i].x < vis[i-1].x + vis[i-1].w) overlaps.push(vis[i-1].id + '<->' + vis[i].id);
        return {order: vis.map(v=>v.id), count: vis.length, totalWidth: vis.length ? vis[vis.length-1].right - vis[0].x : 0, overlaps, viewport: window.innerWidth};
    }""")
    report[label] = boxes
    print(label, json.dumps(boxes))

def run_session(p, label, w, h, is_mobile):
    browser = p.chromium.launch(headless=True, channel='chrome')
    ctx_args = dict(viewport={'width': w, 'height': h}, device_scale_factor=2)
    if is_mobile:
        ctx_args.update(is_mobile=True, has_touch=True, user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
    ctx = browser.new_context(**ctx_args)
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)[:200]))
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_timeout(1500)
    shot(page, label + '-auth')

    # guest sign-in
    try:
        page.click('#guest-signin-btn', timeout=8000)
        page.wait_for_selector('#app-container[style*="flex"], #app-container[style*="display: flex"]', timeout=25000)
        page.wait_for_timeout(2500)  # chats load / empty state renders
        shot(page, label + '-chat')
        measure_header(page, label + '-header')

        # composer + empty state zone
        page.focus('#messageInput')
        shot(page, label + '-composer-focus')

        # model selector panel
        page.click('#modelSelectorBtn')
        page.wait_for_timeout(400)
        shot(page, label + '-model-panel')
        panel_visible = page.evaluate("() => { const p = document.getElementById('modelSelectorPanel'); if (!p) return false; const r = p.getBoundingClientRect(); return !document.getElementById('modelSelectorPanel').classList.contains('hidden') && r.width > 0 && r.right <= window.innerWidth && r.left >= 0; }")
        report[label + '-modelPanelFits'] = panel_visible
        page.keyboard.press('Escape')
        page.wait_for_timeout(300)

        # message actions: inject two messages via the real renderer path
        page.evaluate("""async () => {
            const mod = await import('/js/chat.js');
            const st = await import('/js/state.js');
            const cid = st.state.activeChatId;
            if (!cid || !st.state.chats[cid]) return 'no-chat';
            st.state.chats[cid].messages.push(
                { role: 'user', content: 'Long-answer streaming test: explain how HTTP streaming works in depth.' },
                { role: 'assistant', content: '## Streaming\\nHTTP streaming sends bytes progressively...\\n\\n- chunk 1\\n- chunk 2\\n- chunk 3\\n\\n```js\\nconst res = await fetch(url);\\n```\\nMore prose follows here to make this message reasonably long.', model: st.state.chats[cid].model }
            );
            mod.renderActiveChat();
            return 'ok';
        }""")
        page.wait_for_timeout(600)
        shot(page, label + '-messages')
        actions = page.evaluate("""() => {
            const rows = [...document.querySelectorAll('.message-container')];
            return rows.map(r => ({
                btns: [...r.querySelectorAll('button')].map(b => b.className.split(' ')[0]).filter(c => /copy|speak|react|pin|edit|delete/.test(c))
            }));
        }""")
        report[label + '-messageActions'] = actions

        # streaming scroll behavior probe: scroll up, then simulate what chat.js does
        page.evaluate("() => { document.getElementById('chatHistoryContainer').scrollTop = 0; }")
        page.wait_for_timeout(200)
        st0 = page.evaluate("() => document.getElementById('chatHistoryContainer').scrollTop")
        page.evaluate("() => { const c = document.getElementById('chatHistoryContainer'); c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' }); }")
        page.wait_for_timeout(700)
        st1 = page.evaluate("() => document.getElementById('chatHistoryContainer').scrollTop")
        report[label + '-scrollProbe'] = {'scrollTopBefore': st0, 'scrollTopAfterForcedScroll': st1}
    except Exception as e:
        report[label + '-error'] = str(e)[:300]
    report[label + '-pageErrors'] = errors
    browser.close()

with sync_playwright() as p:
    run_session(p, 'desktop', 1440, 900, False)
    run_session(p, 'mobile', 390, 844, True)

print(json.dumps(report, indent=1))
