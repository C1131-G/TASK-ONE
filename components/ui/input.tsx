import * as React from "react"
import { cn } from "cn"

function Input({
  className,
  type,
  trailingAction = false,
  ...props
}: React.ComponentProps<"input"> & { trailingAction?: boolean }) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3.5 py-2 text-base shadow-[inset_0_1px_2px_rgb(20_40_50/0.04)] transition-[border-color,background-color,box-shadow] duration-150 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:shadow-[inset_0_1px_2px_rgb(0_0_0/0.2)] dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 motion-reduce:transition-none",
        trailingAction && "pr-12",
        className
      )}
      {...props}
    />
  )
}

export { Input }
