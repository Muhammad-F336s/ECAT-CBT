# Unimplemented and Partially Disconnected Features

This document outlines the features in the ECAT CBT Simulator project that are currently unimplemented, partially disconnected, or mocked out.

---

## 1. Dynamic Test Configuration Integration (Form $\rightarrow$ CBT Simulator)

### Current Status
The **Test Configuration Form** ([`TestModeForm.jsx`](file:///e:/ECAT-CBT/Project-Palyground/src/components/TestModeForm.jsx)) allows students to choose subjects, chapters, quantity of questions, difficulty level, negative marking, and test mode. However, when they submit the form:
- The navigation sends `formData` via router state to `/test/cbt`.
- The CBT Simulator ([`TestWindow.jsx`](file:///e:/ECAT-CBT/Project-Palyground/src/components/TestWindow.jsx)) completely ignores this router state.
- `TestWindow.jsx` is mounted in [`App.jsx`](file:///e:/ECAT-CBT/Project-Palyground/src/App.jsx) with a hardcoded `subjectId` (the active Physics ID), and the window hardcodes `totalQuestions: 5`.

### Required Work
1. Update `TestWindow.jsx` to read `formData` from `useLocation().state`.
2. Replace the hardcoded `totalQuestions: 5` and `subjectId` in `loadTest()` with the dynamic parameters from `formData`.
3. Hook up the timer, negative marking flags, and mode (practice vs. real-time) within the simulator.

---

## 2. Multi-Subject & Chapter Test Generation (Backend API)

### Current Status
The backend API endpoint `/api/test/generate` (handled by `generateTest` in [`testController.js`](file:///e:/ECAT-CBT/Project-Palyground/server/src/controllers/testController.js)) is designed to handle queries for only a **single** `subjectId` and an optional list of `chapterIds`. It does not support selecting and distributing questions across multiple subjects (e.g., Math + Physics + Chemistry as chosen in Pre-Engineering/ICS fields).

### Required Work
1. Update `/api/test/generate` to accept an array of `subjectIds` and the specific question counts per subject.
2. Modify the database queries in `testController.js` to fetch and shuffle questions proportionally from each selected subject/chapter.

---

## 3. Admin Content Library Persistence (Fully Mocked)

### Current Status
The **Content Library** ([`AdminContentLibrary.jsx`](file:///e:/ECAT-CBT/Project-Palyground/src/components/AdminContentLibrary.jsx)) provides a detailed UI to upload study materials (PDFs, docs) and organize them by groups/topics. However, all data is stored in client-side mock React state (`useState`). There are no tables for these in `schema.prisma`, and no backend endpoints have been built.

### Required Work
1. Add new models in [`schema.prisma`](file:///e:/ECAT-CBT/Project-Palyground/server/prisma/schema.prisma):
   - `ResourceGroup` (e.g., name, description)
   - `ResourceFile` (e.g., name, size, type, downloads count, URL/path)
   - `ResourceItem` (learning checkpoints/topics)
2. Run database migrations to create the tables in Neon.
3. Write backend routes and controllers for CRUD operations on content groups, files, and items.
4. Replace client-side mocks in `AdminContentLibrary.jsx` with Axios requests (`API.get`, `API.post`, etc.).

---

## 4. Subject, Chapter, & Question Management GUI (Admin Panel)

### Current Status
The database models for `Subject`, `Chapter`, `Question`, and `Option` exist, but there is no graphical interface for admins to create, update, or delete them. They can only be populated using raw node scripts (like `seed.js` or `generateQuestions.js`).

### Required Work
1. Build a new administration dashboard view (e.g., `/admin/content-manager` or `/admin/questions`) in the frontend.
2. Create Express API endpoints for creating, editing, and deleting subjects, chapters, questions, and options.
3. Connect the frontend view to these endpoints so admins can expand and maintain the CBT question pool without code modifications.
