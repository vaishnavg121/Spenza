"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createExpense, createExpenseSchema } from "@/actions/expenses";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Receipt } from "lucide-react";

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
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof createExpenseSchema>>({
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

  const splitType = form.watch("splitType");
  const amount = form.watch("amount") || 0;
  const splits = form.watch("splits");

  // Reset split values when changing split type
  useEffect(() => {
    if (splitType === "EQUAL") {
      // Logic is handled in backend, just keep selections
    } else if (splitType === "EXACT") {
       // Reset values to 0
       const newSplits = members.map(m => ({ userId: m.id, value: 0, isSelected: true }));
       form.setValue("splits", newSplits);
    } else if (splitType === "PERCENTAGE") {
        const equalPerc = Math.floor(100 / members.length);
        const newSplits = members.map((m, i) => ({ 
            userId: m.id, 
            value: i === 0 ? 100 - (equalPerc * (members.length - 1)) : equalPerc, 
            isSelected: true 
        }));
        form.setValue("splits", newSplits);
    } else if (splitType === "SHARES") {
        const newSplits = members.map(m => ({ userId: m.id, value: 1, isSelected: true }));
        form.setValue("splits", newSplits);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitType]);

  const mutation = useMutation({
    mutationFn: createExpense,
    onSuccess: () => {
      toast.success("Expense added successfully");
      queryClient.invalidateQueries({ queryKey: ["group-details", groupId] });
      setOpen(false);
      form.reset({
          groupId,
          title: "",
          amount: 0,
          payerId: currentUserId,
          splitType: "EQUAL",
          splits: members.map((m) => ({ userId: m.id, value: 0, isSelected: true }))
      });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add expense");
    },
  });

  function onSubmit(values: z.infer<typeof createExpenseSchema>) {
    // Client-side quick validation before submission
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
        <Button>
          <Receipt className="mr-2 h-4 w-4" />
          Add Expense
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add an Expense</DialogTitle>
          <DialogDescription>
            Enter expense details and choose how to split it.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            <div className="flex gap-4">
               <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                     <FormItem className="flex-1">
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
                     <FormItem className="w-[120px]">
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
                        <TabsList className="w-full grid grid-cols-4">
                           <TabsTrigger value="EQUAL">Equal</TabsTrigger>
                           <TabsTrigger value="EXACT">Exact</TabsTrigger>
                           <TabsTrigger value="PERCENTAGE">%</TabsTrigger>
                           <TabsTrigger value="SHARES">Shares</TabsTrigger>
                        </TabsList>
                     </Tabs>
                  </FormItem>
               )}
            />

            <div className="space-y-4 rounded-lg border p-4 bg-muted/20">
               <h4 className="text-sm font-medium">Split Details</h4>
               {fields.map((field, index) => {
                  const member = getMemberDetails(field.userId);
                  if (!member) return null;
                  
                  return (
                     <div key={field.id} className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                           <Avatar className="h-8 w-8">
                              <AvatarImage src={member.image || ""} />
                              <AvatarFallback>{member.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                           </Avatar>
                           <span className="text-sm font-medium truncate w-[100px]">{member.name}</span>
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
                                             className="w-[100px] h-8 text-right" 
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
                                             className="w-[80px] h-8 text-right" 
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
                                             className="w-[80px] h-8 text-right" 
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
                  <div className="pt-2 flex justify-between text-sm font-medium border-t">
                     <span>Total Selected:</span>
                     <span className={Math.abs(splits.reduce((a,b) => a + b.value, 0) - amount) > 0.01 ? "text-destructive" : "text-emerald-500"}>
                        ${splits.reduce((a,b) => a + b.value, 0).toFixed(2)} / ${amount.toFixed(2)}
                     </span>
                  </div>
               )}
               {splitType === "PERCENTAGE" && (
                  <div className="pt-2 flex justify-between text-sm font-medium border-t">
                     <span>Total Selected:</span>
                     <span className={Math.abs(splits.reduce((a,b) => a + b.value, 0) - 100) > 0.01 ? "text-destructive" : "text-emerald-500"}>
                        {splits.reduce((a,b) => a + b.value, 0).toFixed(0)}% / 100%
                     </span>
                  </div>
               )}
            </div>

            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Adding..." : "Add Expense"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}