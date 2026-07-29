# Project Target List

This document tracks the current development state of the ECAT-CBT platform.

## 🟢 Completed
- [x] **Enhanced Content Library:** Chapter-wise browsing with question counts & mastery tracking.
- [x] **Targeted Practice Engine:** Practice specific chapters with customizable question counts.
- [x] **On-the-Fly AI Augmentation:** Automatically generate/save new questions when pool is low.
- [x] **DB Limit Expansion:** Increased capacity to 1500 questions.
- [x] **CBT Persistence:** Session restoration on page refresh.
- [x] **Study Mode:** Instant feedback with explanations & tricks.
- [x] **Admin Analytics:** Platform-wide metrics, activity trends, and subject performance.
- [x] **Admin Settings:** Configurable platform parameters (time, email, maintenance mode).
- [x] **Support Ticketing System:** Student-to-Admin communication channel.
- [x] **Admin Review Queue:** Subject-wise AI-generated content auditing.

## 🔵 Future Considerations
- [x] **Advanced Error Boundaries:** React Error Boundaries implemented to catch runtime failures and provide graceful recovery UI.
- [x] **Protected Demo Mode:** Root-protected `Demo@CBT.com` account for instant real-time admin testing.
- [x] **Production Config & CORS:** Dynamic environment API routing (`VITE_API_URL`) & configurable CORS origins for deployment.

## 🔵 Future Considerations (Post-V1 Release)
- [ ] **Global Leaderboard:** Implement a "Top Scorers" board to encourage competition (Deferred to V2).
- [ ] **TypeScript Migration:** Gradual move to TS for core logic.
- [ ] **Automated Migrations:** Move from raw SQL `db:setup` to Prisma Migrate for production stability.
