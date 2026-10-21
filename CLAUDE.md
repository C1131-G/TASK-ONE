@AGENTS.md

## Design system

- The `workspace-*` primitives and the `app/workspace-styles/` tokens are the standard UI layer. Build product UI from them and do not add parallel shadcn wrappers (`card`, `field`, `skeleton` and `tooltip` were removed as unused).
- Use tokens, not literals: colour (`--surface`, `--text-*`, `--border`; portal dialogs use `--workspace-portal-*`), radius (`--r-*`), type (`--fs-*`, `--lh-*`), spacing (`--s-*`) and breakpoints (`--bp-*`, which name the `@media` widths because custom properties cannot appear in media queries).
- Dark values live only in the `.dark` blocks, and reduced-motion rules live only in `app/workspace-styles/reduced-motion.css`.
