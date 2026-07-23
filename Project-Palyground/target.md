# Project Target List

This document tracks the current development state of the ECAT-CBT platform after a deep codebase audit.

## 🟢 Verified Existing Features
- [x] **CBT Persistence:** `TestWindow.jsx` automatically saves and restores sessions via `localStorage` on page refresh.
- [x] **Admin Review Queue:** `AdminReviewQueue.jsx` handles auditing of unapproved AI-generated content.
- [x] **Performance Charts:** `Dashboard.jsx` (User Analytics) and `TestResultPage.jsx` (Test Feedback) already utilize Chart.js for data visualization.
- [x] **Targeted Practice Engine:** Students can select specific chapters and question counts for practice.

## 🟡 Real Remaining Gaps (High Priority)

### 1. Visual Mastery Tracking
- [ ] **Frontend Integration:** Update `ContentLibrary.jsx` to fetch student analytics and display a "Mastery Percentage" progress bar for every chapter (currently only shows total question counts).
- [ ] **Subject Overview:** Show an aggregate mastery score for the entire subject in the sidebar.

### 2. Study Mode (Instant Feedback)
- [ ] **Mode Selection:** Add a "Study Mode" toggle in the Content Library start panel.
- [ ] **Interactive Feedback:** Update `TestWindow.jsx` logic:
    - In Study Mode, hide the "Save and Next" button initially.
    - Show a "Check Answer" button.
    - Upon clicking, reveal the correct answer, explanation, and pro-tips immediately.
    - Then show the "Next" button.

### 3. AI Staging Logic Refinement
- [ ] **Instant Use of Generated Qs:** Currently, `groqService.js` marks new questions as `isApproved: false`, preventing them from being used in the session that triggered their generation.
- [ ] **Logic Fix:** Modify `generateChapterPractice` to allow the current session to include newly generated (unapproved) questions, or auto-approve them for practice sessions while keeping them unapproved for "Standard Exam" modes.

## 🔵 Future Enhancements

### 🚀 UX & Features
- [ ] **Iconography:** Add descriptive icons (FontAwesome/React Icons) to the sidebar and dashboard buttons for better accessibility.
- [ ] **Global Leaderboard:** Implement a "Top Scorers" board to encourage competition.
- [ ] **Daily Challenge:** A system-generated 10-question daily test for consistency.

### 🛠️ Technical Debt
- [ ] **TypeScript Migration:** Transition the `TestWindow` and `groqService` to TypeScript.
- [ ] **Error Boundaries:** Add React Error Boundaries to prevent total page crashes on API failures.
