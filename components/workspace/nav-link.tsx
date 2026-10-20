"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import type { ReactNode } from "react";

import { NavigationPendingIndicator } from "@/components/workspace/navigation-pending-indicator";

interface NavLinkProps {
  readonly href: Route;
  readonly className: string;
  // Added to className while the link names the current page.
  readonly activeClassName?: string;
  readonly isActive?: (pathname: string) => boolean;
  readonly transitionTypes?: (pathname: string) => string[];
  readonly children: ReactNode | ((active: boolean) => ReactNode);
}

const isExactMatch = (href: string) => (pathname: string) => pathname === href;

const NavLinkView = ({
  active,
  activeClassName,
  children,
  className,
  href,
  transitionTypes,
}: Omit<NavLinkProps, "isActive" | "transitionTypes"> & {
  readonly active: boolean;
  readonly transitionTypes: string[];
}) => (
  <Link
    aria-current={active ? "page" : undefined}
    className={
      active && activeClassName ? `${className} ${activeClassName}` : className
    }
    href={href}
    transitionTypes={transitionTypes}
  >
    {typeof children === "function" ? children(active) : children}
    <NavigationPendingIndicator />
  </Link>
);

const ActiveNavLink = ({
  isActive,
  transitionTypes,
  ...props
}: NavLinkProps) => {
  const pathname = usePathname();
  return (
    <NavLinkView
      {...props}
      active={(isActive ?? isExactMatch(props.href))(pathname)}
      transitionTypes={transitionTypes?.(pathname) ?? []}
    />
  );
};

// The one link primitive for navigation: it marks the current page from the
// URL and shows its own pending state. Until the URL is read on a dynamic
// route the link renders inactive, so the shell stays in the static shell.
export const NavLink = (props: NavLinkProps) => {
  const {
    isActive: _isActive,
    transitionTypes: _transitionTypes,
    ...view
  } = props;
  return (
    <Suspense
      fallback={<NavLinkView {...view} active={false} transitionTypes={[]} />}
    >
      <ActiveNavLink {...props} />
    </Suspense>
  );
};
