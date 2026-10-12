"use client"

import * as React from "react"
import { cn } from "cn"
import { Progress as ProgressPrimitive } from "radix-ui"

function Progress({
  className,
  value,
  workspace = false,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  workspace?: boolean
}) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      data-workspace-progress={workspace || undefined}
      className={cn(
        "relative flex h-3 w-full items-center overflow-x-hidden rounded-full bg-muted",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="size-full flex-1 bg-primary transition-transform motion-reduce:transition-none"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
