# instant-nav rig: metsys-ksat

- BUILD: In PowerShell, stop any Next dev server using this checkout, then run `$env:EXPOSE_TESTING_API = '1'; bun run build`.
- EXPOSE: `EXPOSE_TESTING_API=1` during both build and start; `next.config.ts` gates `exposeTestingApiInProductionBuild` on this value.
- RUN: Start the built artifact with `$env:EXPOSE_TESTING_API = '1'; bun run start --port 3100`. Set `E2E_BASE_URL=http://localhost:3100` and `E2E_CHROMIUM_PATH=$env:LOCALAPPDATA/ms-playwright/chromium-1243/chrome-win64/chrome.exe`, then run `bunx playwright test tests/e2e/instant-nav-login.spec.ts --project=chromium`.
- TEST USER: Public auth routes; the spec uses empty cookies and local storage. No login credentials are needed.
- DRIFT: A signed-in session redirects away from `/login`; the focused spec deliberately starts signed out. No other state differences are known.
- CONTRACTS: No audited Link uses effective `prefetch={true}`, and no `router.prefetch()` calls were found. The focused smoke test navigates from `/login` to `/signup` and asserts the visible request-access shell.
- LOOP: Stop the local Next server, build with the testing API enabled, start that artifact on port 3100, run the focused Playwright spec, then stop the production server. Agent limits: none for this local loop.
- LIVENESS: n/a; local build and start.
- WALLS: `next dev` and `next build` share `.next`; stop the dev server before building. The Playwright config's default Chromium path is Linux-specific, so set `E2E_CHROMIUM_PATH` to an installed Windows Chromium executable.
