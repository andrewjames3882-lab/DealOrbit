# Multi-tenant DealOrbit — Implementation Checklist

This document is the concrete follow-up to the [multi-tenant plan](.cursor/plans/multi-tenant_hosted_dealorbit_519cc279.plan.md). It matches your current **app.js** state shape and **ws-server.js** behavior so you can implement per-rooftop login and data isolation with minimal rework.

---

## 1. Tech choice

| Layer      | Choice              | Notes |
|-----------|----------------------|------|
| **Backend** | Node + Express       | Fits your existing `ws-server.js` (Node) and is easy to extend. |
| **Database** | PostgreSQL           | Good for multi-tenant queries, JSONB for app-state blob if desired. Railway/Render/Supabase/Neon all support it. |
| **Auth**   | Session cookie + `rooftop_id` | Simpler than JWT for same-origin; store `userId`, `rooftopId`, `role` in server session. |
| **Hosting** | Railway or Render    | Run one Node process that serves static files + API; attach Postgres. Single URL for all rooftops. |

**Optional later:** Keep WebSocket for real-time sync **per rooftop** (scope `sharedState` by `rooftop_id` and broadcast only to that rooftop’s clients).

---

## 2. Data model (match current app state)

Your current state in **app.js** (and `sendStateToServer`) is:

```js
{
  managers, dealHistory, rotationOrder, dailyDeals, lastAssignedManager,
  historicalSpreadsheets, paymentBumpGoals, users, removedDeals, purchasePlan
}
```

Suggested schema:

### 2.1 Tables

- **rooftops**  
  - `id` (UUID PK), `name`, `plan_type` (e.g. standard/professional/enterprise), `max_users`, `created_at`, `updated_at`

- **users** (replaces in-app `users` for auth; app state can still keep a minimal copy for UI)  
  - `id` (UUID PK), `rooftop_id` (FK), `name`, `email` (unique **within** a rooftop), `username` (unique **within** a rooftop), `password_hash`, `role` (admin/desk/finance), `company`, `phone`, `needs_password_setup`, `created_at`, `updated_at`
  - Recommended constraints/indexes: unique on `(rooftop_id, lower(email))` and `(rooftop_id, lower(username))` to enforce case-insensitive uniqueness per rooftop.

- **app_state** (one row per rooftop — simple and matches your blob)  
  - `rooftop_id` (PK, FK), `state` (JSONB):  
    `{ managers, dealHistory, rotationOrder, dailyDeals, lastAssignedManager, historicalSpreadsheets, paymentBumpGoals, removedDeals, purchasePlan }`  
  - `updated_at`  
  - Note: **users** for the app UI can either be read from the `users` table (by `rooftop_id`) or duplicated in `state.users` for compatibility. If you store users in DB (recommended), treat `state.users` as a **read-only, derived** field returned by the API on load; it should not be persisted inside `app_state.state` and should be ignored/stripped on save.

So:

- **Rooftops**: one row per dealership.
- **Users**: one row per person, with `rooftop_id` so each rooftop has its own login set.
- **App state**: one JSON blob per rooftop; all reads/writes scoped by `rooftop_id` from the authenticated user’s session.

---

## 3. Backend API (Express)

Base URL: same origin as the frontend (e.g. `https://app.dealorbit.com`).

### 3.1 Auth

- **POST /api/auth/signup**  
  - Body: `name, email, company, phone, role, password` (and optionally `rooftopName` to create a new rooftop).  
  - Logic: create rooftop if new org, then create user with `rooftop_id`; create session with `userId`, `rooftopId`, `role`; set session cookie; return `{ user: { id, name, email, role, company, username }, rooftopId }`.

- **POST /api/auth/login**  
  - Body: `rooftopSlug` (or `rooftopId`) + `usernameOrEmail` + `password` (or infer rooftop from the request host/path, e.g. `acme.dealorbit.com` or `/r/acme/login`).  
  - Logic: resolve `rooftop_id` from `rooftopSlug` (or host/path), then find the user by `(rooftop_id, username/email)`, verify password, create session, return same shape as signup.  
  - Alternative (not recommended unless you really want it): if you instead enforce **global** uniqueness for email/username (not “per rooftop”), you can omit rooftop context at login.

- **POST /api/auth/logout**  
  - Clear session cookie; return 204.

- **GET /api/auth/me**  
  - Require auth. Return `{ user, rooftopId }` from session (used on load to restore `currentUser` and rooftop context).

- **POST /api/auth/set-password** (first-time or reset)  
  - Body: `code` (if reset), `newPassword`.  
  - Logic: validate code or “needs password setup”; update `password_hash`; clear `needs_password_setup`; return 200.

- **POST /api/auth/forgot-password**  
  - Body: `rooftopSlug` (or `rooftopId`) + `email` (or infer rooftop from host/path).  
  - Logic: resolve `rooftop_id`, find user by `(rooftop_id, email)`, generate token/code, send email (or store code and return success). Same pattern you have with `pendingPasswordResetCodes` but keyed by `rooftop_id` + email.

### 3.2 State (per rooftop)

- **GET /api/state**  
  - Require auth. Use `rooftop_id` from session. Load `app_state.state` for that rooftop; **augment** it with `users` from the `users` table for that rooftop so the frontend can keep using `state.users` if needed. Return `{ state }`. (If users are DB-managed, `state.users` is derived and not stored in `app_state.state`.)

- **PUT /api/state** (or **POST** if you prefer)  
  - Require auth. Body: `{ state }` where `state` excludes DB-owned auth data (notably `users`). Use session `rooftop_id`; upsert `app_state` for that rooftop. **If `state.users` is present anyway, the server should ignore/strip it** to avoid source-of-truth conflicts. Return 200.

All state routes must **ignore** any `rooftop_id` in the request body and use only the one from the session.

### 3.3 Optional: WebSocket per rooftop

- Upgrade from same origin; after connection, associate the client with `rooftop_id` from session (e.g. cookie or first message with token).  
- Keep a map: `rooftop_id -> Set<ws>`. On `state_update`, update in-memory (or DB) state for that rooftop and broadcast only to that rooftop’s clients.  
- v1 can skip WebSocket and use “load on login + save on change” with GET/PUT state only.

---

## 4. Environment variables

- **DATABASE_URL** — Postgres connection string (e.g. from Railway/Render/Neon).  
- **SESSION_SECRET** — Strong random string for signing session cookies.  
- **PORT** — Server port (default 8000 to align with current `ws-server.js`).  
- Optional: **SMTP_*** or email service for forgot-password.

---

## 5. Frontend hooks in `app.js`

Exact places to change so the app uses the backend as source of truth when logged in (per rooftop), and falls back to localStorage when not (or force login before using app).

### 5.1 Auth

- **Login**  
  - Replace the current login form submit handler (around **~2983–3132**) with a **POST /api/auth/login**. On success, set `currentUser` and optionally `currentRooftopId` from response; **do not** store password. Then call `loadStateFromServer()` and `showControlCenter()`.

- **Signup**  
  - Replace signup submit (around **~3503–3588**) with **POST /api/auth/signup**. On success, set `currentUser` from response; then `loadStateFromServer()` (will get empty or default state for new rooftop) and `showControlCenter()`.

- **Logout**  
  - In `logout()` (**~3206**): call **POST /api/auth/logout**, then clear `currentUser`, clear any in-memory state if desired, and redirect to `#login`.

- **Session restore**  
  - On **DOMContentLoaded**, after `loadState()`, call **GET /api/auth/me**. If 200, set `currentUser` (and `currentRooftopId`) from response; then call `loadStateFromServer()` and skip or overwrite localStorage for that session. If 401, keep or clear localStorage and show login/landing.

### 5.2 State load/save

- **loadState()** (**~304–372**)  
  - Keep as-is for “no backend” or offline. When backend is present and user is logged in, prefer loading from API (see below).

- **New: loadStateFromServer()**  
  - **GET /api/state** (with credentials so session cookie is sent). On success, call your existing `applyRemoteState(response.state)` so the same logic that today applies WebSocket updates will apply the server state. Optionally then call `saveStateToLocalStorage()` so a refresh still has last known state if API is down.

- **saveState()** (**~375–379**)  
  - Keep `saveStateToLocalStorage()` for offline/cache. Add: when `currentUser` (and backend) is present, **PUT /api/state** with the same state object **minus DB-owned fields** (send: managers, dealHistory, rotationOrder, dailyDeals, lastAssignedManager, historicalSpreadsheets, paymentBumpGoals, removedDeals, purchasePlan). Send credentials. On failure, you can retry or show a “sync failed” message.

- **sendStateToServer()** (**~133–207**)  
  - For v1 multi-tenant, you can either:  
    (a) Replace this with the same **PUT /api/state** call used in `saveState()`, and remove or refactor WebSocket/polling to the new backend later, or  
    (b) Keep WebSocket but have the server scope state by `rooftop_id` and only broadcast to that rooftop’s clients.  
  - In both cases, send auth (cookie or token) so the server can scope by rooftop, and avoid sending DB-owned fields (e.g. `users`) as part of the state payload.

### 5.3 User management (Control Center)

- **Users list**  
  - When backend is used, users can come from **GET /api/state** (if you embed users in state) or from a dedicated **GET /api/users** that returns users for the current rooftop. Your existing `users` array can be filled from that response.

- **Add/Edit/Delete user**  
  - Replace in-memory `users.push` / updates with **POST /api/users**, **PATCH /api/users/:id**, **DELETE /api/users/:id** (all scoped by session `rooftop_id`). Then refresh state or refetch users and run `applyRemoteState` so the UI stays in sync.

- **Password set on first login / forgot password**  
  - Use **POST /api/auth/set-password** and **POST /api/auth/forgot-password** instead of updating in-memory `users` and `pendingPasswordResetCodes`.

### 5.4 Demo bypass (optional)

- Remove or guard the “bypass login for demo” block (around **~2461–2475**) so production always goes through the real login and rooftop-scoped state.

---

## 6. Suggested order of implementation

1. **DB + migrations**  
   Create `rooftops`, `users`, `app_state`; add unique indexes on `users(rooftop_id, lower(email))` and `users(rooftop_id, lower(username))`.

2. **Express app**  
   Create an Express app; add session middleware (e.g. `express-session` with Postgres store or Redis); serve static files from the same app (or keep current static server and proxy API to Express).

3. **Auth routes**  
   Implement signup, login, logout, **GET /api/auth/me**, set-password, forgot-password (minimal: store code in DB).

4. **State routes**  
   Implement **GET /api/state** and **PUT /api/state** with rooftop scoping from session.

5. **Frontend: auth**  
   Wire login, signup, logout, and session restore to the new API; keep existing UI and role checks.

6. **Frontend: state**  
   Add `loadStateFromServer()`; in `saveState()` and (if still used) `sendStateToServer()`, add PUT to **/api/state** when logged in.

7. **User management API (optional)**  
   Add CRUD for users per rooftop; then wire Control Center user add/edit/delete to these endpoints.

8. **WebSocket (optional)**  
   Add rooftop-scoped WebSocket so multiple tabs/devices for the same rooftop still sync in real time.

9. **Deploy**  
   Deploy Node app + static assets to Railway/Render; attach Postgres; set `DATABASE_URL`, `SESSION_SECRET`, and `PORT`.

---

## 7. Summary

- **One URL**, one backend, one DB; **rooftops** and **users** tables with `rooftop_id`; **app_state** one blob per rooftop.
- **Auth**: session cookie; every API request validated and scoped by `rooftop_id` from session.
- **Frontend**: same `app.js` state shape; swap “where it’s stored” (API + optional WebSocket) and “who is logged in” (backend auth). Use `applyRemoteState` for both WebSocket and initial load from API.
- **Hosting**: single Node process serving static files + Express API; Postgres for persistence; env vars for `DATABASE_URL` and `SESSION_SECRET`.

If you want, next step can be: (1) adding a minimal Express API and DB schema in this repo (e.g. `server/` and `migrations/`), or (2) implementing one slice (e.g. auth only or state GET/PUT only) end-to-end.
