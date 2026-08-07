"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchSettlementsApi, reverseSettlementApi } from "@/lib/api-settlements";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatMinorUnitToAmount } from "@/lib/money";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { HandCoins } from "lucide-react";

interface SettlementHistoryProps {
  groupId: string;
  members: {
    userId: string;
    user: { id: string; name: string; image: string | null };
  }[];
  currentUserId: string;
}

export function SettlementHistory({ groupId, members, currentUserId }: SettlementHistoryProps) {
  const queryClient = useQueryClient();
  const [reversingId, setReversingId] = useState<string | null>(null);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["settlements", groupId],
    queryFn: () => fetchSettlementsApi(groupId),
  });

  const reverseMutation = useMutation({
    mutationFn: async (settlementId: string) => {
      const idempotencyKey = crypto.randomUUID();
      return reverseSettlementApi(groupId, settlementId, idempotencyKey);
    },
    onSuccess: () => {
      toast.success("Settlement reversed successfully");
      queryClient.invalidateQueries({ queryKey: ["settlements", groupId] });
      queryClient.invalidateQueries({ queryKey: ["balances", groupId] });
      queryClient.invalidateQueries({ queryKey: ["group-details", groupId] });
      setReversingId(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to reverse settlement");
      setReversingId(null);
    },
  });

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Loading settlement history...</div>;
  }

  if (error || !data) {
    return <div className="py-8 text-center text-destructive">Failed to load settlement history.</div>;
  }

  if (data.data.length === 0) {
    return (
      <EmptyState
        icon={HandCoins}
        title="No settlements yet"
        description="Recorded payments will appear here."
      />
    );
  }

  const getMember = (id: string) => members.find(m => m.userId === id)?.user;

  return (
    <div className="space-y-4">
      {data.data.map((settlement) => {
        const payer = getMember(settlement.payerId);
        const receiver = getMember(settlement.receiverId);

        if (!payer || !receiver) return null;

        const isPayment = settlement.kind === "PAYMENT";
        const isReversed = isPayment && data.data.some((s) => s.kind === "REVERSAL" && s.reversesId === settlement.id);
        const isCurrentUserPayer = settlement.payerId === currentUserId;

        return (
          <div key={settlement.id} className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-muted text-center leading-tight">
                 <span className="text-xs text-muted-foreground font-medium uppercase">{format(new Date(settlement.date), 'MMM')}</span>
                 <span className="text-lg font-bold">{format(new Date(settlement.date), 'dd')}</span>
              </div>
              <div className="min-w-0">
                <p className="font-medium">
                  {isPayment ? (
                    <>
                      {isCurrentUserPayer ? "You" : payer.name} paid {receiver.name}
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      Reversal of payment to {receiver.name}
                    </span>
                  )}
                </p>
                <p className={`text-sm ${isReversed ? "text-destructive line-through" : "text-muted-foreground"}`}>
                  ${formatMinorUnitToAmount(settlement.amountMinor)}
                </p>
              </div>
            </div>

            {isPayment && !isReversed && isCurrentUserPayer && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setReversingId(settlement.id);
                  reverseMutation.mutate(settlement.id);
                }}
                disabled={reverseMutation.isPending || reversingId !== null}
                className="ml-auto text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {reversingId === settlement.id ? "Reversing..." : "Reverse"}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
