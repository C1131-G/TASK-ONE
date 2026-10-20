# instant-nav rig: metsys-ksat

- BUILD: Stop any Next dev server using this checkout, verify the database with `bun run db:verify`, then set `EXPOSE_TESTING_API=1` and run `bun run build`.
- EXPOSE: Set `EXPOSE_TESTING_API=1` during both build and start. `next.config.ts` gates `exposeTestingApiInProductionBuild` on this value; leave it unset for deployed builds.
- RUN: Start the built artifact at the trusted auth origin with `bun run start --port 3000`. Set `E2E_BASE_URL=http://localhost:3000` and `E2E_CHROMIUM_PATH` to an installed Chromium executable, then run the focused Playwright specs with `--project=chromium --no-deps --workers=1`.
- TEST USER: Authenticated route specs reuse the locally seeded admin state in `tests/e2e/.auth`; the login smoke spec starts with empty cookies. E2E passwords stay in the ignored `.env.e2e.local` file and are not committed.
- DRIFT: A signed-in session redirects away from `/login`; the login smoke spec deliberately starts signed out.
- CONTRACTS: No audited Link uses effective `prefetch={true}`, and no `router.prefetch()` calls were found. The focused smoke test navigates from `/login` to `/signup` and asserts the visible request-access shell.
- LOOP: Stop the local Next server, build with the testing API enabled, start that artifact on port 3000, run the authenticated Playwright specs, then stop the production server.
- LIVENESS: n/a; local build and start.
- WALLS: `next dev` and `next build` share `.next`; stop the dev server before building. Playwright uses the configured `E2E_CHROMIUM_PATH` on Windows.
- PITFALLS: Playwright loads `.env.e2e.local`, which sets `E2E_BASE_URL=http://localhost:3000`; confirm the server on that origin was built with `EXPOSE_TESTING_API=1` before trusting lock assertions. The backend harness creates and migrates a dedicated `metsys*_test` database; do not point it at the app database.
- GUARDS: `tests/e2e/overview-page.spec.ts`, `tasks-instant-flow.spec.ts`, `clients-portal-instant-flow.spec.ts` (clients, audit, portal routes), `workspace-instant-flow.spec.ts` (every other workspace route plus the four `[id]` detail routes).
