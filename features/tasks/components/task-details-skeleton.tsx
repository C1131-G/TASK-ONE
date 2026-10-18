/* eslint-disable shadcn/no-unknown-classes -- Skeletons share the workspace form classes. */

import { SkeletonBone } from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";

const Field = ({
  shape = "control",
}: {
  readonly shape?: "control" | "block";
}) => (
  <div className="field skeleton-copy">
    <SkeletonBone shape="short" />
    <SkeletonBone shape={shape} />
  </div>
);

// Mirrors TaskDetailsForm: title, description, two paired selects, three
// date/estimate fields, assignees and the save button.
const TaskDetailsFormSkeleton = () => (
  <SkelterSurface label="Loading task details…">
    <div className="stack">
      <Field />
      <Field shape="block" />
      <div className="row">
        <Field />
        <Field />
      </div>
      <div className="row">
        <Field />
        <Field />
        <Field />
      </div>
      <Field />
      <SkeletonBone shape="control" />
    </div>
  </SkelterSurface>
);

export { TaskDetailsFormSkeleton };
