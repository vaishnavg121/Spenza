"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchExpenseSearchApi } from "@/lib/api-search";
import { parseAmountToMinorUnit, formatMinorUnitToAmount } from "@/lib/money";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Receipt, DollarSign } from "lucide-react";
import { format } from "date-fns";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  const minAmountMinor = minAmount ? parseAmountToMinorUnit(minAmount) : null;
  const maxAmountMinor = maxAmount ? parseAmountToMinorUnit(maxAmount) : null;

  const searchParams: Record<string, string> = {};
  if (query.trim()) searchParams.q = query.trim();
  if (minAmountMinor) searchParams.minAmountMinor = minAmountMinor;
  if (maxAmountMinor) searchParams.maxAmountMinor = maxAmountMinor;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["expense-search", searchParams],
    queryFn: () => fetchExpenseSearchApi(searchParams),
  });

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Search Expenses"
        description="Filter and search expenses across all your authorized groups."
      />

      <div className="grid gap-4 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-3">
        <div className="relative sm:col-span-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by title or description..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="Min amount ($)"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="Max amount ($)"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={Receipt}
          title="Search failed"
          description="Could not perform expense search. Please check your filter inputs."
          action={
            <button
              type="button"
              onClick={() => refetch()}
              className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Try again
            </button>
          }
        />
      ) : data?.data.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No expenses found"
          description="Try adjusting your search query or price bounds."
        />
      ) : (
        <div className="space-y-3">
          {data?.data.map((expense) => (
            <div
              key={expense.id}
              className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between sm:p-5"
            >
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-muted text-center leading-tight">
                  <span className="text-xs font-medium uppercase text-muted-foreground">
                    {format(new Date(expense.date), "MMM")}
                  </span>
                  <span className="text-lg font-bold">{format(new Date(expense.date), "dd")}</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{expense.title}</p>
                  {expense.description && (
                    <p className="truncate text-xs text-muted-foreground">{expense.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between border-t pt-3 sm:border-0 sm:pt-0">
                <span className="text-base font-bold tabular-nums text-foreground">
                  ${formatMinorUnitToAmount(expense.totalMinor)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
