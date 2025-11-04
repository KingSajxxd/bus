## Student Bus Tracker — Admin Dashboard

A React-based admin dashboard for managing a student bus tracking system. Admins can authenticate via Supabase and manage students, parents, absences, drivers, buses, routes, and view reports.

This app is built with Create React App and integrates with Supabase for authentication and data. Mapping dependencies are present (`mapbox-gl`, `react-map-gl`) for route management.

### Features
- Admin-only access (Supabase auth + role check on `profiles.role === 'admin'`)
- Dashboard with navigation to:
  - Students, Parents, Absences
  - Drivers, Buses, Routes
  - Reports, Checklists
- Client-side routing via `react-router-dom`

---

## Quick Start
1. Ensure you have Node.js 18+ and npm 9+ installed.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env.local` file in the project root with your Supabase credentials:
   ```bash
   REACT_APP_SUPABASE_URL=your_supabase_url
   REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
   # Optional if you use map features
   REACT_APP_MAPBOX_TOKEN=your_mapbox_access_token
   ```
4. Start the development server:
   ```bash
   npm start
   ```
5. Open http://localhost:3000

> Note: The current code in `src/supabaseClient.js` uses inline credentials. For security, you should switch it to read from environment variables. Example:
```js
// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: { params: { eventsPerSecond: 10 } }
})
```

---

## Supabase Setup
The app expects:
- Supabase project with Authentication enabled (Email/Password or your chosen provider)
- A `profiles` table with at least columns:
  - `id` (UUID, matches `auth.users.id`)
  - `role` (text), where admins have `role = 'admin'`

On sign-in, the app checks the logged-in user's profile and only allows admins to access the dashboard.

Basic SQL sketch for `profiles`:
```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user'
);

-- Example: grant admin role
-- update public.profiles set role = 'admin' where id = '...';
```

You will also need the domain configured in Supabase Auth Redirect URLs (e.g., `http://localhost:3000`).

---

## Scripts
From `package.json`:
- `npm start`: start the development server
- `npm run build`: production build to the `build/` directory
- `npm test`: run tests in watch mode
- `npm run eject`: expose CRA configs (irreversible)

---

## Development Notes
- Routing is defined in `src/App.js`, which guards the dashboard with `ProtectedRoute` based on Supabase auth state and the `profiles.role` value.
- Main layout and navigation live in `src/Dashboard.js`. Nested routes are rendered via `Outlet`.
- Global styles are in `src/index.css`.
- Supabase client is initialized in `src/supabaseClient.js`.

If you enable map features in route management, set `REACT_APP_MAPBOX_TOKEN`. Ensure versions are compatible (`mapbox-gl@1.13.3` is pinned by overrides).

---

## Testing
```bash
npm test
```
Runs `react-scripts test` with Testing Library utilities included in dependencies.

---

## Build & Deploy
Create a production build:
```bash
npm run build
```
Deploy the `build/` directory to any static hosting provider (e.g., Netlify, Vercel, GitHub Pages, S3/CloudFront). Ensure environment variables are configured in your hosting platform and that Supabase Auth redirect URLs include your deployed domain.

---

## Configuration Reference
- React: `^19`
- React Router DOM: `^7`
- Supabase JS: `^2`
- Mapbox GL: `1.13.3` (pinned via `overrides`)

---

## Security
- Do not commit Supabase keys or tokens to version control.
- Prefer `.env.local` for local development and host-level environment vars in production.
- Rotate keys if they were previously committed.

---

## Folder Structure (key paths)
- `src/App.js` — routes, auth gating
- `src/Dashboard.js` — layout and navigation
- `src/pages/*` — feature pages (students, parents, routes, etc.)
- `src/supabaseClient.js` — Supabase initialization
- `src/index.css` — global styles

---

## Troubleshooting
- Blank screen or forced sign-out: ensure your user has `role = 'admin'` in `profiles`.
- Auth redirect loops: verify Supabase redirect URLs and that `REACT_APP_*` env vars are set at runtime (rebuild after changes).
- Map errors: set `REACT_APP_MAPBOX_TOKEN` and check browser console for mapbox-gl version compatibility.

---

## License
Proprietary/Internal use unless otherwise specified.
