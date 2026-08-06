import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-label="Loading dashboard content" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((item) => <Skeleton key={item} className="h-32 rounded-2xl" />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}
