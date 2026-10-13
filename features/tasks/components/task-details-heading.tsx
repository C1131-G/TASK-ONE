/* eslint-disable shadcn/no-unknown-classes */

import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export const TaskDetailsHeading = ({
  title,
  isBug,
}: {
  readonly title: string;
  readonly isBug: boolean;
}) => (
  <SheetHeader>
    <SheetTitle>{title}</SheetTitle>
    <SheetDescription>
      {isBug
        ? "Review discovery, investigation, evidence, verification, and release history."
        : "Edit details, subtasks, labels, dependencies, recurrence, comments, and files."}
    </SheetDescription>
  </SheetHeader>
);
