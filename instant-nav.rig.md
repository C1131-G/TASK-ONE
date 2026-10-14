# instant-nav rig: metsys-ksat

- BUILD: In PowerShell, stop any Next dev server using this checkout, then run `$env:EXPOSE_TESTING_API = '1'; bun run build`.
- EXPOSE: `EXPOSE_TESTING_API=1` during both build and start; `next.config.ts` gates `exposeTestingApiInProductionBuild` on this value.
- RUN: Start the built artifact with `$env:EXPOSE_TESTING_API = '1'; bun run start --port 3000` (sign-in only works on the trusted origin localhost:3000). Set `E2E_BASE_URL=http://localhost:3000` and `E2E_CHROMIUM_PATH=$env:LOCALAPPDATA/ms-playwright/chromium-1243/chrome-win64/chrome.exe`, then run `bunx playwright test tests/e2e/instant-nav-login.spec.ts --project=chromium --no-deps` (reuses the saved admin session; the sign-in setup project is not needed for the focused specs).
- TEST USER: Public auth routes; the spec uses empty cookies and local storage. No login credentials are needed.
- DRIFT: A signed-in session redirects away from `/login`; the focused spec deliberately starts signed out. No other state differences are known.
- CONTRACTS: No audited Link uses effective `prefetch={true}`, and no `router.prefetch()` calls were found. The focused smoke test navigates from `/login` to `/signup` and asserts the visible request-access shell.
- LOOP: Stop the local Next server, build with the testing API enabled, start that artifact on port 3100, run the focused Playwright spec, then stop the production server. Agent limits: none for this local loop.
- LIVENESS: n/a; local build and start.
- WALLS: `next dev` and `next build` share `.next`; stop the dev server before building. The Playwright config's default Chromium path is Linux-specific, so set `E2E_CHROMIUM_PATH` to an installed Windows Chromium executable.
- PITFALLS: Playwright loads `.env.e2e.local`, which sets `E2E_BASE_URL=http://localhost:3000`; set `E2E_BASE_URL` inline on every command or the run silently targets another server. Before trusting a hard-load result, confirm the server on that port was started with `EXPOSE_TESTING_API=1` (a plain `next start` ignores the lock and every guard looks broken). If port 3000 is taken, serve the rig on 3100 with the saved admin session (`--no-deps`); form sign-in (smoke specs, auth setup) only works on the trusted origin localhost:3000. Run the guards with `--workers=1`.
- GUARDS: `tests/e2e/instant-nav-overview.spec.ts`, `instant-nav-tasks.spec.ts`, `instant-nav-routes.spec.ts` (every other workspace route plus the four `[id]` detail routes).
