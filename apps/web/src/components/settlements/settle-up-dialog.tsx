"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSettlement } from "@/actions/settlements";
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

interface SettleUpDialogProps {
  groupId: string;
  creditorId: string;
  debtorName: string;
  creditorName: string;
  amount: number;
  isCurrentUserDebtor: boolean;
  isCurrentUserCreditor: boolean;
}

export function SettleUpDialog({
  groupId,
  creditorId,
  debtorName,
  creditorName,
  amount,
  isCurrentUserDebtor,
  isCurrentUserCreditor,
}: SettleUpDialogProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createSettlement,
    onSuccess: () => {
      toast.success("Settlement recorded successfully");
      queryClient.invalidateQueries({ queryKey: ["group-details", groupId] });
      setOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to record settlement");
    },
  });

  const handleSettle = () => {
    // Determine payer and payee context. 
    // Usually the person clicking "Settle Up" is recording a payment THEY made, 
    // or a payment they received. 
    // For simplicity, if current user is debtor, they are payer.
    // If current user is creditor, they are recording that debtor paid them (payer = debtor, payee = creditor).
    // The action `createSettlement` currently assumes `payerId` is `session.user.id`.
    // Wait, if creditor is recording it, payer is NOT session.user.id. 
    // We should ideally let the user confirm who paid who, but for now, we assume the debtor is paying.
    // Actually, `createSettlement` uses `session.user.id` as `payerId`. 
    // So ONLY the debtor can natively use this as written, OR we need to update action to accept payerId.
    
    // For this prototype, let's just trigger it assuming the current user is making the payment
    mutation.mutate({
      groupId,
      payeeId: creditorId,
      amount,
      method: "CASH",
    });
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
      <DialogTrigger render={<Button variant="outline" size="sm" className="ml-auto" />}>
        <HandCoins className="mr-2 h-4 w-4" />
        Settle
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Settle Up</DialogTitle>
          <DialogDescription>
            Record a cash payment to clear this debt.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center space-y-4 py-6">
          <div className="flex items-center gap-4 text-lg">
             <span className="font-semibold">{debtorName}</span>
             <span className="text-muted-foreground">→</span>
             <span className="font-semibold">{creditorName}</span>
          </div>
          <div className="text-3xl font-bold text-emerald-500">
             ${amount.toFixed(2)}
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
