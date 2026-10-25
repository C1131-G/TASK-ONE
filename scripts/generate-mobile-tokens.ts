import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Generates apps/mobile/src/theme/tokens.generated.ts from the workspace CSS
 * token files, resolving var() references and color-mix() so React Native
 * styles get literal colors and numbers. Re-run after editing the CSS:
 *
 *   bun run scripts/generate-mobile-tokens.ts
 */
import { Effect } from "effect";

import {
  convertValue,
  firstFontFamily,
  parseCssBlocks,
  resolveColor,
  resolveVars,
  tokenKey,
} from "./mobile-token-parser";
import type { CssBlock } from "./mobile-token-parser";

const repoRoot = path.resolve(import.meta.dirname, "..");
const LIGHT_CSS = path.join(
  repoRoot,
  "app",
  "workspace-styles",
  "tokens-light.css"
);
const DARK_CSS = path.join(
  repoRoot,
  "app",
  "workspace-styles",
  "tokens-dark-accents.css"
);
const OUTPUT = path.join(
  repoRoot,
  "apps",
  "mobile",
  "src",
  "theme",
  "tokens.generated.ts"
);

type TokenValue = string | number;
type Entry = readonly [string, TokenValue];

const COLOR_VALUE_PATTERN = /^(?:#|rgb|hsl|color-mix|transparent)/iu;
/** Tokens that are not colors: shadows, radii, spacing, type, breakpoints, sizes, motion. */
const NON_COLOR_PATTERN =
  /^--(?:shadow-|r(?:-|$)|s-\d|fs|lh|font$|mono$|bp-|h-|side-|row-|card-|topbar|gutter|ease|spring|dur$)/u;

const findBlock = (blocks: readonly CssBlock[], selector: string): CssBlock => {
  const block = blocks.find((candidate) => candidate.selector === selector);
  if (block === undefined) {
    throw new Error(`Expected a CSS block for selector ${selector}`);
  }
  return block;
};

const attributeValue = (selector: string, attribute: string): string | null =>
  new RegExp(`${attribute}="(?<value>[^"]+)"`, "u").exec(selector)?.groups
    ?.value ?? null;

const decapitalize = (key: string): string =>
  key.charAt(0).toLowerCase() + key.slice(1);

const resolveToken = (
  name: string,
  declarations: ReadonlyMap<string, string>,
  parent: ReadonlyMap<string, string>
): TokenValue => {
  const raw = resolveVars(declarations.get(name) ?? "", declarations, parent);
  return COLOR_VALUE_PATTERN.test(raw) ? resolveColor(raw) : convertValue(raw);
};

const pickByPattern = (
  declarations: ReadonlyMap<string, string>,
  pattern: RegExp,
  parent: ReadonlyMap<string, string>
): readonly Entry[] =>
  [...declarations]
    .filter(([name]) => pattern.test(name))
    .map(
      ([name]) =>
        [tokenKey(name), resolveToken(name, declarations, parent)] as const
    );

const entriesBody = (entries: readonly Entry[], indent: string): string =>
  entries
    .map(
      ([key, value]) =>
        `${indent}${JSON.stringify(key)}: ${JSON.stringify(value)},`
    )
    .join("\n");

const emitObject = (name: string, entries: readonly Entry[]): string =>
  `export const ${name} = {\n${entriesBody(entries, "  ")}\n} as const;\n`;

const accentLine = (variant: string, block: CssBlock): string => {
  const accL = resolveToken("--acc-l", block.declarations, new Map());
  const accD = resolveToken("--acc-d", block.declarations, new Map());
  return `  ${JSON.stringify(variant)}: { accL: ${JSON.stringify(accL)}, accD: ${JSON.stringify(accD)} },`;
};

const emitThemed = (
  name: string,
  light: readonly Entry[],
  dark: readonly Entry[]
): string =>
  `export const ${name} = {\n  light: {\n${entriesBody(light, "    ")}\n  },\n  dark: {\n${entriesBody(dark, "    ")}\n  },\n} as const;\n`;

export const buildTokenModule = (lightCss: string, darkCss: string): string => {
  const lightBlocks = parseCssBlocks(lightCss);
  const darkBlocks = parseCssBlocks(darkCss);

  const portalPrefix = "--workspace-portal-";
  const portalLightBlock = findBlock(lightBlocks, ":root");
  const portalDarkBlock = findBlock(lightBlocks, ".dark");
  const appLight = findBlock(lightBlocks, ".workspace-app");
  const appDark = findBlock(darkBlocks, ".dark .workspace-app");

  const portalEntries = (block: CssBlock): readonly Entry[] =>
    pickByPattern(
      new Map(
        [...block.declarations].filter(([name]) =>
          name.startsWith(portalPrefix)
        )
      ),
      /^--/u,
      new Map()
    ).map(
      ([key, value]) =>
        [decapitalize(key.replace("workspacePortal", "")), value] as const
    );

  const lightDeclarations = appLight.declarations;
  const darkDeclarations = appDark.declarations;

  const colorEntriesLight = [...lightDeclarations]
    .filter(([name]) => !NON_COLOR_PATTERN.test(name))
    .map(
      ([name]) =>
        [
          tokenKey(name),
          resolveToken(name, lightDeclarations, new Map()),
        ] as const
    );
  // The CSS cascade gives dark the light values it does not override, so the
  // mobile dark set is the light set merged with the dark block.
  const colorEntriesDark = [
    ...new Map([
      ...colorEntriesLight,
      ...[...darkDeclarations]
        .filter(([name]) => !NON_COLOR_PATTERN.test(name))
        .map(
          ([name]) =>
            [
              tokenKey(name),
              resolveToken(name, darkDeclarations, lightDeclarations),
            ] as const
        ),
    ]),
  ];

  const shadowEntriesLight = [...lightDeclarations]
    .filter(([name]) => name.startsWith("--shadow-"))
    .map(
      ([name]) =>
        [
          decapitalize(tokenKey(name).replace(/^shadow/u, "")),
          resolveToken(name, lightDeclarations, new Map()),
        ] as const
    );
  const shadowEntriesDark = [...darkDeclarations]
    .filter(([name]) => name.startsWith("--shadow-"))
    .map(
      ([name]) =>
        [
          decapitalize(tokenKey(name).replace(/^shadow/u, "")),
          resolveToken(name, darkDeclarations, lightDeclarations),
        ] as const
    );

  const radii = [...lightDeclarations]
    .filter(([name]) => /^--r(?:-|$)/u.test(name))
    .map(([name]) => {
      const key = tokenKey(name);
      return [
        key === "r" ? "md" : decapitalize(key.replace(/^r/u, "")),
        resolveToken(name, lightDeclarations, new Map()),
      ] as const;
    });

  const spacing = [...lightDeclarations]
    .filter(([name]) => /^--s-\d+$/u.test(name))
    .map(
      ([name]) =>
        [
          tokenKey(name),
          resolveToken(name, lightDeclarations, new Map()),
        ] as const
    );

  const type = [...lightDeclarations]
    .filter(([name]) => /^--(?:fs(?:-\w+)?|lh(?:-\w+)?|font|mono)$/u.test(name))
    .map(([name]) => {
      const value = resolveToken(name, lightDeclarations, new Map());
      return [
        tokenKey(name),
        typeof value === "string" ? firstFontFamily(value) : value,
      ] as const;
    });

  const breakpoints = [...lightDeclarations]
    .filter(([name]) => name.startsWith("--bp-"))
    .map(
      ([name]) =>
        [
          tokenKey(name),
          resolveToken(name, lightDeclarations, new Map()),
        ] as const
    );

  const sizes = [...lightDeclarations]
    .filter(([name]) =>
      /^--(?:h-\w+|side-w|side-row|row-h|card-pad|topbar-h|gutter)$/u.test(name)
    )
    .map(
      ([name]) =>
        [
          tokenKey(name),
          resolveToken(name, lightDeclarations, new Map()),
        ] as const
    );

  const motion = [...lightDeclarations]
    .filter(([name]) => /^--(?:ease|spring|ease-drawer|dur)$/u.test(name))
    .map(
      ([name]) =>
        [
          tokenKey(name),
          resolveToken(name, lightDeclarations, new Map()),
        ] as const
    );

  const accentLines = [
    accentLine("default", appLight),
    ...[...darkBlocks]
      .filter((block) =>
        block.selector.startsWith('.workspace-app[data-accent="')
      )
      .map((block) => {
        const variant = attributeValue(block.selector, "data-accent");
        return variant === null ? null : accentLine(variant, block);
      })
      .filter((line): line is string => line !== null),
  ];

  const densityLines: string[] = [];
  for (const block of darkBlocks) {
    if (!block.selector.startsWith(".workspace-app[data-")) {
      continue;
    }
    if (!block.selector.includes("data-accent")) {
      const side = attributeValue(block.selector, "data-side");
      const density = attributeValue(block.selector, "data-density");
      let key = null;
      if (side !== null) {
        key = "sideCompact";
      } else if (density !== null) {
        key = "compact";
      }
      if (key !== null) {
        densityLines.push(
          `  ${JSON.stringify(key)}: {\n${[...block.declarations]
            .map(
              ([name, value]) =>
                `    ${JSON.stringify(tokenKey(name))}: ${JSON.stringify(convertValue(value))},`
            )
            .join("\n")}\n  },`
        );
      }
    }
  }

  return [
    "// Generated by scripts/generate-mobile-tokens.ts from app/workspace-styles/tokens-*.css.",
    "// Do not edit by hand; re-run the generator instead.",
    "",
    emitThemed("theme", colorEntriesLight, colorEntriesDark),
    emitThemed("shadows", shadowEntriesLight, shadowEntriesDark),
    emitThemed(
      "portal",
      portalEntries(portalLightBlock),
      portalEntries(portalDarkBlock)
    ),
    `export const accents = {\n${accentLines.join("\n")}\n} as const;\n`,
    "export type AccentName = keyof typeof accents;\n",
    `export const density = {\n${densityLines.join("\n")}\n} as const;\n`,
    emitObject("radii", radii),
    emitObject("spacing", spacing),
    emitObject("type", type),
    emitObject("breakpoints", breakpoints),
    emitObject("sizes", sizes),
    emitObject("motion", motion),
  ].join("\n");
};

if (import.meta.main) {
  const program = Effect.gen(function* program() {
    const lightCss = yield* Effect.try({
      catch: (cause) => new Error(`Cannot read ${LIGHT_CSS}: ${String(cause)}`),
      try: () => readFileSync(LIGHT_CSS, "utf-8"),
    });
    const darkCss = yield* Effect.try({
      catch: (cause) => new Error(`Cannot read ${DARK_CSS}: ${String(cause)}`),
      try: () => readFileSync(DARK_CSS, "utf-8"),
    });
    yield* Effect.try({
      catch: (cause) => new Error(`Cannot write ${OUTPUT}: ${String(cause)}`),
      try: () => {
        mkdirSync(path.dirname(OUTPUT), { recursive: true });
        writeFileSync(OUTPUT, buildTokenModule(lightCss, darkCss), "utf-8");
      },
    });
    yield* Effect.log(`Wrote ${path.relative(repoRoot, OUTPUT)}`);
  });

  await Effect.runPromise(program);
}
