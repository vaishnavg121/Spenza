"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ExpenseResponse, UpdateExpenseInput } from "@spenza/contracts";
import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fetchExpenseByIdApi, updateExpenseApi, voidExpenseApi } from "@/lib/api-expenses";
import { formatMinorUnitCurrency, formatMinorUnitToAmount, parseAmountToMinorUnit } from "@/lib/money";
import { ReceiptManager } from "@/components/receipts/receipt-manager";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

type Member = { id: string; name: string; image: string | null };
type SplitEditMode = "UNCHANGED" | "EQUAL" | "EXACT";

interface ExpenseDetailDialogProps {
  expense: ExpenseResponse;
  groupId: string;
  members: Member[];
  currentUserId: string;
}

export function ExpenseDetailDialog({ expense, groupId, members, currentUserId }: ExpenseDetailDialogProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingVoid, setConfirmingVoid] = useState(false);
  const detail = useQuery({
    queryKey: ["expense", groupId, expense.id],
    queryFn: () => fetchExpenseByIdApi(groupId, expense.id),
    enabled: open,
    initialData: expense,
  });
  const current = detail.data;
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const nameFor = (userId: string) => memberById.get(userId)?.name ?? "Former group member";

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) { setEditing(false); setConfirmingVoid(false); } }}>
      <DialogTrigger asChild>
        <button type="button" className="flex w-full flex-col gap-4 rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-muted text-center leading-tight">
              <span className="text-xs font-medium uppercase text-muted-foreground">{format(new Date(expense.date), "MMM")}</span>
              <span className="text-lg font-bold">{format(new Date(expense.date), "dd")}</span>
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">{expense.title}</p>
              <p className="text-sm font-medium">{formatMinorUnitCurrency(expense.totalMinor, expense.currency)}</p>
              <p className="text-xs text-muted-foreground">Open expense details</p>
            </div>
          </div>
          <ExpensePosition expense={expense} currentUserId={currentUserId} />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>{current.title}</DialogTitle>
            <Badge variant={current.voidedAt ? "destructive" : "secondary"}>{current.voidedAt ? "Voided" : "Active"}</Badge>
          </div>
          <DialogDescription>{formatMinorUnitCurrency(current.totalMinor, current.currency)} · {format(new Date(current.date), "PPP")}</DialogDescription>
        </DialogHeader>

        {editing ? (
          <ExpenseEditForm expense={current} members={members} groupId={groupId} onCancel={() => setEditing(false)} onSaved={() => setEditing(false)} />
        ) : (
          <div className="space-y-6">
            {current.description ? <p className="text-sm leading-6 text-muted-foreground">{current.description}</p> : null}
            <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-3">
              <DetailStat label="Paid by" value={current.payers.map((payer) => nameFor(payer.userId)).join(", ")} />
              <DetailStat label="Created by" value={nameFor(current.creatorId)} />
              <DetailStat label="Revision" value={`Version ${current.version}`} />
              {current.categoryName ? <DetailStat label="Category" value={current.categoryName} /> : null}
            </div>
            <section className="space-y-3" aria-labelledby={`participants-${current.id}`}>
              <h3 id={`participants-${current.id}`} className="font-semibold">Participants and final shares</h3>
              <div className="divide-y rounded-xl border">
                {current.allocations.map((allocation) => {
                  const member = memberById.get(allocation.userId);
                  return <div key={allocation.userId} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="size-8"><AvatarImage src={member?.image || ""} /><AvatarFallback>{nameFor(allocation.userId).slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                      <span className="truncate text-sm font-medium">{nameFor(allocation.userId)}{allocation.userId === currentUserId ? " (You)" : ""}</span>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">{formatMinorUnitCurrency(allocation.allocationMinor, current.currency)}</span>
                  </div>;
                })}
              </div>
            </section>
            <section className="space-y-2">
              <h3 className="font-semibold">Receipts</h3>
              <ReceiptManager groupId={groupId} expenseId={current.id} />
            </section>
            {!current.voidedAt ? <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="mr-2 size-4" />Edit expense</Button>
              <Button variant="destructive" onClick={() => setConfirmingVoid(true)}><Trash2 className="mr-2 size-4" />Void expense</Button>
            </div> : null}
            {confirmingVoid ? <VoidConfirmation expense={current} groupId={groupId} onCancel={() => setConfirmingVoid(false)} onVoided={() => setConfirmingVoid(false)} /> : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>;
}

function ExpensePosition({ expense, currentUserId }: { expense: ExpenseResponse; currentUserId: string }) {
  const paid = BigInt(expense.payers.find((payer) => payer.userId === currentUserId)?.contributionMinor ?? "0");
  const allocated = BigInt(expense.allocations.find((allocation) => allocation.userId === currentUserId)?.allocationMinor ?? "0");
  const net = paid - allocated;
  const zero = BigInt(0);
  const label = net > zero ? "You lent" : net < zero ? "You owe" : paid > zero || allocated > zero ? "Settled up" : "Not involved";
  return <div className="border-t pt-3 sm:border-0 sm:pt-0 sm:text-right"><p className={net > zero ? "text-xs font-medium text-emerald-600" : net < zero ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}>{label}</p>{net !== zero ? <p className="font-bold tabular-nums">{formatMinorUnitCurrency((net < zero ? -net : net).toString(), expense.currency)}</p> : null}</div>;
}

function ExpenseEditForm({ expense, members, groupId, onCancel, onSaved }: { expense: ExpenseResponse; members: Member[]; groupId: string; onCancel: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(expense.title);
  const [description, setDescription] = useState(expense.description ?? "");
  const [date, setDate] = useState(format(new Date(expense.date), "yyyy-MM-dd"));
  const [amount, setAmount] = useState(formatMinorUnitToAmount(expense.totalMinor));
  const [payerId, setPayerId] = useState(expense.payers[0]?.userId ?? "");
  const [splitMode, setSplitMode] = useState<SplitEditMode>("UNCHANGED");
  const [selectedIds, setSelectedIds] = useState(() => new Set(expense.allocations.map((allocation) => allocation.userId)));
  const [exactAmounts, setExactAmounts] = useState(() => Object.fromEntries(expense.allocations.map((allocation) => [allocation.userId, formatMinorUnitToAmount(allocation.allocationMinor)])));
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      const totalMinor = parseAmountToMinorUnit(amount);
      if (!title.trim()) throw new Error("Enter an expense description");
      if (!totalMinor || totalMinor === "0") throw new Error("Enter a valid positive amount");
      if (expense.payers.length > 1 && totalMinor !== expense.totalMinor) throw new Error("Amount editing is unavailable for multi-payer expenses");
      const input: UpdateExpenseInput = {
        expectedVersion: expense.version,
        title: title.trim(),
        description: description.trim() || null,
        date: new Date(`${date}T12:00:00.000Z`).toISOString(),
        totalMinor,
      };
      if (expense.payers.length === 1) input.payers = [{ userId: payerId, amountMinor: totalMinor }];
      if (splitMode !== "UNCHANGED") {
        const participants = members.filter((member) => selectedIds.has(member.id));
        if (participants.length === 0) throw new Error("Select at least one participant");
        if (splitMode === "EQUAL") input.split = { type: "EQUAL", participants: participants.map((member) => ({ userId: member.id })) };
        else {
          const exact = participants.map((member) => {
            const amountMinor = parseAmountToMinorUnit(exactAmounts[member.id] ?? "");
            if (amountMinor === null) throw new Error(`Enter a valid share for ${member.name}`);
            return { userId: member.id, amountMinor };
          });
          if (exact.reduce((sum, participant) => sum + BigInt(participant.amountMinor), BigInt(0)) !== BigInt(totalMinor)) throw new Error("Exact shares must add up to the expense total");
          input.split = { type: "EXACT", participants: exact };
        }
      }
      return updateExpenseApi(groupId, expense.id, input);
    },
    onSuccess: async (updated) => {
      queryClient.setQueryData(["expense", groupId, expense.id], updated);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["expenses", groupId] }),
        queryClient.invalidateQueries({ queryKey: ["balances", groupId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-data"] }),
        queryClient.invalidateQueries({ queryKey: ["activity"] }),
      ]);
      toast.success("Expense updated");
      onSaved();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to update expense"),
  });

  return <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Description"><Input aria-label="Description" value={title} onChange={(event) => setTitle(event.target.value)} /></Field><Field label="Amount"><Input aria-label="Amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field></div>
    <Field label="Notes"><Input aria-label="Notes" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional notes" /></Field>
    <Field label="Date"><Input aria-label="Date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
    {expense.payers.length === 1 ? <Field label="Paid by"><Select value={payerId} onValueChange={(value) => value && setPayerId(value)} items={Object.fromEntries(members.map((member) => [member.id, member.name]))}><SelectTrigger>{members.find((member) => member.id === payerId)?.name ?? "Choose payer"}</SelectTrigger><SelectContent>{members.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}</SelectContent></Select></Field> : <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">This expense has multiple payers. Their contributions are preserved; payer and amount editing is unavailable in this MVP form.</p>}
    <Field label="Split"><Select value={splitMode} onValueChange={(value) => value && setSplitMode(value as SplitEditMode)} items={{ UNCHANGED: "Keep current split", EQUAL: "Equal", EXACT: "Exact" }}><SelectTrigger>{splitMode === "UNCHANGED" ? "Keep current split" : splitMode === "EQUAL" ? "Equal" : "Exact amounts"}</SelectTrigger><SelectContent><SelectItem value="UNCHANGED">Keep current split</SelectItem><SelectItem value="EQUAL">Equal</SelectItem><SelectItem value="EXACT">Exact amounts</SelectItem></SelectContent></Select></Field>
    {splitMode !== "UNCHANGED" ? <div className="space-y-3 rounded-xl border p-4">{members.map((member) => <div key={member.id} className="flex min-h-11 items-center gap-3"><Checkbox checked={selectedIds.has(member.id)} onCheckedChange={(checked) => setSelectedIds((current) => { const next = new Set(current); if (checked) next.add(member.id); else next.delete(member.id); return next; })} aria-label={`Include ${member.name}`} /><span className="min-w-0 flex-1 truncate text-sm font-medium">{member.name}</span>{splitMode === "EXACT" ? <Input className="w-28" inputMode="decimal" value={exactAmounts[member.id] ?? ""} disabled={!selectedIds.has(member.id)} onChange={(event) => setExactAmounts((current) => ({ ...current, [member.id]: event.target.value }))} aria-label={`${member.name} exact share`} /> : null}</div>)}</div> : null}
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : "Save changes"}</Button></div>
  </form>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }

function VoidConfirmation({ expense, groupId, onCancel, onVoided }: { expense: ExpenseResponse; groupId: string; onCancel: () => void; onVoided: () => void }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => voidExpenseApi(groupId, expense.id, { expectedVersion: expense.version }),
    onSuccess: async (voided) => {
      queryClient.setQueryData(["expense", groupId, expense.id], voided);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["expenses", groupId] }),
        queryClient.invalidateQueries({ queryKey: ["balances", groupId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-data"] }),
        queryClient.invalidateQueries({ queryKey: ["activity"] }),
      ]);
      toast.success("Expense voided; its history was retained");
      onVoided();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to void expense"),
  });
  return <div role="alertdialog" aria-modal="true" aria-labelledby={`void-${expense.id}`} className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4"><h3 id={`void-${expense.id}`} className="font-semibold">Void this expense?</h3><p className="text-sm text-muted-foreground">The expense will be excluded from active balances, while revisions and receipts remain in the audit history.</p><div className="flex justify-end gap-2"><Button variant="outline" onClick={onCancel}>Cancel</Button><Button variant="destructive" onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? "Voiding…" : "Confirm void"}</Button></div></div>;
}
