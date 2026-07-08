# Project Issues & Improvement Roadmap

This document tracks the technical shortcomings and architectural gaps of the ECAT-CBT Project-Palyground. Each issue will be marked as `[ ]` (Pending) or `[x]` (Resolved).

## ?? Critical / High Priority (Security & Architecture)
- [ ] **Server Entry Point Redundancy**: Duplicate server logic in `server/src/app.js` (Express) and `server/src/index.js` (Native HTTP). Need to unify into a single Express server.
- [ ] **Authentication State Security**: User identity and roles are managed via `localStorage`, which is vulnerable to client-side manipulation.
- [ ] **Missing Input Validation**: No structured validation (e.g., Zod/Joi) for incoming API requests on the backend, increasing vulnerability to malformed data.
- [ ] **CSRF Protection**: Missing Cross-Site Request Forgery protection on the backend API.

## ?? Medium Priority (Code Quality & Scalability)
- [ ] **Frontend Component Bloat**: `src/App.jsx` is too large and handles too many responsibilities (Routing, Sidebar, Layout, Auth logic).
- [ ] **Hardcoded Subject IDs**: `ACTIVE_SUBJECT_ID` is hardcoded in `src/App.jsx`. This should be fetched dynamically from the database.
- [ ] **Lack of Centralized Error Handling**: Backend controllers lack a unified error handling middleware, leading to repetitive try-catch blocks.
- [ ] **Missing Type Safety**: The project is using plain JavaScript. Introducing TypeScript or JSDoc would reduce runtime errors.

## ?? Low Priority (DX & Maintenance)
- [ ] **Zero Test Coverage**: No unit or integration tests are present in the project.
- [ ] **Documentation Gaps**: While `README.md` exists, detailed API documentation (Swagger/OpenAPI) is missing.
- [ ] **Linting & Formatting**: Standardizing code style across the project.

---
*Last Updated: 2026-07-08*
