# Project Target List

This document consolidates the remaining technical debt and potential feature enhancements for the ECAT-CBT project. 

## 🟢 Completed (from UNIMPLEMENTED_FEATURES.md)
The following core architectural gaps and features have been resolved:
- [x] Dynamic Test Configuration (Routing & Form Data)
- [x] Multi-Subject & Chapter Test Generation
- [x] Admin Content Library Persistence (DB Schema & CRUD)
- [x] AI-Driven Pedagogy (Chain of Thought & Exam Tricks)
- [x] Static Question API (Implemented via chapter practice endpoints)
- [x] Student Content Library UX & Flow (Fixed redirection, UI contrast, and subject switching)
- [x] **Test Window Robustness:** Implemented complete answer, skipped/locked question, and timing state recovery from `localStorage` in `TestWindow.jsx` across page refreshes.
- [x] **Result Visualization:** Integrated `react-chartjs-2` and `chart.js` with interactive performance breakdowns (Correct, Wrong, Skipped) displayed as a visual `Doughnut` chart in `TestResultPage.jsx`.
- [x] **Admin UX:** Fully integrated multi-level search and status filtering (All, Approved, Pending, Frozen) across student directory, admin directories, recipient selections, and question banks.

## 🟡 Pending / Potential Improvements
Based on a codebase audit, the following areas could be improved or are partially implemented:

### 1. Backend & Database
- [ ] **Migration Strategy:** The project currently relies on `db:setup` (running a raw SQL file) and Prisma db push. Implementing a proper migration tool (like Prisma Migrate) would be safer for production.
- [ ] **Advanced Analytics:** The current `getUserAnalytics` provides a basic history. Adding subject-wise strength/weakness analysis would be a high-value addition.

### 2. AI Integration
- [ ] **AI-Generated Content Review:** Implement a "Review & Approve" workflow where admins can audit AI-generated questions before they enter the permanent question pool (e.g. by setting an `isApproved` flag on questions or staging them).
- [ ] **Dynamic Difficulty Tuning:** Implementing a system where the AI adjusts difficulty based on the student's previous attempt scores.

## 🛠️ Technical Debt
- [ ] **Error Handling:** Standardizing API error responses across all controllers.
- [ ] **Type Safety:** Transitioning critical paths (e.g., API schemas, service layers, components) to TypeScript to prevent runtime errors.
