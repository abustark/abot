# Firestore Rules — Deployment (Phase 1)

`firestore.rules` at the repo root locks chat data to its owner:

- `users/{uid}/chats/{chatId}` → readable/writable **only** by the matching authenticated user
- everything else → denied

## Deploy

**Option A — CLI:**
```bash
npm i -g firebase-tools
firebase login
firebase use <your-project-id>
firebase deploy --only firestore:rules
```

**Option B — Console:** Firebase Console → Firestore Database → Rules → paste the file contents → Publish.

## Verify after deploy
Try reading another user's document from any authenticated session → should be denied (`permission-denied`).
