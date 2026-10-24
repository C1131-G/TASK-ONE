import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const mobileRoot = fileURLToPath(new URL("../..", import.meta.url));

const SOURCE_DIRECTORIES = ["src", "app"];

type Violation = { kind: string; line: number; character: number };

const BANNED_MEMBERS = new Set(["then", "catch"]);

const collectViolations = (source: string, fileName: string): Violation[] => {
  const kind = fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const ast = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
  const violations: Violation[] = [];

  const report = (node: ts.Node, violationKind: string): void => {
    const { line, character } = ast.getLineAndCharacterOfPosition(node.getStart());
    violations.push({ kind: violationKind, line: line + 1, character: character + 1 });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isTryStatement(node)) {
      report(node, "TryStatement");
    } else if (ts.isThrowStatement(node)) {
      report(node, "ThrowStatement");
    } else if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      BANNED_MEMBERS.has(node.expression.name.text)
    ) {
      report(node, `MemberCall.${node.expression.name.text}`);
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(ast, visit);
  return violations;
};

const listSourceFiles = (): string[] =>
  SOURCE_DIRECTORIES.flatMap((directory) => {
    const root = path.join(mobileRoot, directory);
    if (!existsSync(root)) {
      return [];
    }
    return readdirSync(root, { recursive: true, encoding: "utf8" })
      .filter((entry) => /\.(ts|tsx)$/u.test(entry))
      .map((entry) => path.join(root, entry));
  });

describe("the no-try-catch guard", () => {
  it.each([
    ["try/catch", "const f = () => { try { run(); } catch (error) { fail(); } };", "TryStatement"],
    ["throw", "const f = () => { throw new Error('no'); };", "ThrowStatement"],
    ["promise then", "const f = () => load().then(save);", "MemberCall.then"],
    ["promise catch", "const f = () => load().catch(react);", "MemberCall.catch"],
  ])("detects %s", (_label, source, expectedKind) => {
    const violations = collectViolations(source, "sample.ts");

    expect(violations).toEqual([{ kind: expectedKind, line: 1, character: expect.any(Number) }]);
  });

  it("accepts Effect-style code without forbidden syntax", () => {
    const source = [
      "import { Effect } from 'effect';",
      "export const program = Effect.gen(function* () {",
      "  const value = yield* load();",
      "  return value + 1;",
      "});",
    ].join("\n");

    expect(collectViolations(source, "sample.ts")).toEqual([]);
  });

  it("finds no forbidden syntax in the app source", () => {
    const violations = listSourceFiles().flatMap((file) =>
      collectViolations(readFileSync(file, "utf8"), file),
    );

    expect(violations).toEqual([]);
  });
});
