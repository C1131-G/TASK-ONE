import "react";

declare module "react" {
  // Lets inline styles set CSS custom properties such as `--c` without a cast.
  interface CSSProperties {
    // React type augmentation needs interface merging for arbitrary CSS variables.
    // oxlint-disable-next-line typescript/consistent-indexed-object-style
    [name: `--${string}`]: string | number | undefined;
  }
}
