# Padi-Smart-Aid

Paddy farm management system for Malaysian farmers — disease detection, farm tracking, tasks, weather, and AI analysis.

## Structure

```
padi-smart-aid/
├── backend/        Express + TypeScript API (Drizzle ORM + PostgreSQL)
└── frontend/       React + Vite frontend (Firebase Auth + Firestore)
```

---

## Backend Setup

```bash
cd backend
npm install
```

Create `.env` (see `.env.example`):
```env
DATABASE_URL=postgresql://user:password@localhost:5432/padicare
PORT=3000
SESSION_SECRET=your-secret-key
GEMINI_API_KEY=your-gemini-api-key   # optional
```

Push DB schema and run:
```bash
npx drizzle-kit push
npm run dev
```

### API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/health | — | Health check |
| POST | /api/auth/register | — | Register |
| POST | /api/auth/login | — | Login |
| POST | /api/auth/logout | — | Logout |
| GET | /api/auth/me | ✓ | Current user |
| GET/POST | /api/farms | ✓ | List / Create farm |
| GET/PUT/DELETE | /api/farms/:id | ✓ | Get / Update / Delete farm |
| POST | /api/farms/:id/issues | ✓ | Add farm issue |
| GET/POST | /api/tasks | ✓ | List / Create task |
| PUT/DELETE | /api/tasks/:id | ✓ | Update / Delete task |
| POST | /api/disease/detect | ✓ | Disease detection (mock) |
| GET | /api/disease/history | ✓ | Detection history |
| POST | /api/ai/disease | — | Gemini AI disease analysis |
| GET | /api/weather | ✓ | Weather data |
| GET | /api/dashboard/summary | ✓ | Dashboard stats |

---

## Frontend Setup

```bash
cd frontend
npm install
```

Create `.env` (see `.env.example`) with your Firebase credentials:
```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Run (make sure backend is running on port 3000 first):
```bash
npm run dev
```

The Vite dev server proxies `/api` requests to `http://localhost:3000`.

---

## Firebase Setup (Frontend Auth)

1. Create a project at https://console.firebase.google.com
2. Enable **Authentication** → Email/Password
3. Enable **Firestore Database** → Create database
4. Set Firestore Rules to allow authenticated users to read/write their own data:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

5. Copy your Firebase config values into `frontend/.env`
