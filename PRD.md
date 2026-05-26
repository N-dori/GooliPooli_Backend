# Golipooli — Product Requirements Document

**Version:** 1.0  
**Platform:** Mobile-first PWA (Next.js 15) + Express 5 API  
**Roles:** `admin` · `project_manager` · `worker`

---

## 1. Mental model

| Term | Meaning |
|------|---------|
| **Project** | A named bundle of clients in the same geographic area (e.g. "North Beach Route"). Represents a recurring work route. |
| **Work Day** | A specific calendar date on which a project runs. Modelled as a `visit` row per client per date. |
| **Work Diary** | The default view for all users — a month-paginated calendar showing work days and client cards. |
| **Client** | A physical location (pool) that belongs to exactly one project. |
| **Visit** | One service call: one client + one date + one assigned worker. |

---

## 2. Roles & permissions matrix

| Action | worker | project_manager | admin |
|--------|--------|----------------|-------|
| View Work Diary | Own visits only | All visits in managed projects | All visits |
| Edit visit report | Own visits only | Any visit | Any visit |
| View client details | Read-only | Read + edit | Full CRUD |
| Add / remove clients | ✗ | ✗ | ✓ |
| Create / delete projects | ✗ | ✗ | ✓ |
| Assign workers to visits | ✗ | Own projects | All projects |
| View Users list | ✗ | ✗ | ✓ |
| Add / edit / remove users | ✗ | ✗ | ✓ |
| View Map | Own clients only | Managed projects | All clients |

---

## 3. Data model changes to existing schema

The existing schema (`0001_init.sql`) already has `visits`. No new tables are required.

### 3.1 `visits` table — used as Work Day rows

Each visit row = one client × one scheduled date × one assigned worker.

Relevant columns already present:
- `project_id`, `client_id`, `worker_id`
- `scheduled_date` — the work day date
- `status` — `scheduled | in_progress | completed | missed | cancelled`
- `worker_notes` — the worker's report text (per-visit, per-client)
- `manager_notes`
- `gps_validated`, `gps_latitude`, `gps_longitude`

No schema migration required for MVP. All Work Diary features map directly onto the `visits` table.

### 3.2 `clients` table additions (migration required)

Add to `public.clients`:
```sql
alter table public.clients
  add column if not exists gate_code   text,
  add column if not exists is_active   boolean not null default true;
```
_(`gate_code` already exists in the schema — confirm before running.)_

---

## 4. Work Diary

### 4.1 Layout

- **Default landing page** for all users after login
- Full-month calendar header with left/right pagination arrows
- Every calendar day is always shown (no days are hidden)
- Tapping a day expands that day's client card list below the calendar
- Default: current calendar day is selected and scrolled into view
- Days with no visits show a dimmed empty state: *"No clients scheduled"*

### 4.2 Worker view

- Calendar shows all days of the month
- Days where the worker has assigned visits → show client count dot indicator (active style)
- Days where the worker has no assigned visits → dimmed, empty state when tapped
- Expanded day list shows **only visits where `worker_id = current_user.id`**

### 4.3 Admin / project_manager view

- Calendar shows all days of the month
- Days with any visits → active dot indicator
- Days with no visits → dimmed, empty state when tapped
- Expanded day list shows all visits (admin) or visits in managed projects (PM)
- Clicking a project name on a client card → **Project Detail page** (see §6)

### 4.4 Client Card

Displayed inside each work day for each visit.

| Element | Worker | Admin / PM |
|---------|--------|-----------|
| Client name | ✓ | ✓ |
| Address | ✓ | ✓ |
| Notes | ✓ | ✓ |
| 📞 Phone icon → `tel:` link to call client | ✓ | ✓ |
| 🧭 Navigate icon → Google Maps directions to this client's address | ✓ | ✓ |
| 🗺️ Map icon → single-client map modal (one pin, this client only) | ✓ | ✓ |
| 📋 Report icon → opens Report Sheet | ✓ | ✓ |
| ✏️ Edit icon → routes to Client Detail page | ✗ | ✓ |

> **Card map icon vs bottom-nav Map page:**
> The 🗺️ icon on the card opens a focused single-client map — one pin, immediate navigation context, available to all roles.
> The bottom-nav Map page shows ALL clients of the selected work day (worker: own only; admin: all).

### 4.5 Report Sheet (per-visit)

- Opens as a bottom sheet on the visit's client card
- **Scope: one visit = one client on one day** — each client card has its own independent report
- Textarea label: *"What did you complete at this visit?"*
- Pre-filled with existing `visits.worker_notes` if already saved
- **Save** → `PATCH /visits/:id` with `{ worker_notes }`, shows success toast, closes sheet
- **Cancel** → dismiss without saving, no changes persisted
- Accessible to workers (own visits) and admins (any visit)
- Admin sees a second textarea below: *"Manager notes"* → saved to `visits.manager_notes`

---

## 5. Map View

### 5.1 Bottom-nav Map page (`/map`)

- Visible to all roles in the bottom nav
- Shows a date selector (defaults to today) to choose which work day to display
- **Worker:** pins for own assigned clients on the selected work day only
- **Admin / PM:** pins for ALL clients of the selected work day across all projects
- Tapping a pin → popover: client name · address · 🧭 Google Maps directions deeplink
- Uses Google Maps via `@vis.gl/react-google-maps`
- API key from `NEXT_PUBLIC_GOOGLE_MAPS_KEY`

### 5.2 Single-client map modal (from Client Card)

- Triggered by the 🗺️ icon on any Client Card in the Work Diary
- Opens as a full-screen bottom sheet / modal
- Shows a single pin for that specific client's address
- Same popover: client name · address · 🧭 navigation deeplink
- Available to **all roles**

---

## 6. Project Detail Page

Route: `/projects/[id]`  
Accessible by: admin (full edit), project_manager (assign workers, view), worker (read-only via visit)

### Sections

**Header**
- Project name (editable by admin)
- Status badge (`active | paused | archived | done`)
- Delete project button — **admin only**, with confirmation dialog

**Workers panel**
- List of workers currently assigned to this project (`user_projects` table)
- Admin: add worker from dropdown (lists all users with role `worker`), remove worker
- PM: view only

**Clients panel**
- List of all clients in this project
- Each row: name · address · quick-actions (edit, remove)
- Admin: **Add client** button → dropdown/search of existing clients OR inline create form
- Admin: **Remove client** → removes from project (does not delete client record)
- Worker: read-only list

**Work Days panel**
- Chronological list of scheduled visit dates for this project
- Admin: can add a new work day (date picker → creates `visit` rows for all assigned clients + workers)
- Admin: can click a work day → filtered diary view for that date

---

## 7. Clients

Route: `/clients` (bottom nav icon)

### 7.1 Client List page

| Element | Worker | Admin |
|---------|--------|-------|
| Search / filter | ✓ | ✓ |
| View client card | ✓ | ✓ |
| Add new client | ✗ | ✓ |
| Edit client | ✗ | ✓ |
| Delete client | ✗ | ✓ |

### 7.2 Client Detail page

Route: `/clients/[id]`

Fields:
- Name (required)
- Address (required)
- Phone
- Gate code
- Notes
- GPS coordinates (latitude / longitude) — admin can pin on map or enter manually
- Project assignment (which project this client belongs to) — admin only
- Recurring schedule (JSON — days of week + frequency) — admin only
- `is_active` toggle — admin only

Worker view: all fields read-only.

---

## 8. Users

Route: `/users` — **admin only** (hidden from bottom nav for non-admins)

### 8.1 User List page

- Table / card list: name · email · role · status
- Search by name or email
- **Add user** button → opens Add User form

### 8.2 User Detail / Edit page

Route: `/users/[id]`

Fields:
- Username (required)
- Email (required)
- Role — dropdown: `admin | project_manager | worker`
- Avatar URL (optional)
- Password reset button (sends reset email or generates temp password)
- **Remove user** button — with confirmation, admin only

### 8.3 Add User form

- Username, email, temporary password, role
- On submit → `POST /users` (admin-only endpoint)

---

## 9. App Shell & Navigation

### 9.1 Top bar

Present in the authenticated layout (`src/app/(app)/layout.tsx`) on every page.

| Element | Position | Behaviour |
|---------|----------|-----------|
| Page title | Left | Current route name (localised) |
| User avatar / initials | Right | Tapping routes to `/profile` |

The avatar shows the user's `avatarUrl` if set, otherwise a circle with initials from `username`. Visible to all roles.

### 9.2 Bottom Navigation

Max 5 items. Visibility by role:

| Icon | Label | Route | Visible to |
|------|-------|-------|-----------|
| 📅 | Diary | `/` | All |
| 👥 | Clients | `/clients` | All |
| 🗺️ | Map | `/map` | All |
| 👤 | Users | `/users` | Admin only |
| ⚙️ | Settings | `/settings` | Placeholder (future) |

---

## 10. Profile Page

Route: `/profile` — all roles, reached by tapping the avatar in the top bar.

### Sections

**Account info** (read-only)
- Avatar circle (initials fallback)
- Username
- Email
- Role badge

**Preferences**

| Setting | Control | Default | Persisted in |
|---------|---------|---------|-------------|
| Language | Toggle pill: **EN** / **HE** | EN | `localStorage` key `golipooli_locale` |
| Dark mode | Toggle switch | Off (light) | `localStorage` key `golipooli_theme` |

Changes take effect immediately with no page reload.

**Actions**
- **Log out** — clears Zustand auth store, redirects to `/login`

---

## 11. Auth flows

- Email + password signup / login (existing)
- Google OAuth (`/auth/google` → `/auth/google/callback`) (existing)
- JWT access token (15 min) + refresh token (7 days), persisted in Zustand store
- `/auth/callback` — OAuth landing page, stores tokens, redirects to `/`
- Middleware redirects unauthenticated users to `/login`

---

## 12. API endpoints to build

### Auth (existing — verify complete)
```
POST   /auth/signup
POST   /auth/login
POST   /auth/refresh
GET    /auth/me
GET    /auth/google
GET    /auth/google/callback
```

### Projects
```
GET    /projects                          admin/pm
POST   /projects                          admin only
GET    /projects/:id                      member
PATCH  /projects/:id                      admin only
DELETE /projects/:id                      admin only
POST   /projects/:id/members             admin only  { userId, role }
DELETE /projects/:id/members/:userId     admin only
```

### Visits (Work Days)
```
GET    /visits?date=YYYY-MM-DD&projectId=  filtered by role
GET    /visits/:id
POST   /visits                             admin/pm  { projectId, clientId, workerId, scheduledDate }
PATCH  /visits/:id                         worker (own) · admin/pm (any)
DELETE /visits/:id                         admin only
```

### Clients
```
GET    /clients                            all (filtered by role)
POST   /clients                            admin only
GET    /clients/:id                        all
PATCH  /clients/:id                        admin only
DELETE /clients/:id                        admin only
```

### Users
```
GET    /users                              admin only
POST   /users                              admin only
GET    /users/:id                          admin only
PATCH  /users/:id                          admin only
DELETE /users/:id                          admin only
```

---

## 13. Internationalisation (i18n)

### 13.1 Overview

| Property | Value |
|----------|-------|
| Approach | Lightweight custom context + JSON files — no external i18n library |
| Default locale | `en` (English) |
| Second locale | `he` (Hebrew) |
| Layout direction | RTL when `he` active; LTR when `en` active |
| Persistence | `localStorage` key `golipooli_locale`, rehydrated on mount |
| Switcher location | Profile page (`/profile`) — language toggle in Preferences section |

No `next-intl`, no `i18next`. Zero extra dependencies.

### 13.2 Implementation

**File structure:**
```
src/
├── lib/
│   ├── i18n/
│   │   ├── LocaleContext.tsx   ← React context + provider + useT hook
│   │   ├── en.json             ← English strings (source of truth)
│   │   └── he.json             ← Hebrew translations
```

**`LocaleContext.tsx`** — the entire i18n system:
```typescript
type Locale = 'en' | 'he';

// Context provides:
//   locale: Locale
//   setLocale: (l: Locale) => void
//   t: (key: string) => string   ← dot-notation lookup: t('diary.noClients')

// On mount: reads localStorage('golipooli_locale'), defaults to 'en'
// On setLocale: updates state + writes to localStorage + updates <html dir>
```

Wrap the root layout with `<LocaleProvider>`. All components call `const { t } = useT()`.

### 13.3 Translation keys

Both `en.json` and `he.json` must have identical structure. Flat dot-notation namespaces:

```json
{
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.edit": "Edit",
  "common.delete": "Delete",
  "common.add": "Add",
  "common.search": "Search",
  "common.loading": "Loading...",
  "common.noData": "No data available",
  "common.confirm": "Are you sure?",

  "nav.diary": "Diary",
  "nav.clients": "Clients",
  "nav.map": "Map",
  "nav.users": "Users",
  "nav.settings": "Settings",

  "auth.login": "Log in",
  "auth.signup": "Sign up",
  "auth.logout": "Log out",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.username": "Username",

  "diary.title": "Work Diary",
  "diary.noClients": "No clients scheduled for this day",
  "diary.report": "Visit Report",
  "diary.reportPlaceholder": "What did you complete at this visit?",
  "diary.managerNotes": "Manager notes",
  "diary.phone": "Call client",
  "diary.navigate": "Get directions",
  "diary.map": "View on map",

  "projects.title": "Projects",
  "projects.new": "New project",
  "projects.name": "Project name",
  "projects.status": "Status",
  "projects.workers": "Workers",
  "projects.clients": "Clients",
  "projects.workDays": "Work days",
  "projects.deleteConfirm": "Delete this project? This cannot be undone.",

  "clients.title": "Clients",
  "clients.new": "New client",
  "clients.name": "Name",
  "clients.address": "Address",
  "clients.phone": "Phone",
  "clients.gateCode": "Gate code",
  "clients.notes": "Notes",
  "clients.project": "Project",
  "clients.deleteConfirm": "Delete this client?",

  "users.title": "Users",
  "users.new": "New user",
  "users.role": "Role",
  "users.deleteConfirm": "Remove this user?",

  "map.title": "Map",
  "map.noClients": "No clients on this day",
  "map.directions": "Get directions",

  "profile.title": "Profile",
  "profile.preferences": "Preferences",
  "profile.language": "Language",
  "profile.darkMode": "Dark mode",
  "profile.logout": "Log out"
}
```

### 13.4 RTL support

When `setLocale('he')` is called:
- `document.documentElement.setAttribute('lang', 'he')`
- `document.documentElement.setAttribute('dir', 'rtl')`
- Tailwind `rtl:` variants activate automatically across the entire app

When `setLocale('en')`:
- `dir="ltr"`, `lang="en"`

Tailwind classes to audit and add `rtl:` mirrors for:
- `ml-*` / `mr-*` margins
- `pl-*` / `pr-*` padding
- `text-left` / `text-right`
- `left-*` / `right-*` positioning
- Flex row direction in bottom nav and card action rows

### 13.5 Dark mode

Implemented alongside i18n in the same slice.

- Toggle stored in `localStorage` key `golipooli_theme` (`'light'` | `'dark'`)
- On mount and on toggle: add/remove `dark` class on `<html>` element
- Tailwind's `darkMode: 'class'` strategy — already standard in `tailwind.config.ts`
- All existing Tailwind colour classes get `dark:` variants added during this slice
- Managed by a `useTheme()` hook in `src/lib/i18n/LocaleContext.tsx` (or a sibling `ThemeContext.tsx`)
---

## 14. Out of scope for v1

- Push notifications
- Photo uploads
- GPS check-in validation
- Offline mode / service worker caching
- Calendar export (iCal)
- Billing / invoicing

---

## 13. Environment variables required

### golipooli-api `.env`
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback
PORT=4000
CORS_ORIGIN=http://localhost:3000
```

### golipooli-web `.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_GOOGLE_MAPS_KEY=
```
