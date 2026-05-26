# Golipooli — Claude Code Build Instructions

Step-by-step implementation plan. Complete each slice fully (API + Web) before
starting the next. Every slice follows the same pattern:

```
types → api module → web hooks → web components → web route
```

Reference `CLAUDE.md` for conventions and `PRD.md` for full requirements.

---

## Prerequisites — confirm before starting any slice

- [ ] Both repos scaffolded and building cleanly (`npm run build` passes)
- [ ] `.env` / `.env.local` filled in with real Supabase credentials
- [ ] `supabase/migrations/0001_init.sql` applied in Supabase SQL editor
- [ ] At least one admin user created and promoted:
  ```sql
  update public.users set role = 'admin' where email = 'you@example.com';
  ```

---

## Slice 0 — Auth (verify existing implementation is complete)

**Goal:** Login, signup, Google OAuth, and JWT refresh all work end-to-end.

### API — check these exist and work
- [ ] `POST /auth/signup` — creates user, returns access + refresh tokens
- [ ] `POST /auth/login` — validates password, returns tokens
- [ ] `POST /auth/refresh` — exchanges refresh token for new access token
- [ ] `GET  /auth/me` — returns current user from JWT
- [ ] `GET  /auth/google` + `/auth/google/callback` — OAuth flow

### Web — check these exist and work
- [ ] `/login` page — email + password form, calls `POST /auth/login`
- [ ] `/signup` page — calls `POST /auth/signup`
- [ ] `/auth/callback` page — receives OAuth redirect, stores tokens, redirects to `/`
- [ ] `src/lib/store/auth.ts` — Zustand store with `persist`, stores `accessToken + refreshToken + user`
- [ ] `src/lib/api/client.ts` — attaches Bearer token, on 401 calls refresh and retries once
- [ ] `src/middleware.ts` — redirects unauthenticated requests to `/login`
- [ ] Authenticated layout at `src/app/(app)/layout.tsx` with bottom nav

### Acceptance criteria
- Worker can log in and land on `/` (Work Diary placeholder)
- Admin can log in and see bottom nav with Users icon
- Refreshing the page keeps the user logged in
- Navigating to `/` while logged out redirects to `/login`

---

## Slice 1 — Projects CRUD

**Goal:** Admins can create, view, edit, and delete projects. Workers can view projects they belong to.

### API (`golipooli-api`)

**Types** — `src/types/project.ts`
```typescript
// Zod schemas:
CreateProjectSchema  { name, description?, status? }
UpdateProjectSchema  Partial<CreateProjectSchema>
ProjectMemberSchema  { userId: uuid, role: 'owner' | 'member' }
```

**Module** — `src/modules/projects/`
- `projects.service.ts`
  - `listProjects(userId, role)` — admin: all; pm/worker: only their projects via `user_projects`
  - `getProject(id, userId, role)` — with member list + client count
  - `createProject(data, createdBy)` — inserts project + inserts creator as `owner` in `user_projects`
  - `updateProject(id, data)` — admin only
  - `deleteProject(id)` — admin only
  - `addMember(projectId, userId, role)` — admin only
  - `removeMember(projectId, userId)` — admin only

- `projects.controller.ts` — validates with Zod, calls service, returns JSON
- `projects.routes.ts` — register under `/projects`, apply `authRequired` + `requireRole`/`requireProjectAccess`

### Web (`golipooli-web`)

**Types** — copy/mirror from api into `src/lib/types/index.ts`

**API methods** — `src/lib/api/projects.ts`
```typescript
listProjects()
getProject(id)
createProject(data)
updateProject(id, data)
deleteProject(id)
addMember(projectId, userId, role)
removeMember(projectId, userId)
```

**Hooks** — `src/lib/hooks/useProjects.ts`
```typescript
useProjects()          // list
useProject(id)         // single
useCreateProject()     // mutation
useUpdateProject()     // mutation
useDeleteProject()     // mutation
```

**Components** — `src/components/projects/`
- `ProjectIndex.tsx` — fetches list, renders header + `ProjectList`
- `ProjectList.tsx` — renders array of `ProjectCard`
- `ProjectCard.tsx` — name, status badge, client count, click → `/projects/[id]`
- `ProjectForm.tsx` — create/edit form (name, description, status dropdown)

**Routes**
- `src/app/(app)/projects/page.tsx` → `ProjectIndex`
- `src/app/(app)/projects/new/page.tsx` → `ProjectForm` (create mode)
- `src/app/(app)/projects/[id]/page.tsx` → `ProjectDetail` (see Slice 3)

### Acceptance criteria
- Admin can create a project and see it in the list
- Worker only sees projects they are a member of
- Admin can edit project name/status
- Admin can delete a project (with confirmation dialog)
- Non-admin cannot see delete/edit buttons

---

## Slice 2 — Clients CRUD

**Goal:** Admins can manage clients. Workers can view client details (read-only).

### API

**Types** — `src/types/client.ts`
```typescript
CreateClientSchema  {
  projectId: uuid,
  name: string,
  address: string,
  phone?: string,
  note?: string,
  gateCode?: string,
  latitude?: number,
  longitude?: number,
  recurringSchedule?: object,
  visitsPerMonth?: number,
  isOneTime?: boolean
}
UpdateClientSchema  Partial<CreateClientSchema>
```

**Module** — `src/modules/clients/`
- `clients.service.ts`
  - `listClients(userId, role)` — admin: all; worker: only clients in their projects
  - `getClient(id)` — single client with project info
  - `createClient(data)` — admin only
  - `updateClient(id, data)` — admin only
  - `deleteClient(id)` — admin only

- `clients.controller.ts` + `clients.routes.ts`
  - `GET  /clients` — query params: `projectId?`, `search?`
  - `POST /clients` — admin only
  - `GET  /clients/:id`
  - `PATCH /clients/:id` — admin only
  - `DELETE /clients/:id` — admin only

### Web

**API methods** — `src/lib/api/clients.ts`

**Hooks** — `src/lib/hooks/useClients.ts`

**Components** — `src/components/clients/`
- `ClientIndex.tsx` — list page with search bar + Add button (admin only)
- `ClientList.tsx` — renders `ClientCard` array
- `ClientCard.tsx` — name, address, project badge, click → `/clients/[id]`
- `ClientForm.tsx` — create/edit (admin only), all fields, lat/lng inputs

**Routes**
- `src/app/(app)/clients/page.tsx` → `ClientIndex`
- `src/app/(app)/clients/new/page.tsx` → `ClientForm` (admin only)
- `src/app/(app)/clients/[id]/page.tsx` → `ClientDetail` with edit button (admin only)

### Acceptance criteria
- Admin can create a client and assign it to a project
- Worker can view client details but sees no edit/delete buttons
- Client list is filtered correctly by role

---

## Slice 3 — Work Diary (core feature)

**Goal:** The default view for all users. Month-paginated calendar. Client cards per day with correct role-based visibility.

### API

**Types** — `src/types/visit.ts`
```typescript
CreateVisitSchema   { projectId, clientId, workerId?, scheduledDate }
UpdateVisitSchema   { workerId?, scheduledDate?, status?, workerNotes?, managerNotes? }
```

**Module** — `src/modules/visits/`
- `visits.service.ts`
  - `listVisits({ userId, role, dateFrom, dateTo, projectId? })` — role-filtered
  - `getVisit(id)` — with client + project + worker details
  - `createVisit(data)` — admin/pm only
  - `updateVisit(id, data, requestingUser)` — worker: own visit `workerNotes` only; admin: all fields
  - `deleteVisit(id)` — admin only
  - `bulkCreateVisits(projectId, clientIds, workerIds, dates)` — creates visit matrix

- `visits.controller.ts` + `visits.routes.ts`
  - `GET  /visits` — query: `dateFrom`, `dateTo`, `projectId?`, `workerId?`
  - `POST /visits` — admin/pm
  - `GET  /visits/:id`
  - `PATCH /visits/:id` — worker (own notes) · admin (all)
  - `DELETE /visits/:id` — admin only

### Web

**API methods** — `src/lib/api/visits.ts`

**Hooks** — `src/lib/hooks/useVisits.ts`
```typescript
useVisitsByMonth(year, month)   // fetches dateFrom=YYYY-MM-01 dateTo=YYYY-MM-31
useVisit(id)
useUpdateVisit()                // mutation
useCreateVisit()                // mutation (admin)
```

**Components** — `src/components/diary/`

`DiaryPage.tsx` — top-level page component
  - State: `selectedMonth` (Date), `selectedDay` (Date, defaults to today)
  - Fetches ALL visits for selected month via `useVisitsByMonth`
  - Role filtering happens in the hook (worker: own only; admin: all)
  - Renders `MonthCalendar` + `DayVisitList` below it

`MonthCalendar.tsx`
  - Grid showing EVERY calendar day of the month (no days hidden)
  - Each day cell: date number
  - Active style + dot indicator: days where the current user has visits (worker: own; admin: any)
  - Dimmed style: days with no applicable visits
  - Current day highlighted with distinct color
  - Left/right arrows to paginate months
  - Tap any day → sets `selectedDay` (both active and dimmed days are tappable)

`DayVisitList.tsx`
  - Receives visits filtered to `selectedDay`
  - Renders a `ClientCard` per visit
  - Empty state when no visits: *"No clients scheduled for this day"* (shown for ALL roles)

`ClientCard.tsx` — `src/components/diary/ClientCard.tsx`
  - Props: `visit` (with nested `client` + `project`)
  - Displays: client name · address · notes
  - Action icon row (left to right):
    - 📞 Phone — `tel:${client.phone}` link; hidden if no phone number
    - 🧭 Navigate — `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(client.address)}`
    - 🗺️ Map — opens `SingleClientMapModal` for THIS client only (available to ALL roles)
    - 📋 Report — opens `ReportSheet` for this visit
    - ✏️ Edit (admin only) — routes to `/clients/[id]`

`SingleClientMapModal.tsx` — bottom sheet, all roles
  - Single Google Maps pin for this client's address
  - Popover: client name · address · 🧭 navigation deeplink
  - Close button

`ReportSheet.tsx` — bottom sheet, per visit
  - **Scope: one visit = one client on one day** — each card's sheet is independent
  - Textarea label: *"What did you complete at this visit?"*
  - Pre-filled with `visit.workerNotes` if exists
  - Worker: sees only `workerNotes` textarea
  - Admin: sees `workerNotes` (editable) + second textarea *"Manager notes"* for `managerNotes`
  - **Save** → `PATCH /visits/:id { workerNotes, managerNotes? }`, invalidates React Query cache, closes sheet, shows success toast
  - **Cancel** → closes without saving, no API call

**Routes**
- `src/app/(app)/page.tsx` → `DiaryPage` (this IS the home route `/`)

### Acceptance criteria
- Worker lands on current day, sees only own assigned visits
- Worker tapping a day with no assignments sees "No clients scheduled" empty state
- Admin lands on current day, sees all visits across all projects
- Admin tapping a day with no visits sees "No clients scheduled" empty state
- All calendar days are shown (no days hidden)
- Days with visits show dot indicator; days without are dimmed
- 📞 Phone icon opens device dialer
- 🧭 Navigate icon opens Google Maps directions to that client
- 🗺️ Map icon (all roles) opens single-client map modal for that card's client
- 📋 Report sheet saves `workerNotes` per visit (not per day)
- Admin report sheet saves both `workerNotes` and `managerNotes`
- Month pagination works forward and back

---

## Slice 4 — Project Detail Page

**Goal:** Full project management page for admins. View-only for workers/PM.

### Web (no new API routes — uses existing `/projects/:id`, `/visits`, `/clients`)

**Components** — `src/components/projects/`

`ProjectDetail.tsx` — composed of three panels:

`ProjectHeader.tsx`
  - Project name (inline editable for admin)
  - Status badge (editable dropdown for admin)
  - Delete button (admin only) — confirmation dialog → `DELETE /projects/:id` → redirect to `/projects`

`ProjectWorkersPanel.tsx`
  - List workers from `project.members` where role = `worker`
  - Admin: dropdown to add worker (fetch `/users?role=worker`), remove button per row
  - PM/worker: read-only

`ProjectClientsPanel.tsx`
  - List clients in this project
  - Each row: name · address · Edit icon (admin) · Remove icon (admin)
  - Admin: Add Client — searchable dropdown of all clients OR inline create form
  - Removing a client reassigns `client.projectId` to null (does not delete)

`ProjectWorkDaysPanel.tsx`
  - Chronological list of distinct `scheduledDate` values for this project
  - Admin: date picker → "Create work day" → opens assignment modal
  - Assignment modal: select workers, confirm → calls `bulkCreateVisits`

**Route**
- `src/app/(app)/projects/[id]/page.tsx` → `ProjectDetail`

### Acceptance criteria
- Admin can rename a project inline
- Admin can add/remove workers from the project
- Admin can add/remove clients
- Admin can create a new work day and assign workers
- Delete project with confirmation works
- Worker sees project info + client list read-only

---

## Slice 5 — Map View

**Goal:** Two distinct map surfaces — a bottom-nav full-day map and a per-client modal from the diary.

### Web

**Install dependency:**
```bash
npm install @vis.gl/react-google-maps
```

**Components** — `src/components/map/`

`MapPage.tsx` — bottom-nav page (`/map`)
  - Date selector bar at top (left/right arrows, defaults to today)
  - Fetches visits for selected date using `useVisitsByDate(date)` hook
  - **Worker:** pins only for visits where `worker_id = current_user.id`
  - **Admin / PM:** pins for ALL visits of that day across all projects
  - Wraps everything in `<APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}>`
  - Renders `<Map>` with `<AdvancedMarker>` per client (one pin per unique client)
  - Empty state if no visits for selected day: *"No clients scheduled for this day"*

`ClientMapPin.tsx`
  - Custom `<AdvancedMarker>` showing client initials in a colored circle
  - On click: `<InfoWindow>` popover
    - Client name
    - Address
    - 🧭 Google Maps directions deeplink

`SingleClientMapModal.tsx` — reused from Slice 3 `ClientCard`
  - Already built in Slice 3 — no duplication needed
  - Confirm it imports cleanly from `src/components/map/SingleClientMapModal.tsx`
  - If built inline in Slice 3, refactor it here into the shared `map/` folder

**Hook** — `src/lib/hooks/useVisits.ts` addition:
```typescript
useVisitsByDate(date: string)   // GET /visits?dateFrom=date&dateTo=date, role-filtered
```

**Route**
- `src/app/(app)/map/page.tsx` → `MapPage`

### Acceptance criteria
- Bottom-nav Map page defaults to today
- Date selector arrows change the day and re-fetch
- Worker sees only own assigned client pins
- Admin sees all client pins for the selected day
- Tapping a pin shows name + address + Google Maps deeplink
- Empty state shown when no visits on selected day
- 🗺️ icon on `ClientCard` (diary) opens `SingleClientMapModal` for that one client — available to all roles
- `SingleClientMapModal` lives in `src/components/map/` and is shared between diary and map pages

---

## Slice 6 — Users Management

**Goal:** Admin-only user management (list, add, edit, remove).

### API

**Module** — `src/modules/users/`
- `users.service.ts`
  - `listUsers()` — all users
  - `getUser(id)`
  - `createUser(data)` — hashes password, inserts user
  - `updateUser(id, data)` — role, username, avatar
  - `deleteUser(id)` — admin cannot delete themselves

- `users.controller.ts` + `users.routes.ts`
  - All routes behind `requireRole('admin')`
  - `GET    /users`
  - `POST   /users`         `{ username, email, password, role }`
  - `GET    /users/:id`
  - `PATCH  /users/:id`     `{ username?, role?, avatarUrl? }`
  - `DELETE /users/:id`

### Web

**API methods** — `src/lib/api/users.ts`

**Hooks** — `src/lib/hooks/useUsers.ts`

**Components** — `src/components/users/`
- `UserIndex.tsx` — fetches list, search bar, Add User button
- `UserList.tsx` — renders `UserRow` array
- `UserRow.tsx` — avatar · name · email · role badge · Edit icon · Delete icon
- `UserForm.tsx` — create: username + email + password + role; edit: username + role + avatar URL

**Routes**
- `src/app/(app)/users/page.tsx` → `UserIndex`
- `src/app/(app)/users/new/page.tsx` → `UserForm` (create mode)
- `src/app/(app)/users/[id]/page.tsx` → `UserDetail` with edit + delete

**Bottom nav:** Users icon only renders if `user.role === 'admin'`

### Acceptance criteria
- Non-admin navigating to `/users` gets redirected to `/`
- Admin can create a new user with a temporary password
- Admin can change a user's role
- Admin can delete a user (with confirmation; cannot delete themselves)
- User list has working search by name/email

---

---

## Slice 7 — Profile Page + i18n + Dark Mode

**Goal:** Profile page accessible from the avatar in the top bar. Language (EN/HE with RTL) and dark mode implemented via a lightweight custom context — no external i18n library.

### Web (`golipooli-web` only — no API changes needed)

---

#### Part A — App Shell: top bar with avatar

Update `src/app/(app)/layout.tsx`:

- Add a top bar row above the page content (below the browser chrome)
- **Left side:** current page title (localised — use `t()` once context is ready)
- **Right side:** `<UserAvatar />` component

`src/components/ui/UserAvatar.tsx`:
- Reads `user` from Zustand auth store
- If `user.avatarUrl` is set: renders `<img>` in a circle
- Else: renders a circle with initials (`user.username` first two chars, uppercased)
- `onClick` → `router.push('/profile')`
- Size: 36×36px, always visible

---

#### Part B — Profile Page

**Route:** `src/app/(app)/profile/page.tsx`

**Components** — `src/components/profile/`

`ProfilePage.tsx` — full page, three sections:

`ProfileAccountSection.tsx`
- Avatar (large, 64px) with initials fallback
- Username (display only)
- Email (display only)
- Role badge (`admin` / `project_manager` / `worker`)

`ProfilePreferencesSection.tsx`
- **Language toggle**
  - Pill with two buttons: **EN** | **HE**
  - Active: filled; inactive: outline
  - `onClick` → calls `setLocale()` from locale context
- **Dark mode toggle**
  - Labelled switch: "Dark mode"
  - `onClick` → calls `setTheme()` from theme context

`ProfileActionsSection.tsx`
- **Log out** button (destructive style)
- `onClick` → clears Zustand auth store → `router.push('/login')`

---

#### Part C — Locale context (no library)

**No `next-intl`, no `i18next`. Zero new dependencies.**

`src/lib/i18n/LocaleContext.tsx`:
```typescript
type Locale = 'en' | 'he';

// Context value:
// {
//   locale: Locale
//   setLocale: (l: Locale) => void
//   t: (key: string) => string   ← dot-notation: t('diary.noClients')
// }

// On mount:
//   1. Read localStorage('golipooli_locale'), default 'en'
//   2. Apply dir + lang to <html> element

// setLocale:
//   1. Update React state
//   2. Write to localStorage
//   3. document.documentElement.setAttribute('lang', locale)
//   4. document.documentElement.setAttribute('dir', locale === 'he' ? 'rtl' : 'ltr')
```

`src/lib/i18n/en.json` and `src/lib/i18n/he.json`:
- Flat dot-notation keys (see PRD §13.3 for full list)
- `en.json` is source of truth

Usage in any component:
```typescript
import { useLocale } from '@/lib/i18n/LocaleContext';
const { t } = useLocale();
<p>{t('diary.noClients')}</p>
```

Wrap root layout with `<LocaleProvider>`.

---

#### Part D — Theme context (dark mode)

`src/lib/theme/ThemeContext.tsx`:
```typescript
type Theme = 'light' | 'dark';

// On mount: read localStorage('golipooli_theme'), default 'light'
// Apply: document.documentElement.classList.toggle('dark', theme === 'dark')

// setTheme:
//   1. Update state
//   2. Write localStorage
//   3. Toggle 'dark' class on <html>
```

Tailwind config must have `darkMode: 'class'` (add if not already set).

Wrap root layout with `<ThemeProvider>` alongside `<LocaleProvider>`.

Add `dark:` variants to all colour classes across the app during this slice.

---

#### Part E — Replace all hardcoded strings

Go through every component built in Slices 0–6. Replace every hardcoded user-visible string:

```typescript
// Before
<p>No clients scheduled for this day</p>

// After
const { t } = useLocale();
<p>{t('diary.noClients')}</p>
```

Cover: page titles, button labels, form labels + placeholders, empty states, confirmation dialogs, toast messages, error messages, nav labels, status badges, report sheet labels.

---

#### Part F — RTL audit

With `dir="rtl"` active, audit every component for directional Tailwind classes and add `rtl:` mirrors:
- `ml-*` → `rtl:mr-*` (and `rtl:ml-0` if needed)
- `pl-*` → `rtl:pr-*`
- `text-left` → `rtl:text-right`
- `left-*` / `right-*` positioning
- Flex row directions in bottom nav icon row and `ClientCard` action row

---

### File structure additions

```
src/
├── lib/
│   ├── i18n/
│   │   ├── LocaleContext.tsx
│   │   ├── en.json
│   │   └── he.json
│   └── theme/
│       └── ThemeContext.tsx
├── components/
│   ├── ui/
│   │   └── UserAvatar.tsx
│   └── profile/
│       ├── ProfilePage.tsx
│       ├── ProfileAccountSection.tsx
│       ├── ProfilePreferencesSection.tsx
│       └── ProfileActionsSection.tsx
└── app/(app)/
    └── profile/
        └── page.tsx
```

### Acceptance criteria
- Avatar / initials visible top-right on every authenticated page
- Tapping avatar routes to `/profile`
- Profile page shows username, email, role badge
- Language toggle switches EN ↔ HE immediately with no reload
- HE activates `dir="rtl"` on `<html>`; layout mirrors correctly
- EN restores `dir="ltr"`
- Language persists after page refresh
- Dark mode toggle switches theme immediately
- Dark mode persists after page refresh
- Log out clears session and redirects to `/login`
- All visible strings use `t()` — no hardcoded English in components
- `npm run build` passes

---

## Slice 8 — Polish & hardening

Once all slices are complete:

### API
- [ ] Add `request-id` header to every response (use `crypto.randomUUID()`)
- [ ] Ensure all Zod validation errors return `400` with field-level messages
- [ ] Rate limiting tuned: auth endpoints stricter (5 req/min), others relaxed (100 req/min)
- [ ] Confirm all admin-only routes return `403` (not `404`) for non-admins
- [ ] Refresh token rotation: on `POST /auth/refresh`, invalidate old token

### Web
- [ ] Loading skeletons on all list/detail pages (no layout shift)
- [ ] Empty states on all lists use `t()` translation keys — no hardcoded strings
- [ ] Error boundary on authenticated layout — shows toast on API error
- [ ] `manifest.json` has both `name` and `short_name` translated (use EN as fallback)
- [ ] `next.config.ts` — confirm `NEXT_PUBLIC_GOOGLE_MAPS_KEY` in `env` block
- [ ] Bottom nav active state (highlight current route)
- [ ] Safe-area insets (`pb-safe`) on bottom nav for iOS notch
- [ ] `LangSwitcher` tested on both 375px mobile and 768px tablet viewports

---

## Slice execution checklist template

Copy this for each slice:

```
## Slice N — <Name>

### API
- [ ] Types defined in src/types/<entity>.ts + exported from index.ts
- [ ] Service functions implemented + tested manually with curl/Postman
- [ ] Controller validates input with Zod, returns correct HTTP status codes
- [ ] Routes registered in src/index.ts
- [ ] npm run build passes

### Web
- [ ] Types mirrored into src/lib/types/index.ts
- [ ] API methods in src/lib/api/<entity>.ts
- [ ] React Query hooks in src/lib/hooks/use<Entity>.ts
- [ ] Components built: Index · List · Card · Form
- [ ] Route(s) added under src/app/(app)/
- [ ] Role-based UI (admin vs worker) correct
- [ ] npm run build passes

### Manual QA
- [ ] Tested as worker role
- [ ] Tested as admin role
- [ ] No console errors
- [ ] Mobile viewport looks correct (375px wide)
- [ ] All new strings have translation keys in both en.json and he.json
```
