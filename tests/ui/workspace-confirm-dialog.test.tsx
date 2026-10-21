import { expect, test } from "bun:test";

import { createElement, isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { WorkspaceConfirmDialog } from "@/components/workspace/workspace-confirm-dialog";

interface ElementProps {
  readonly children?: ReactNode;
  readonly [prop: string]: unknown;
}

// The dialog content is portalled and never renders on the server, so the
// wiring is read from the element tree the component returns.
const findAll = (
  node: ReactNode,
  type: unknown
): ReactElement<ElementProps>[] => {
  const found: ReactElement<ElementProps>[] = [];
  const children: unknown[] = [node].flat(Number.POSITIVE_INFINITY);
  for (const child of children) {
    if (isValidElement<ElementProps>(child)) {
      if (child.type === type) {
        found.push(child);
      }
      found.push(...findAll(child.props.children, type));
    }
  }
  return found;
};

const onOpenChange = () => {};

const copy = {
  confirmLabel: "Delete event",
  description: "This cannot be undone.",
  title: "Delete this event?",
};

test("a controlled dialog passes its open state and change handler through", () => {
  const root = WorkspaceConfirmDialog({
    ...copy,
    onConfirm: () => {},
    onOpenChange,
    open: true,
  });

  expect(root.props.open).toBe(true);
  expect(root.props.onOpenChange).toBe(onOpenChange);
});

test("a controlled dialog shows its copy and confirm label", () => {
  const root = WorkspaceConfirmDialog({
    ...copy,
    onConfirm: () => {},
    onOpenChange: () => {},
    open: true,
  });
  const [title] = findAll(root, AlertDialogTitle);
  const [description] = findAll(root, AlertDialogDescription);
  const [action] = findAll(root, AlertDialogAction);
  const [cancel] = findAll(root, AlertDialogCancel);

  expect(title?.props.children).toBe(copy.title);
  expect(description?.props.children).toBe(copy.description);
  expect(action?.props.children).toBe(copy.confirmLabel);
  expect(cancel?.props.children).toBe("Cancel");
});

test("only the confirm button runs the confirm callback", () => {
  let confirmed = 0;
  const onConfirm = () => {
    confirmed += 1;
  };
  const root = WorkspaceConfirmDialog({
    ...copy,
    onConfirm,
    onOpenChange: () => {},
    open: true,
  });
  const [action] = findAll(root, AlertDialogAction);
  const [cancel] = findAll(root, AlertDialogCancel);

  expect(cancel?.props["onClick"]).toBeUndefined();
  expect(action?.props["onClick"]).toBe(onConfirm);
  expect(confirmed).toBe(0);
});

test("a dialog with a trigger child renders that trigger and starts closed", () => {
  const markup = renderToStaticMarkup(
    <WorkspaceConfirmDialog {...copy} onConfirm={() => {}}>
      <button type="button">Delete</button>
    </WorkspaceConfirmDialog>
  );

  expect(markup).toContain("Delete</button>");
  expect(markup).toContain('aria-haspopup="dialog"');
  expect(markup).toContain('aria-expanded="false"');
  expect(markup).not.toContain(copy.title);
});

test("a controlled closed dialog renders no trigger and no content", () => {
  const markup = renderToStaticMarkup(
    createElement(WorkspaceConfirmDialog, {
      ...copy,
      onConfirm: () => {},
      onOpenChange: () => {},
      open: false,
    })
  );

  expect(markup).toBe("");
});
