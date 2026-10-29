# Taskora — Smart Task Management

> **Tagline:** Plan smarter. Get more done.

Taskora is the brand of a modern task-management product across web and mobile.

## Status in this repo

Applied:

- The name users see and everything the system sends: page titles, headings, emails, the calendar name, push notification text, webhook headers and the README all read **Taskora**.
- The internal names match: package names (`taskora` for the web app, `taskora-mobile` for the app), service ids, database and storage names, and test accounts.
- The tagline is in the web description and the README.
- The mobile app is called Taskora, has its icon (`apps/mobile/scripts/generate-icons.mjs`), and uses the ids `com.cibi.taskora` (iOS bundle and Android package), the link scheme `taskora://` and the Expo slug `taskora`.
- The GitHub repository is `taskora`.

Not applied, only proposed below: the scoped `@taskora/*` package names, the `apps/web` and `packages/*` layout, and turbo. The web app still lives at the repository root.

## Brand identity

- **Brand name:** Taskora
- **Full brand name:** Taskora — Smart Task Management
- **Web app name:** Taskora Web
- **Mobile app name:** Taskora
- **Website domain idea:** `taskora.app` _(availability not verified)_
- **GitHub repository:** `taskora`
- **Root project folder:** `taskora`

## Package names (proposal)

- Web app: `@taskora/web`
- Mobile app: `@taskora/mobile`
- Shared UI: `@taskora/ui`
- API: `@taskora/api`

These package names are proposals and may be adjusted to match the chosen package manager and architecture.

## Suggested monorepo structure (proposal)

```text
taskora/
├── apps/
│   ├── web/             # Next.js web application
│   └── mobile/          # Expo / React Native mobile application
├── packages/
│   ├── ui/              # Shared UI components
│   ├── types/           # Shared TypeScript types
│   └── config/          # Shared configurations
├── package.json
├── turbo.json
├── tsconfig.json
└── README.md
```

## Naming conventions

| Item               | Name              |
| ------------------ | ----------------- |
| Product brand      | Taskora           |
| Web application    | Taskora Web       |
| Mobile application | Taskora           |
| Repository         | `taskora`         |
| Root folder        | `taskora`         |
| Web package        | `@taskora/web`    |
| Mobile package     | `@taskora/mobile` |
| Shared UI package  | `@taskora/ui`     |
| API package        | `@taskora/api`    |

## Before launch

The names above are suggestions, not confirmed availability. Before publishing, check:

- Domain availability
- Trademark conflicts in target markets
- Apple App Store and Google Play name conflicts
- GitHub organization and repository availability
- Social media handle availability

## Brand direction

Aim for a clear, dependable, modern productivity experience: simple task capture, focused planning, and visible progress. Keep the visual identity consistent across web, mobile, marketing pages, and documentation.
