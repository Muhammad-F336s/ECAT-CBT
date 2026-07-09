# Project Target List

This document consolidates the remaining technical debt and potential feature enhancements for the ECAT-CBT project. 

## 🟢 Completed (from UNIMPLEMENTED_FEATURES.md)
The following core architectural gaps have been resolved:
- [x] Dynamic Test Configuration (Routing & Form Data)
- [x] Multi-Subject & Chapter Test Generation
- [x] Admin Content Library Persistence (DB Schema & CRUD)
- [x] AI-Driven Pedagogy (Chain of Thought & Exam Tricks)
- [x] Static Question API (Implemented via chapter practice endpoints)
- [x] Student Content Library UX & Flow (Fixed redirection, UI contrast, and subject switching)

## 🟡 Pending / Potential Improvements
Based on a codebase audit, the following areas could be improved or are partially implemented:

### 1. Backend & Database
- [ ] **Migration Strategy:** The project currently relies on `db:setup` (running a raw SQL file). Implementing a proper migration tool (like Prisma Migrate) would be safer for production.
- [ ] **Advanced Analytics:** The current `getUserAnalytics` provides a basic history. Adding subject-wise strength/weakness analysis would be a high-value addition.

### 2. Frontend & UX
- [ ] **Test Window Robustness:** Enhancing the "Test Window" to handle edge cases like page refreshes during an active exam (persistence of answers in localStorage).
- [ ] **Result Visualization:** Converting the `TestResultPage` lists into visual charts (e.g., using Chart.js or Recharts) for better student insight.
- [ ] **Admin UX:** Adding search/filter capabilities to the student and admin lists for faster management.

### 3. AI Integration
- [ ] **AI-Generated Content Review:** Implement a "Review & Approve" workflow where admins can audit AI-generated questions before they enter the permanent question pool.
- [ ] **Dynamic Difficulty Tuning:** Implementing a system where the AI adjusts difficulty based on the student's previous attempt scores.

## 🛠️ Technical Debt
- [ ] **Error Handling:** Standardizing API error responses across all controllers.
- [ ] **Type Safety:** While using Prisma, the project is primarily JS. Transitioning critical paths to TypeScript would reduce runtime errors.
