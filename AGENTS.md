
PoultryHub is a pnpm workspace with two independently-buildable React + Vite + Tailwind CSS apps sharing one internal package. `apps/superadmin` (desktop web, Super Admin only) is the app running inside Figma Make; `apps/mobile` (Capacitor-wrapped, Farm Admin/Manager/Staff) is run and built separately, outside the Figma Make preview loop.

## Development Server

A Vite development server for **`apps/superadmin`** is **already running** on `$PORT` (default 8443) — that's what root `pnpm run dev` always starts, and it's the only app Figma Make's preview panel drives. You don't need to start it manually.

- Preview URL: The user can access the running `apps/superadmin` app through the preview panel
- Hot reload: Changes to source files are reflected immediately
- `apps/mobile` is not part of the Figma Make preview loop — run it manually and separately with `pnpm run dev:mobile` (port 5173) when working on it

## Project Structure

This is the canonical project structure. Start with task-relevant files below. Only follow imports or inspect other files when required, when a documented path is missing, or when the repository contradicts this guide.

**Where new code goes** — usable by both roles (a service, a shared form/analytics component, a hook, a type) → `packages/shared/src/...`; Super-Admin-only feature → `apps/superadmin/src/...`; farm-side (Farm Admin/Manager/Staff) feature → `apps/mobile/src/...`. When unsure whether something is shared, check whether it's imported from both a `/dashboard/*` page and a `/farm/*` page/screen today — if so, it's shared.

- `apps/superadmin/` - Desktop web app, Super Admin only, serves `/dashboard/*`. Own `src/{components,config,lib,pages,services,types}`, `index.html`, `package.json`, `vite.config.ts` (carries the Figma Make plugin block — this is the one app `.figma/make/dev`/`deploy`/`deploy-preview` drive; its `build.outDir` points at the **repo-root** `dist/` so those scripts' hardcoded `--build-dir dist` keeps working).
- `apps/mobile/` - Capacitor-wrapped app, Farm Admin/Manager/Staff, serves `/farm/*`. Own `src/{components,config,navigation,screens}` (note: `screens/` not `pages/`), `android/`, `capacitor.config.ts`, `package.json`, `vite.config.ts` (plain, no Figma plugins — not a Figma Make target).
- `packages/shared/` - `@poultryhub/shared`, a real pnpm workspace package both apps depend on via `workspace:*`. Ships raw `.ts`/`.tsx` source with **no build step** — each app's own Vite dev server / esbuild transpiles it directly, resolved through the package's `exports` map (one subpath pattern per top-level folder: `components/`, `config/`, `constants/`, `context/`, `hooks/`, `lib/`, `pages/`, `routes/`, `services/`, `styles/`, `types/`, `validation/`). Holds everything genuinely used by both apps: all 18 Supabase services except `roleService.ts` (Super-Admin-only RBAC, no farm-side equivalent), all hooks/contexts, the entire auth flow (Landing/Login/ResetPassword/PendingApproval pages, the auth form components), and `ProfilePage` (mounted in both apps — at `/dashboard/profile` and `/farm/account`).
- `supabase/migrations/` - Source of truth for the database schema, one small numbered file per change. `0001_01_...` through `0001_12_...` are the baseline, split by category (users/auth, farms, egg production, etc.) — everything after that is one plain `000N_short_description.sql` per change. See "Database Schema" below. Untouched by the monorepo split — still lives at the repo root, shared by both apps' Supabase project.
- `supabase/schema.sql` - Frozen historical snapshot only, superseded by `supabase/migrations/`. Do not hand-edit.
- `pnpm-workspace.yaml` / root `package.json` - Workspace definition (`apps/*`, `packages/*`) and cross-app scripts (`dev` → superadmin only, `dev:mobile`, `build` → mobile then superadmin, in that order — `.figma/make/deploy-preview` appends `--mode development` to whichever command runs last in the `build` chain, so superadmin must stay last).
- `.mise.toml` - Toolchain versions for Node.js and pnpm.

## Dependencies

- Runtime: React 19 and React DOM 19
- Styling: Tailwind CSS v4 with the `@tailwindcss/vite` plugin
- Build tooling: Vite 8, TypeScript 5.7, and `@vitejs/plugin-react`
- Formatting: oxfmt (root-level only)
- Each app declares its **own full set** of build-tool devDependencies (`vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `tailwindcss`, `typescript`, `@types/*`) rather than relying on the root — required for `pnpm --filter <app> build` to resolve its own binaries under pnpm's non-hoisted linking, and necessary anyway since each app must be independently buildable. `packages/shared` declares its runtime dependencies (`react`, `react-router-dom`, `framer-motion`, `recharts`, etc.) as `peerDependencies`, satisfied by whatever each consuming app already has.
- Capacitor (`@capacitor/android`, `@capacitor/cli`, `@capacitor/core`) lives only in `apps/mobile/package.json`.

## Styling

This project uses **Tailwind CSS v4** through the `@tailwindcss/vite` plugin, configured separately in each app's own `vite.config.ts` (no shared PostCSS/Tailwind config file needed). Each app has its own `src/index.css` importing Tailwind (`@import 'tailwindcss';`) plus the shared design tokens via `@import '@poultryhub/shared/styles/theme.css';` — that file (colors, fonts, radii, chart tokens, base resets) is the single source of truth for both apps' visual identity; edit it there, not per-app, to keep the two apps from drifting apart. Font-face/`@font-face` imports and any truly app-specific CSS overrides stay in that app's own `index.css`, after the shared-theme import.

## Database Schema (Supabase)

The database is Postgres via Supabase. No CLI, nothing to install — schema changes are small numbered SQL files under `supabase/migrations/`, applied by hand in the Supabase Dashboard's SQL Editor. `supabase/schema.sql` is a frozen snapshot from before this workflow (superseded by `supabase/migrations/`) — never add to `schema.sql` again.

The baseline (everything that predates this file-per-change workflow) is split across 12 files by category rather than one giant file: `0001_01_users_auth.sql`, `0001_02_farms.sql`, `0001_03_egg_production.sql`, `0001_04_poultry_inventory.sql`, `0001_05_feeds_vitamins.sql`, `0001_06_health_mortality.sql`, `0001_07_sales_expenses.sql`, `0001_08_notifications.sql`, `0001_09_login_security.sql`, `0001_10_system_settings.sql`, `0001_11_audit_logs.sql`, `0001_12_profile_module.sql`. They have real cross-file dependencies (e.g. RLS policies in `0001_02` reference `current_user_role()`, defined in `0001_01`) so they must always be run in that numeric order — if ever re-running the baseline from scratch against a genuinely empty database, run all 12 in sequence, not just one.

`0001_01_users_auth.sql` creates a `public.schema_migrations(version text primary key, applied_at timestamptz)` table. This isn't what makes re-running a file safe — every statement already guards itself (`create table if not exists`, `add column if not exists`, etc.), same discipline as always — it exists purely so `select * from schema_migrations order by applied_at` gives a real, checkable answer to "what has actually been applied to this database," instead of relying on memory. That gap (schema.sql outpacing what had actually been re-run) is exactly what caused several pages to fail with "Failed to load..." earlier.

To make a schema change:
1. Create `supabase/migrations/000N_short_description.sql` (next sequential number after 0001 — a plain single number, not the two-part `0001_NN` pattern, which is specific to the baseline split above).
2. Write only the incremental SQL for this change — new/altered tables, columns, RLS, triggers — not a copy of the whole schema.
3. End the file with:
   ```sql
   insert into public.schema_migrations (version) values ('000N_short_description')
   on conflict (version) do nothing;
   ```
4. Paste that one file's contents into the Supabase Dashboard's SQL Editor and run it — small and self-contained, not a re-paste of everything.
5. If ever unsure what's already applied, check `select * from schema_migrations order by applied_at` in the SQL Editor.

## Code quality

- Use double quotes for strings containing apostrophes (`"We're here to help"`), or escape them in single-quoted strings. An unescaped apostrophe in a single-quoted string breaks the build.
- Ensure JSX tags are closed and braces are balanced.
- Export components as default exports.
