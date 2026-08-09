"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sendFriendRequest } from "@/actions/friends";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserPlus } from "lucide-react";

export function AddFriendDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Friend request sent!");
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
      setOpen(false);
      setEmail("");
    },
    onError: () => {
      toast.error("Failed to send request. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    mutation.mutate(email);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <UserPlus className="mr-2 h-4 w-4" />
        Add Friend
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Add a Friend</DialogTitle>
          <DialogDescription>
          Enter your friend&apos;s email address to send them a request.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <label htmlFor="friend-email" className="sr-only">Friend&apos;s email address</label>
          <Input 
            id="friend-email"
            placeholder="friend@example.com" 
            type="email" 
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required 
          />
          <DialogFooter>
            <Button type="submit" className="w-full sm:w-auto" disabled={mutation.isPending || !email}>
              {mutation.isPending ? "Sending..." : "Send Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
