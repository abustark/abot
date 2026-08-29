# Firestore Rules — Deployment Guide (OWNER ACTION, ~2 minutes)

`firestore.rules` at the repo root locks chat data to its owner:
- `users/{uid}/chats/{chatId}` → readable/writable ONLY by the matching authenticated user
- everything else → denied

Until you deploy this, your data is protected by app logic only — the database itself
still allows any signed-in user to read any path. Deploy it once, forget it.

---

## Option A — Firebase Console (easiest, no tools needed)

1. Open https://console.firebase.google.com → select project **abot-cloud**
2. Left sidebar: **Build → Firestore Database**
3. Top tabs: **Rules**
4. Open `firestore.rules` from this repo, **copy the entire file contents**, paste over
   whatever is in the console editor
5. Click **Publish**
6. Verify: while signed in as user A, the app still loads your chats; nothing else changes
   (rules only RESTRICT, the app's queries are already owner-scoped)

## Option B — Firebase CLI

```bash
npm install -g firebase-tools
firebase login                       # opens browser
firebase deploy --only firestore:rules --project abot-cloud
```
(`firebase.json` in the repo root already points at `firestore.rules`.)

## Verify the rules are live
Firebase Console → Firestore → Rules → the editor should show the pasted content with
a "Published" timestamp. Attempting a foreign-user read from any client now fails with
`permission-denied`.

## If you add shared features later
(e.g. chat sharing via link) — those paths need their own match blocks in
`firestore.rules`. Scope them narrowly and re-deploy.
