"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createExpenseSchema } from "@/lib/expense-schema";
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
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Receipt } from "lucide-react";
import { createExpenseApi } from "@/lib/api-expenses";
import { parseAmountToMinorUnit } from "@/lib/money";
import type { CreateExpenseInput, ExpenseSplitInput } from "@spenza/contracts";

type Member = {
  id: string;
  name: string;
  image: string | null;
};

interface AddExpenseDialogProps {
  groupId: string;
  members: Member[];
  currentUserId: string;
}

export function AddExpenseDialog({ groupId, members, currentUserId }: AddExpenseDialogProps) {
  const [open, setOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const queryClient = useQueryClient();

  const form = useForm<
    z.input<typeof createExpenseSchema>,
    undefined,
    z.output<typeof createExpenseSchema>
  >({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: {
      groupId,
      title: "",
      amount: 0,
      payerId: currentUserId,
      splitType: "EQUAL",
      splits: members.map((m) => ({
        userId: m.id,
        value: 0,
        isSelected: true,
      })),
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "splits",
  });

  const { setValue } = form;
  const splitType = useWatch({ control: form.control, name: "splitType" });
  const amount = useWatch({ control: form.control, name: "amount" }) ?? 0;
  const splits = useWatch({ control: form.control, name: "splits" }) ?? [];

  // Reset split values when changing split type
  useEffect(() => {
    if (splitType === "EQUAL") {
      // Logic is handled in backend, just keep selections
    } else if (splitType === "EXACT") {
       // Reset values to 0
       const newSplits = members.map(m => ({ userId: m.id, value: 0, isSelected: true }));
       setValue("splits", newSplits);
    } else if (splitType === "PERCENTAGE") {
        const equalPerc = Math.floor(100 / members.length);
        const newSplits = members.map((m, i) => ({ 
            userId: m.id, 
            value: i === 0 ? 100 - (equalPerc * (members.length - 1)) : equalPerc, 
            isSelected: true 
        }));
        setValue("splits", newSplits);
    } else if (splitType === "SHARES") {
        const newSplits = members.map(m => ({ userId: m.id, value: 1, isSelected: true }));
        setValue("splits", newSplits);
    }
  }, [members, setValue, splitType]);

  const mutation = useMutation({
    mutationFn: async (values: z.output<typeof createExpenseSchema>) => {
      const totalMinor = parseAmountToMinorUnit(values.amount.toString(), 2);
      if (!totalMinor || totalMinor === "0") {
        throw new Error("Invalid expense amount.");
      }

      let split: ExpenseSplitInput;
      if (values.splitType === "EQUAL") {
        const participants = values.splits.filter(s => s.isSelected).map(s => ({ userId: s.userId }));
        if (participants.length === 0) throw new Error("Select at least one participant.");
        split = { type: "EQUAL", participants };
      } else if (values.splitType === "EXACT") {
        const participants = values.splits
          .filter(s => s.value > 0)
          .map(s => {
            const amountMinor = parseAmountToMinorUnit(s.value.toString(), 2);
            if (!amountMinor) throw new Error(`Invalid exact amount for user.`);
            return { userId: s.userId, amountMinor };
          });
        if (participants.length === 0) throw new Error("Assign at least one exact amount.");
        split = { type: "EXACT", participants };
      } else if (values.splitType === "PERCENTAGE") {
        const participants = values.splits
          .filter(s => s.value > 0)
          .map(s => ({ userId: s.userId, percentageBps: Math.round(s.value * 100) }));
        if (participants.length === 0) throw new Error("Assign at least one percentage.");
        split = { type: "PERCENTAGE", participants };
      } else if (values.splitType === "SHARES") {
        const participants = values.splits
          .filter(s => s.value > 0)
          .map(s => ({ userId: s.userId, shares: Math.round(s.value) }));
        if (participants.length === 0) throw new Error("Assign at least one share.");
        split = { type: "SHARES", participants };
      } else {
        throw new Error("Unsupported split type.");
      }

      const payload: CreateExpenseInput = {
        title: values.title,
        totalMinor,
        currency: "USD",
        payers: [{ userId: values.payerId, amountMinor: totalMinor }],
        split,
      };

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
          amount: 0,
          payerId: currentUserId,
          splitType: "EQUAL",
          splits: members.map((m) => ({ userId: m.id, value: 0, isSelected: true }))
      });
      setIdempotencyKey(crypto.randomUUID());
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add expense");
    },
  });

  function onSubmit(values: z.output<typeof createExpenseSchema>) {
    if (values.splitType === "EXACT") {
       const total = values.splits.reduce((sum, s) => sum + s.value, 0);
       if (Math.abs(total - values.amount) > 0.01) {
           toast.error(`Amounts must add up to ${values.amount}. Currently: ${total}`);
           return;
       }
    }
    if (values.splitType === "PERCENTAGE") {
        const total = values.splits.reduce((sum, s) => sum + s.value, 0);
        if (Math.abs(total - 100) > 0.01) {
            toast.error(`Percentages must add up to exactly 100%. Currently: ${total}%`);
            return;
        }
    }
    mutation.mutate(values);
  }

  const getMemberDetails = (userId: string) => members.find((m) => m.id === userId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
                            type="number" 
                            step="0.01" 
                            min="0"
                            placeholder="0.00" 
                            {...field} 
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} 
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select who paid" />
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
                        
                        {splitType === "EQUAL" && (
                           <FormField
                              control={form.control}
                              name={`splits.${index}.isSelected`}
                              render={({ field: checkboxField }) => (
                                 <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl>
                                       <Checkbox 
                                          checked={checkboxField.value} 
                                          onCheckedChange={checkboxField.onChange} 
                                       />
                                    </FormControl>
                                 </FormItem>
                              )}
                           />
                        )}

                        {splitType === "EXACT" && (
                           <FormField
                              control={form.control}
                              name={`splits.${index}.value`}
                              render={({ field: inputField }) => (
                                 <FormItem>
                                    <FormControl>
                                       <div className="flex items-center">
                                          <span className="text-sm text-muted-foreground mr-2">$</span>
                                          <Input 
                                             type="number" 
                                             step="0.01" 
                                             className="h-10 w-24 text-right"
                                             {...inputField}
                                             onChange={(e) => inputField.onChange(parseFloat(e.target.value) || 0)} 
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
                                             type="number" 
                                             step="1" 
                                             className="h-10 w-20 text-right"
                                             {...inputField}
                                             onChange={(e) => inputField.onChange(parseFloat(e.target.value) || 0)} 
                                          />
                                          <span className="text-sm text-muted-foreground ml-2">%</span>
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
                                             type="number" 
                                             step="1" 
                                             className="h-10 w-20 text-right"
                                             {...inputField}
                                             onChange={(e) => inputField.onChange(parseFloat(e.target.value) || 0)} 
                                          />
                                          <span className="text-sm text-muted-foreground ml-2 text-xs">share(s)</span>
                                       </div>
                                    </FormControl>
                                 </FormItem>
                              )}
                           />
                        )}
                     </div>
                  );
               })}

               {/* Helpers to show totals for Exact and Percentage */}
               {splitType === "EXACT" && (
                  <div className="flex flex-wrap justify-between gap-2 border-t pt-3 text-sm font-medium">
                     <span>Total Selected:</span>
                     <span className={Math.abs(splits.reduce((a,b) => a + b.value, 0) - amount) > 0.01 ? "text-destructive" : "text-emerald-500"}>
                        ${splits.reduce((a,b) => a + b.value, 0).toFixed(2)} / ${amount.toFixed(2)}
                     </span>
                  </div>
               )}
               {splitType === "PERCENTAGE" && (
                  <div className="flex flex-wrap justify-between gap-2 border-t pt-3 text-sm font-medium">
                     <span>Total Selected:</span>
                     <span className={Math.abs(splits.reduce((a,b) => a + b.value, 0) - 100) > 0.01 ? "text-destructive" : "text-emerald-500"}>
                        {splits.reduce((a,b) => a + b.value, 0).toFixed(0)}% / 100%
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
