/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles */

"use client";

import {
  Briefcase,
  Buildings,
  Code,
  Cube,
  DeviceMobile,
  FolderOpen,
  Globe,
  Heart,
  Lightning,
  Megaphone,
  Palette,
  RocketLaunch,
  Sparkle,
  SquaresFour,
  Stack,
  Target,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

const icons: Readonly<Record<string, Icon>> = {
  briefcase: Briefcase,
  "building-2": Buildings,
  code: Code,
  component: Cube,
  folder: FolderOpen,
  globe: Globe,
  heart: Heart,
  layers: Stack,
  "layout-grid": SquaresFour,
  megaphone: Megaphone,
  palette: Palette,
  rocket: RocketLaunch,
  smartphone: DeviceMobile,
  sparkles: Sparkle,
  target: Target,
  zap: Lightning,
};

const ProjectIcon = ({
  icon,
  color,
  size = 14,
}: {
  readonly icon: string;
  readonly color: string;
  readonly size?: number;
}) => {
  const IconComponent = icons[icon] ?? FolderOpen;
  return (
    <span
      aria-hidden="true"
      className="pico"
      style={{ "--c": color } as React.CSSProperties}
    >
      <IconComponent size={size} weight="regular" />
    </span>
  );
};

export { ProjectIcon };
