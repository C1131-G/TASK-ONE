---
title: Repository conventions
type: reference
status: current
updated: 2026-10-29
---

<!-- markdownlint-disable MD025 -->

# Repository conventions reference

This reference records the tracked design-system conventions for product UI. The source files are [workspace styles](../apps/web/app/workspace-styles/workspace-styles.ts) and [design tokens](../apps/web/app/workspace-styles/tokens-light.css).

## Product UI

| Area | Convention |
| --- | --- |
| Components | Use the `workspace-*` primitives and styles in `apps/web/app/workspace-styles/` as the standard UI layer. Avoid adding parallel shadcn wrappers for the same UI. |
| Color and surfaces | Use the existing `--surface`, `--text-*`, and `--border` tokens. Portal dialogs use `--workspace-portal-*` tokens. |
| Shape, type, and spacing | Use `--r-*` radius tokens, `--fs-*` and `--lh-*` type tokens, and `--s-*` spacing tokens. |
| Breakpoints | Use the `--bp-*` token names as references for media-query widths; CSS custom properties cannot be used in media query conditions. |
| Theme values | Keep dark-theme token values in `.dark` rules, as in `tokens-light.css`. |
| Reduced motion | Follow the existing reduced-motion rules, including those in [reduced-motion.css](../apps/web/app/workspace-styles/reduced-motion.css). |
