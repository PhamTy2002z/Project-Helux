import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "flex h-11 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 text-sm text-strong shadow-sm focus-visible:outline-none",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
