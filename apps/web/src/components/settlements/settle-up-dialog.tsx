"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SuggestedTransfer } from "@spenza/contracts";
import { createSettlementApi } from "@/lib/api-settlements";
import { buildSettlementInput, initialSettlementAmount } from "@/lib/settlement-input";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatMinorUnitCurrency } from "@/lib/money";

interface SettleUpDialogProps {
  groupId: string;
  currentUserId: string;
  suggestion: SuggestedTransfer;
  debtorName: string;
  creditorName: string;
  currency: string;
  isCurrentUserDebtor: boolean;
  isCurrentUserCreditor: boolean;
}

export function SettleUpDialog({
  groupId,
  currentUserId,
  suggestion,
  debtorName,
  creditorName,
  currency,
  isCurrentUserDebtor,
  isCurrentUserCreditor,
}: SettleUpDialogProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(() => initialSettlementAmount(suggestion));
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => createSettlementApi(
      groupId,
      buildSettlementInput(currentUserId, suggestion, amount, currency),
      idempotencyKey,
    ),
    onSuccess: async () => {
      toast.success("Settlement recorded successfully");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["balances", groupId] }),
        queryClient.invalidateQueries({ queryKey: ["group-details", groupId] }),
        queryClient.invalidateQueries({ queryKey: ["settlements", groupId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["activity"] }),
      ]);
      setOpen(false);
      setIdempotencyKey(crypto.randomUUID());
    },
    onError: (error) => toast.error(error.message || "Failed to record settlement"),
  });

  if (!isCurrentUserDebtor && !isCurrentUserCreditor) return null;
  if (!isCurrentUserDebtor) {
    return <Button variant="outline" size="sm" disabled title="Only the person who owes can record this payment">Waiting for payment</Button>;
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setAmount(initialSettlementAmount(suggestion));
      setIdempotencyKey(crypto.randomUUID());
    }
    setOpen(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="ml-auto">
          <HandCoins className="mr-2 h-4 w-4" />
          Settle Up
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Settle Up</DialogTitle>
          <DialogDescription>
            Record a full or partial payment. The API will verify it against the current outstanding balance.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-4">
          <div className="text-center">
            <p className="text-lg font-semibold">{debtorName} pays {creditorName}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Outstanding: {formatMinorUnitCurrency(suggestion.amountMinor, currency)}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`settlement-amount-${suggestion.senderId}-${suggestion.receiverId}`}>Payment amount ({currency})</Label>
            <Input
              id={`settlement-amount-${suggestion.senderId}-${suggestion.receiverId}`}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              autoComplete="off"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="w-full">
            {mutation.isPending ? "Recording..." : "Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
