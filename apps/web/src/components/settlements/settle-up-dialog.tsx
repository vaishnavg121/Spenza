"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSettlementApi } from "@/lib/api-settlements";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { HandCoins } from "lucide-react";
import { formatMinorUnitToAmount } from "@/lib/money";

interface SettleUpDialogProps {
  groupId: string;
  creditorId: string;
  debtorName: string;
  creditorName: string;
  amountMinor: string;
  isCurrentUserDebtor: boolean;
  isCurrentUserCreditor: boolean;
}

export function SettleUpDialog({
  groupId,
  creditorId,
  debtorName,
  creditorName,
  amountMinor,
  isCurrentUserDebtor,
  isCurrentUserCreditor,
}: SettleUpDialogProps) {
  const [open, setOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      return createSettlementApi(
        groupId,
        {
          receiverId: creditorId,
          amountMinor,
          currency: "USD",
          method: "CASH",
        },
        idempotencyKey
      );
    },
    onSuccess: () => {
      toast.success("Settlement recorded successfully");
      queryClient.invalidateQueries({ queryKey: ["balances", groupId] });
      queryClient.invalidateQueries({ queryKey: ["group-details", groupId] });
      queryClient.invalidateQueries({ queryKey: ["settlements", groupId] });
      setOpen(false);
      setIdempotencyKey(crypto.randomUUID());
    },
    onError: (error) => {
      toast.error(error.message || "Failed to record settlement");
    },
  });

  const handleSettle = () => {
    mutation.mutate();
  };

  // Only show button if current user is involved in the debt
  if (!isCurrentUserDebtor && !isCurrentUserCreditor) {
    return null;
  }

  // If the current user is the creditor, they can't use this specific button yet (as our action hardcodes payer as session.user)
  // Let's only enable it if current user is debtor for now to ensure data integrity
  if (!isCurrentUserDebtor) {
      return (
          <Button variant="outline" size="sm" disabled title="Wait for them to settle">
             Waiting
          </Button>
      )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="ml-auto">
          <HandCoins className="mr-2 h-4 w-4" />
          Settle
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Settle Up</DialogTitle>
          <DialogDescription>
            Record a cash payment to clear this debt.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center space-y-4 py-6 text-center">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-lg">
             <span className="font-semibold">{debtorName}</span>
             <span className="text-muted-foreground">→</span>
             <span className="font-semibold">{creditorName}</span>
          </div>
          <div className="text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
             ${formatMinorUnitToAmount(amountMinor)}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSettle} disabled={mutation.isPending} className="w-full">
            {mutation.isPending ? "Recording..." : "Record Cash Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
