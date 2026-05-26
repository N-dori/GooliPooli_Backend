# Golipooli — CLAUDE.md

Mobile-first pool cleaning operations management platform.
Two independent repos. Read this file before doing anything.

---

## Repos at a glance

| Repo            | Stack                                      | Dev command      | Port |
|-----------------|--------------------------------------------|------------------|------|
| golipooli-api   | Express 5 · TypeScript · Supabase          | `npm run dev`    | 4000 |
| golipooli-web   | Next.js 15 App Router · Tailwind · shadcn  | `npm run dev`    | 3000 |

---

## Hard rules — never break these

- **npm only** — no pnpm, no yarn, no workspace:* references anywhere
- **No cross-repo imports** — types are copied by value, never imported across repos
- **`strict: true` must pass** — no `any`, no `@ts-ignore`, no `as unknown as X`
- **Never commit `.env` or `.env.local`** — only `.env.example` is committed
- **Never modify the original `golipooli/` monorepo** if it exists alongside these repos

---

## golipooli-api

### Folder structure

```
src/
├── index.ts                        ← Express app bootstrap, listens on PORT=4000
├── types/                          ← Zod schemas + TS types — source of truth
│   ├── user.ts
│   ├── project.ts
│   ├── client.ts
│   ├── visit.ts
│   ├── notification.ts
│   └── index.ts                    ← barrel export of everything
├── lib/
│   ├── supabase.ts                 ← service-role Supabase client
│   └── utils/
│       ├── gps.ts                  ← haversine distance · isWithinRadius
│       ├── date.ts
│       └── projectCode.ts
├── middleware/
│   └── auth.ts                     ← authRequired · requireRole · requireProjectAccess
└── modules/
    └── <entity>/
        ├── <entity>.routes.ts
        ├── <entity>.controller.ts
        └── <entity>.service.ts
```

### Three-layer module convention — enforced in every module

| Layer              | File                    | Rule                                                        |
|--------------------|-------------------------|-------------------------------------------------------------|
| Routes             | `*.routes.ts`           | Register Express routes, apply middleware, call controller  |
| Controller         | `*.controller.ts`       | Parse req, validate with Zod, call service, return response |
| Service            | `*.service.ts`          | All Supabase queries — zero knowledge of req/res            |

### Auth middleware

- `authRequired` — verifies JWT access token, attaches `req.user`
- `requireRole('admin' | 'project_manager' | 'worker')` — guards by role
- `requireProjectAccess` — verifies `req.user` is a member of `:projectId`

### Database

- Supabase Postgres, accessed via **service-role client** (bypasses RLS)
- RLS in `supabase/migrations/0001_init.sql` is defense-in-depth only — API enforces RBAC
- Tables: `users · projects · user_projects · clients · visits · visit_images · notifications`
- Apply schema: paste `supabase/migrations/0001_init.sql` into the Supabase SQL editor

### Roles

```
admin  >  project_manager  >  worker
```

Promote first user after signup:
```sql
update public.users set role = 'admin' where email = 'you@example.com';
```

### Adding a new entity (API)

1. Define Zod schema in `src/types/<entity>.ts`, export from `src/types/index.ts`
2. Create `src/modules/<entity>/` — routes + controller + service
3. Register the router in `src/index.ts`
4. Run `npm run build` — must pass before committing

---

## golipooli-web

### Folder structure

```
src/
├── app/
│   ├── layout.tsx                  ← root layout: wraps LocaleProvider + ThemeProvider
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── auth/callback/page.tsx  ← Google OAuth landing
│   └── (app)/
│       ├── layout.tsx              ← authenticated shell: top bar + bottom nav
│       ├── page.tsx                ← Work Diary (default landing, route `/`)
│       ├── projects/
│       ├── clients/
│       ├── map/
│       ├── users/                  ← admin only
│       └── profile/               ← all roles, reached via avatar tap
├── components/
│   ├── ui/                         ← shadcn/ui primitives + UserAvatar + LangSwitcher
│   ├── nav/
│   │   └── BottomNav.tsx
│   ├── diary/                      ← DiaryPage · MonthCalendar · DayVisitList · ClientCard
│   │   ├── ReportSheet.tsx
│   │   └── SingleClientMapModal.tsx (shared with map/)
│   ├── projects/
│   ├── clients/
│   ├── map/
│   ├── users/
│   └── profile/
├── lib/
│   ├── api/
│   │   ├── client.ts               ← fetch wrapper: attaches JWT, transparent refresh
│   │   └── <entity>.ts             ← typed API methods per entity
│   ├── hooks/
│   │   └── use<Entity>.ts          ← TanStack React Query hooks
│   ├── store/
│   │   └── auth.ts                 ← Zustand store with persist (tokens survive reload)
│   ├── i18n/
│   │   ├── LocaleContext.tsx       ← useLocale() hook · t() function · RTL switching
│   │   ├── en.json                 ← English strings (source of truth)
│   │   └── he.json                 ← Hebrew translations
│   ├── theme/
│   │   └── ThemeContext.tsx        ← useTheme() hook · dark/light · localStorage
│   └── types/
│       └── index.ts                ← types mirrored from api — no cross-repo imports
└── middleware.ts                   ← redirects unauthenticated users to /login
```

### Component shape — enforced for every entity

| Component        | Responsibility                                        |
|------------------|-------------------------------------------------------|
| `<Entity>Index`  | Data fetching + page header                           |
| `<Entity>List`   | Receives array as props, renders items                |
| `<Entity>Card`   | Receives single item as prop                          |
| `<Entity>Form`   | Create/edit form, calls API on submit                 |

### API client rules

- **All** API calls go through `src/lib/api/client.ts`
- Client attaches Bearer token automatically
- On 401: refreshes token silently, retries once
- On refresh failure: clears Zustand auth store, redirects to `/login`
- Never call `fetch` or `axios` directly from a component or hook

### State management

| Layer         | Tool                              | What it stores                        |
|---------------|-----------------------------------|---------------------------------------|
| Server state  | TanStack React Query              | API responses, caching, invalidation  |
| Auth state    | Zustand + `persist`               | `accessToken · refreshToken · user`   |
| Locale state  | React Context (`LocaleContext`)   | `locale` ('en'|'he'), `t()` function  |
| Theme state   | React Context (`ThemeContext`)    | `theme` ('light'|'dark')              |

### i18n — lightweight context, no library

- **No `next-intl`, no `i18next`** — zero extra dependencies
- `useLocale()` from `src/lib/i18n/LocaleContext.tsx` provides `t('namespace.key')`
- Flat dot-notation keys: `t('diary.noClients')`, `t('common.save')`
- `en.json` is the source of truth — `he.json` must have identical keys
- `setLocale('he')` updates state + `localStorage` + sets `document.documentElement.dir/lang`
- **Every user-visible string must use `t()`** — no hardcoded English in components

### Dark mode

- `useTheme()` from `src/lib/theme/ThemeContext.tsx`
- Persisted in `localStorage` key `golipooli_theme`
- Toggles `dark` class on `<html>` — Tailwind `darkMode: 'class'` strategy
- All colour classes must have `dark:` variants

### RTL support (Hebrew)

- Setting `locale = 'he'` sets `<html dir="rtl" lang="he">` automatically
- Use Tailwind `rtl:` variants for all directional classes:
  - `ml-*` → add `rtl:mr-*`
  - `pl-*` → add `rtl:pr-*`
  - `text-left` → add `rtl:text-right`
  - Flex row directions in nav and card action rows

### App shell

**Top bar** (in `(app)/layout.tsx`)
- Left: current page title via `t()`
- Right: `<UserAvatar />` — shows `avatarUrl` or initials circle, taps to `/profile`

**Bottom nav** — max 5 items

| Route      | Label    | Visible to   |
|------------|----------|--------------|
| `/`        | Diary    | All          |
| `/clients` | Clients  | All          |
| `/map`     | Map      | All          |
| `/users`   | Users    | Admin only   |
| `/profile` | (avatar) | Top bar only |

### Work Diary rules

- Every calendar day is shown (no hidden days)
- Days with visits: active dot indicator
- Days without visits: dimmed — tap shows *"No clients scheduled"* empty state
- Worker: sees only visits where `worker_id = current_user.id`
- Admin: sees all visits across all projects
- Client Card actions (all roles): 📞 phone · 🧭 navigate · 🗺️ single-client map · 📋 report
- Client Card actions (admin only): ✏️ edit

### Report Sheet rules

- **Scoped per visit** (one client × one day) — not per day
- Worker: one textarea → `visits.worker_notes`
- Admin: two textareas → `worker_notes` + `manager_notes`
- Save → `PATCH /visits/:id`, invalidates React Query cache
- Cancel → no API call

### Map surfaces

| Surface                  | Route / trigger              | Scope                          | Roles    |
|--------------------------|------------------------------|--------------------------------|----------|
| Bottom-nav Map page      | `/map`                       | All clients of selected day    | Filtered |
| Single-client map modal  | 🗺️ icon on Client Card       | One client only                | All      |

### Profile page (`/profile`)

Three sections:
1. **Account** — avatar, username, email, role badge (read-only)
2. **Preferences** — language toggle (EN/HE) + dark mode toggle
3. **Actions** — Log out button

### Mobile-first

- Max-width shell: `max-w-screen-sm` centered on desktop
- Safe-area insets on bottom nav (`pb-safe`)
- All touch targets ≥ 44px

### Adding a new feature (web)

1. Mirror types into `src/lib/types/index.ts` (copy from api — no imports)
2. Add API methods to `src/lib/api/<entity>.ts`
3. Add React Query hooks to `src/lib/hooks/use<Entity>.ts`
4. Build `Index · List · Card · Form` under `src/components/<entity>/`
5. Add route under `src/app/(app)/<entity>/`
6. Add all new strings to `en.json` AND `he.json`
7. Run `npm run build` — must pass before committing

---

## Environment variables

### golipooli-api `.env`

| Variable                    | Notes                                      |
|-----------------------------|--------------------------------------------|
| `SUPABASE_URL`              | Supabase project URL                       |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role secret — never expose         |
| `JWT_ACCESS_SECRET`         | Long random string                         |
| `JWT_REFRESH_SECRET`        | Different long random string               |
| `JWT_ACCESS_EXPIRES_IN`     | `15m`                                      |
| `JWT_REFRESH_EXPIRES_IN`    | `7d`                                       |
| `GOOGLE_CLIENT_ID`          | Optional — Google OAuth                    |
| `GOOGLE_CLIENT_SECRET`      | Optional — Google OAuth                    |
| `GOOGLE_CALLBACK_URL`       | `http://localhost:4000/auth/google/callback`|
| `PORT`                      | `4000`                                     |
| `CORS_ORIGIN`               | `http://localhost:3000`                    |

### golipooli-web `.env.local`

| Variable                        | Notes                                  |
|---------------------------------|----------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL                   |
| `NEXT_PUBLIC_SUPABASE_SECRET` | Anon/public key only — never service role |
| `NEXT_PUBLIC_API_URL`           | `http://localhost:4000`                |
| `NEXT_PUBLIC_APP_URL`           | `http://localhost:3000`                |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY`   | Google Maps API key                    |
NEXT_PUBLIC_SUPABASE_URL=https://gl....ase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_pu.....v0Q5TSI6Dg_1W-yiQcl
SUPABASE_URL=https://.....
SUPABASE_SECRET=sb_secre....oUK
JWT_ACCESS_SECRET=sb....
JWT_REFRESH_SECRET=repl0....
NEXT_PUBLIC_API_URL=http://localhost:....
GOOGLE_MAPS_API_KEY=AIza.....
---

## Database schema summary

```
users           id · username · email · password_hash · role · auth_provider · avatar_url
projects        id · name · code(6) · status · created_by
user_projects   user_id · project_id · role (owner|member)
clients         project_id · name · address · phone · gate_code · note · lat · lng · recurring_schedule
visits          project_id · client_id · worker_id · scheduled_date · status · worker_notes · manager_notes
visit_images    visit_id · image_url
notifications   user_id · type · title · message · read
```

Enums: `user_role` · `project_status` · `project_member_role` · `visit_status` · `notification_type`

---

## Build check — run before every commit

```bash
# API
cd golipooli-api && npm run build

# Web
cd golipooli-web && npm run build
```

Both must exit 0. Fix all TypeScript errors before committing.