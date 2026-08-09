"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createExpenseApiFormSchema } from "@/lib/expense-schema";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Receipt } from "lucide-react";
import { createExpenseApi } from "@/lib/api-expenses";
import {
  buildExpenseInput,
  calculateExactTotalMinor,
  calculatePercentageTotalBps,
  createInitialExpenseSplits,
} from "@/lib/expense-input";
import { formatMinorUnitToAmount, parseAmountToMinorUnit } from "@/lib/money";

type Member = {
  id: string;
  name: string;
  image: string | null;
};

interface AddExpenseDialogProps {
  groupId: string;
  members: Member[];
  currentUserId: string;
  currency?: string;
}

function formatBasisPoints(basisPoints: number): string {
  const whole = Math.floor(basisPoints / 100);
  const fraction = (basisPoints % 100).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}

export function AddExpenseDialog({ groupId, members, currentUserId, currency = "USD" }: AddExpenseDialogProps) {
  const [open, setOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const queryClient = useQueryClient();

  const form = useForm<
    z.input<typeof createExpenseApiFormSchema>,
    undefined,
    z.output<typeof createExpenseApiFormSchema>
  >({
    resolver: zodResolver(createExpenseApiFormSchema),
    defaultValues: {
      groupId,
      title: "",
      amount: "",
      payerId: currentUserId,
      splitType: "EQUAL",
      splits: createInitialExpenseSplits(members.map((member) => member.id), "EQUAL"),
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "splits",
  });

  const { setValue } = form;
  const splitType = useWatch({ control: form.control, name: "splitType" });
  const amount = useWatch({ control: form.control, name: "amount" }) ?? "";
  const splits = useWatch({ control: form.control, name: "splits" }) ?? [];

  // Reset split values when changing split type
  useEffect(() => {
    setValue("splits", createInitialExpenseSplits(members.map((member) => member.id), splitType));
  }, [members, setValue, splitType]);

  const mutation = useMutation({
    mutationFn: async (values: z.output<typeof createExpenseApiFormSchema>) => {
      const payload = buildExpenseInput(values, currency, members.map((member) => member.id));

      return createExpenseApi(values.groupId, payload, idempotencyKey);
    },
    onSuccess: () => {
      toast.success("Expense added successfully");
      queryClient.invalidateQueries({ queryKey: ["group-details", groupId] });
      queryClient.invalidateQueries({ queryKey: ["expenses", groupId] });
      setOpen(false);
      form.reset({
          groupId,
          title: "",
          amount: "",
          payerId: currentUserId,
          splitType: "EQUAL",
          splits: createInitialExpenseSplits(members.map((member) => member.id), "EQUAL"),
      });
      setIdempotencyKey(crypto.randomUUID());
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add expense");
    },
  });

  function onSubmit(values: z.output<typeof createExpenseApiFormSchema>) {
    mutation.mutate(values);
  }

  const getMemberDetails = (userId: string) => members.find((m) => m.id === userId);
  const exactTotalMinor = calculateExactTotalMinor(splits);
  const expenseTotalMinor = parseAmountToMinorUnit(amount, 2);
  const percentageTotalBps = calculatePercentageTotalBps(splits);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      form.reset({
        groupId,
        title: "",
        amount: "",
        payerId: currentUserId,
        splitType: "EQUAL",
        splits: createInitialExpenseSplits(members.map((member) => member.id), "EQUAL"),
      });
      setIdempotencyKey(crypto.randomUUID());
    }
    setOpen(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">
          <Receipt className="mr-2 h-4 w-4" />
          Add Expense
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Add an Expense</DialogTitle>
          <DialogDescription>
            Enter expense details and choose how to split it.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
               <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                     <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                        <Input placeholder="Dinner, Taxi, etc." {...field} />
                        </FormControl>
                        <FormMessage />
                     </FormItem>
                  )}
               />
               <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                     <FormItem>
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                        <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            {...field}
                        />
                        </FormControl>
                        <FormMessage />
                     </FormItem>
                  )}
               />
            </div>

            <FormField
              control={form.control}
              name="payerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paid By</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    items={Object.fromEntries(
                      members.map((member) => [
                        member.id,
                        `${member.name}${member.id === currentUserId ? " (You)" : ""}`,
                      ]),
                    )}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <span className="flex flex-1 text-left">
                          {getMemberDetails(field.value)?.name ?? "Select who paid"}
                          {field.value === currentUserId ? " (You)" : ""}
                        </span>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} {m.id === currentUserId ? "(You)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
               control={form.control}
               name="splitType"
               render={({ field }) => (
                  <FormItem>
                     <FormLabel>Split Type</FormLabel>
                     <Tabs value={field.value} onValueChange={field.onChange} className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                           <TabsTrigger className="px-1 text-xs sm:px-2 sm:text-sm" value="EQUAL">Equal</TabsTrigger>
                           <TabsTrigger className="px-1 text-xs sm:px-2 sm:text-sm" value="EXACT">Exact</TabsTrigger>
                           <TabsTrigger className="px-1 text-xs sm:px-2 sm:text-sm" value="PERCENTAGE">%</TabsTrigger>
                           <TabsTrigger className="px-1 text-xs sm:px-2 sm:text-sm" value="SHARES">Shares</TabsTrigger>
                        </TabsList>
                     </Tabs>
                  </FormItem>
               )}
            />

            <div className="space-y-4 rounded-xl border bg-muted/20 p-4 sm:p-5">
               <h4 className="text-sm font-medium">Split Details</h4>
               {fields.map((field, index) => {
                  const member = getMemberDetails(field.userId);
                  if (!member) return null;
                  
                  return (
                     <div key={field.id} className="flex min-h-11 items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                           <Avatar className="h-8 w-8">
                              <AvatarImage src={member.image || ""} />
                              <AvatarFallback>{member.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                           </Avatar>
                           <span className="truncate text-sm font-medium">{member.name}</span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                           <FormField
                              control={form.control}
                              name={`splits.${index}.isSelected`}
                              render={({ field: checkboxField }) => (
                                 <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl>
                                       <Checkbox
                                          checked={checkboxField.value}
                                          onCheckedChange={checkboxField.onChange}
                                          aria-label={`Include ${member.name} in the split`}
                                       />
                                    </FormControl>
                                 </FormItem>
                              )}
                           />

                           {splitType === "EXACT" && (
                              <FormField
                                 control={form.control}
                                 name={`splits.${index}.value`}
                                 render={({ field: inputField }) => (
                                    <FormItem>
                                       <FormControl>
                                          <div className="flex items-center">
                                             <span className="mr-2 text-sm text-muted-foreground">{currency}</span>
                                             <Input
                                                type="text"
                                                inputMode="decimal"
                                                className="h-10 w-24 text-right"
                                                disabled={!splits[index]?.isSelected}
                                                aria-label={`${member.name} exact amount`}
                                                {...inputField}
                                             />
                                          </div>
                                       </FormControl>
                                    </FormItem>
                                 )}
                              />
                           )}

                           {splitType === "PERCENTAGE" && (
                              <FormField
                                 control={form.control}
                                 name={`splits.${index}.value`}
                                 render={({ field: inputField }) => (
                                    <FormItem>
                                       <FormControl>
                                          <div className="flex items-center">
                                             <Input
                                                type="text"
                                                inputMode="decimal"
                                                className="h-10 w-20 text-right"
                                                disabled={!splits[index]?.isSelected}
                                                aria-label={`${member.name} percentage`}
                                                {...inputField}
                                             />
                                             <span className="ml-2 text-sm text-muted-foreground">%</span>
                                          </div>
                                       </FormControl>
                                    </FormItem>
                                 )}
                              />
                           )}

                           {splitType === "SHARES" && (
                              <FormField
                                 control={form.control}
                                 name={`splits.${index}.value`}
                                 render={({ field: inputField }) => (
                                    <FormItem>
                                       <FormControl>
                                          <div className="flex items-center">
                                             <Input
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[1-9][0-9]*"
                                                className="h-10 w-20 text-right"
                                                disabled={!splits[index]?.isSelected}
                                                aria-label={`${member.name} shares`}
                                                {...inputField}
                                             />
                                             <span className="ml-2 text-xs text-muted-foreground">share(s)</span>
                                          </div>
                                       </FormControl>
                                    </FormItem>
                                 )}
                              />
                           )}
                        </div>
                     </div>
                  );
               })}

               {/* Helpers to show totals for Exact and Percentage */}
               {splitType === "EXACT" && (
                  <div className="flex flex-wrap justify-between gap-2 border-t pt-3 text-sm font-medium">
                     <span>Total Selected:</span>
                     <span className={exactTotalMinor !== null && exactTotalMinor === expenseTotalMinor ? "text-emerald-500" : "text-destructive"}>
                        {currency} {exactTotalMinor === null ? "Invalid" : formatMinorUnitToAmount(exactTotalMinor)} / {currency} {expenseTotalMinor === null ? "Invalid" : formatMinorUnitToAmount(expenseTotalMinor)}
                     </span>
                  </div>
               )}
               {splitType === "PERCENTAGE" && (
                  <div className="flex flex-wrap justify-between gap-2 border-t pt-3 text-sm font-medium">
                     <span>Total Selected:</span>
                     <span className={percentageTotalBps === 10_000 ? "text-emerald-500" : "text-destructive"}>
                        {percentageTotalBps === null ? "Invalid" : formatBasisPoints(percentageTotalBps)}% / 100.00%
                     </span>
                  </div>
               )}
            </div>

            <DialogFooter>
              <Button type="submit" className="w-full sm:w-auto" disabled={mutation.isPending}>
                {mutation.isPending ? "Adding..." : "Add Expense"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
