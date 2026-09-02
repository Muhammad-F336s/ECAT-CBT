# ECAT-CBT — project context map

> Purpose: a small, durable reference for future work. Read this first, then open
> only the files relevant to the requested change. Update this document whenever
> the architecture, routes, or commands materially change.

## What this is

An ECAT entrance-test CBT platform with student and administrator experiences.

- Frontend: React 19 + Vite, JavaScript/JSX, React Router 7, Axios, Chart.js,
  KaTeX/React Latex.
- Backend: Express 5, Prisma 7, Neon/PostgreSQL; JWT and bcrypt authentication.
- AI: Groq-powered question generation and a Vector Bot study mentor; OpenAI is
  also configurable.
- AI provider administration: `/admin/settings` has a secret-code-protected
  Groq model/key panel. Saved keys are AES-GCM encrypted server-side, never
  returned to the browser, and changes alert the Root Owner email.

## Run and configuration

```powershell
# project root: frontend at http://localhost:5173
npm run dev

# backend at http://localhost:8787
npm run dev:server

# backend database/Prisma checks
npm --prefix backend run prisma:validate
npm --prefix backend run prisma:generate
npm --prefix backend run db:setup
npm --prefix backend run prisma:seed
```

- Frontend environment: `frontend/.env`, chiefly `VITE_API_URL`.
- Backend environment: `backend/.env`; needs `DATABASE_URL`, `JWT_SECRET`, and
  production `CLIENT_ORIGIN`; OAuth, email, Groq and OpenAI credentials are optional.
- Set `AI_CONFIG_ENCRYPTION_KEY` before saving a Groq key through the admin UI.
  It must be a separate, stable server secret; losing it prevents decrypting
  saved keys (replace the key through the UI in that case).
- Vite proxies `/api` to port 8787. `frontend/src/utils/api.js` also defaults to
  `http://localhost:8787/api` and adds `Authorization: Bearer <localStorage token>`.

## Key frontend locations

| Concern | Primary files |
|---|---|
| App boot, authentication, role shells and routes | `frontend/src/App.jsx`, `frontend/src/main.jsx` |
| Shared API client | `frontend/src/utils/api.js` |
| Student dashboard / test flow | `components/UserDashboard.jsx`, `Dashboard.jsx`, `TestModeSelection.jsx`, `TestModeForm.jsx`, `TestWindow.jsx`, `TestResultPage.jsx` |
| Student support/profile/progress/resources | `SupportPage.jsx`, `ProfilePage.jsx`, `ProgressPage.jsx`, `ContentLibrary.jsx` |
| Student onboarding | `OnboardingScreen.jsx` |
| AI mentor | `VectorBotWidget.jsx` |
| Administrator experience | `App.jsx` (`AdminAppShell`) plus `components/Admin*.jsx` |
| Styling | component-specific `.css`, `frontend/src/App.css`, `index.css`, `responsive.css` |

Student routes: `/dashboard`, `/progress`, `/library`, `/test`, `/test/form`,
`/test/cbt`, `/test/result/:attemptId`, `/profile`, `/support`, `/interests`.

Administrator routes: `/admin/dashboard`, `/admin/approvals`, `/admin/students`,
`/admin/messages`, `/admin/administration`, `/admin/content-library`,
`/admin/questions`, `/admin/review-queue`, `/admin/approved-questions`,
`/admin/analytics`, `/admin/tests`, `/admin/settings`, `/admin/support`.

## Key backend locations

| Concern | Primary files |
|---|---|
| Express app and middleware | `backend/src/app.js` |
| Prisma client | `backend/src/db.js` |
| Prisma data model | `backend/prisma/schema.prisma` |
| Legacy/setup SQL and DB initialisation | `backend/sql/schema.sql`, `backend/src/setupDatabase.js` |
| Authentication | `routes/authRoutes.js`, `controllers/authController.js`, `middleware/auth.js`, `middleware/adminAuth.js` |
| Test generation, submission and results | `routes/testRoutes.js`, `controllers/testController.js` |
| Users, analytics, support and Vector Bot | `routes/userRoutes.js`, `controllers/userController.js`, `controllers/vectorBotController.js` |
| Admin operations and question bank | `routes/adminRoutes.js`, `controllers/adminController.js`, `controllers/adminQuestionController.js` |
| Test/university management | `routes/adminTestRoutes.js`, `controllers/adminTestController.js` |
| Onboarding exams/interests | `routes/examRoutes.js`, `controllers/examController.js` |
| Content resources | `routes/resourceRoutes.js`, `controllers/resourceController.js` |
| AI question service | `backend/src/services/groqService.js` |

Mounted API prefixes in `backend/src/app.js`:

- `/api/auth` — signup/login, password reset, email OTP, Google/GitHub OAuth.
- `/api/admin` — admin settings, users, messages, analytics, support, questions.
- `/api/admin-tests` — universities, entry tests and parsed test patterns.
- `/api/test` — syllabus/content metadata, generated tests, submissions/results.
- `/api/user` — current user, profile, analytics, support tickets, Vector Bot.
- `/api/resources` — student resource reads and admin resource management.
- `/api/exams` — onboarding data and selected interests.

## Data model (Prisma)

`User`, `Admin`, `PlatformConfig`, `LoginMessage`, `Subject` → `Chapter` →
`Question` → `Option`, `TestAttempt`, `ResourceGroup` → (`ResourceFile`,
`ResourceItem`), `SupportTicket`, `ExamCategory`, `University`, `EntryExam`,
and its one-to-one `TestPattern`, plus `ImpersonationLog`.

Important business rules visible in code: user roles include student/admin;
questions can be pending/approved/flagged; test attempts hold a JSON breakdown;
students may have package and attempt limits; users can be frozen after false
support reports; and onboarding stores selected universities and exams.

## Notes / caution points

- `backend/STRUCTURE.md` and `backend/Flow.md` contain historical references to
  a `server/` layout. The active runtime is `backend/src/app.js` with Prisma.
- Do not put credentials in frontend variables or commit either `.env`.
- Before editing test logic, inspect both `TestWindow.jsx` and
  `backend/src/controllers/testController.js`; scoring constants/features exist
  on both client and server.
- Before changing schema, update Prisma migration/schema and assess the legacy
  SQL setup path for consistency.
- `git status` cannot currently run in this sandbox because Git flags parent
  directory ownership as dubious; no safe-directory configuration was changed.
