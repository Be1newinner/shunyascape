# Code Rules

## 1. General Development

- **TypeScript First**: Use TypeScript by default. Fix all lint errors, TypeScript compilation issues, and build errors prior to completing tasks.
- **Maintain Comments**: Preserve unrelated comments and docstrings.
- **Aesthetic Excellence**: UI designs must feel premium, visual-heavy, using responsive elements, gradients, tailored colors (HSL), Outfit/Inter typography, and animations. No generic CSS. No plain red/green/blue.

## 2. Authentication & Session Management

- **Token Lifetimes**:
  - Access Token: 1 day validity.
  - Refresh Token: 1 month (30 days) validity.
- **Token Storage**: Store Access and Refresh tokens in HTTP-only, SameSite=Lax cookies to enable automatic, secure transmission.
- **Strict Single-System Login**:
  - Enforce that a user can only be logged in from one device/system at a time.
  - On login or registration, update the database user document with a new random `currentSessionId` and `currentRefreshToken`.
  - On every authenticated API call, cross-reference the session ID inside the access/refresh tokens with the database record. If there is a mismatch, return `401 Unauthorized` immediately.
- **Client Handling of Session Invalidation (401)**:
  - Intercept 401 responses on all API endpoints (polling, position updates, action calls).
  - Dispatch a global `auth-unauthorized` custom window event.
  - The main component must listen for `auth-unauthorized`, clear `localStorage`, reset component state, destroy simulation states, and display a session expired message.

## 3. CUSTOM RULES

- use pnpm as package manager
- never read .env file
- read .env.sample file
- after every modification in feature add it in docs/current-features.md
