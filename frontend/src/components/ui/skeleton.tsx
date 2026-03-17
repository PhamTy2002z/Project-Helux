import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-[color:var(--surface-strong)]", className)}
      {...props}
    />
  );
}

export { Skeleton };
