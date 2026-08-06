import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/40 px-6 py-10 text-center",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm ring-1 ring-border">
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
