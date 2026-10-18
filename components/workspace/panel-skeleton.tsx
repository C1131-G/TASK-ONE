import { PanelSkeletonLayout } from "@/components/workspace/panel-skeleton-layout";
import type { SkeletonVariant } from "@/components/workspace/panel-skeleton-layout";
import { SkelterSurface } from "@/components/workspace/skelter-surface";

const PanelSkeleton = ({
  label,
  rows = 5,
  title,
  variant = "list",
}: {
  readonly label: string;
  readonly rows?: number;
  readonly title?: string | undefined;
  readonly variant?: SkeletonVariant;
}) => (
  <SkelterSurface label={label}>
    <PanelSkeletonLayout rows={rows} title={title} variant={variant} />
  </SkelterSurface>
);

export { PanelSkeleton };
