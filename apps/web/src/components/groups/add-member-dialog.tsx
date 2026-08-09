"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GroupResponse } from "@spenza/contracts";
import { getFriends } from "@/actions/friends";
import { addGroupMemberApi } from "@/lib/api-groups";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

type AddMemberDialogProps = {
  groupId: string;
  existingMemberIds: string[];
};

export function AddMemberDialog({ groupId, existingMemberIds }: AddMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const existingMemberIdSet = useMemo(() => new Set(existingMemberIds), [existingMemberIds]);

  const friendsQuery = useQuery({
    queryKey: ["friends"],
    queryFn: () => getFriends(),
    enabled: open,
  });

  const candidates = useMemo(
    () => (friendsQuery.data ?? []).filter((friend) => !existingMemberIdSet.has(friend.id)),
    [existingMemberIdSet, friendsQuery.data],
  );

  const addMutation = useMutation({
    mutationFn: (userId: string) => addGroupMemberApi(groupId, userId),
    onSuccess: (group: GroupResponse) => {
      queryClient.setQueryData(["group-details", groupId], group);
      void queryClient.invalidateQueries({ queryKey: ["group-details", groupId] });
      void queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Member added to the group");
      setOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add member");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" />}>
        <UserPlus className="mr-2 size-4" aria-hidden="true" />
        Add Member
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a group member</DialogTitle>
          <DialogDescription>
            Choose an accepted friend who is not already in this group.
          </DialogDescription>
        </DialogHeader>

        {friendsQuery.isLoading ? (
          <div className="space-y-3 py-2" aria-label="Loading friends" aria-busy="true">
            {[1, 2, 3].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-xl border p-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : friendsQuery.isError ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-5 py-8 text-center">
            <Users className="size-8 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="font-medium">Friends unavailable</p>
              <p className="mt-1 text-sm text-muted-foreground">We couldn&apos;t load your accepted friends.</p>
            </div>
            <Button type="button" variant="outline" onClick={() => void friendsQuery.refetch()}>
              Try again
            </Button>
          </div>
        ) : candidates.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-5 py-8 text-center">
            <Users className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">No friends available to add</p>
            <p className="text-sm text-muted-foreground">
              Accepted friends who are not group members will appear here.
            </p>
          </div>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {candidates.map((friend) => (
              <div key={friend.id} className="flex min-h-16 items-center gap-3 rounded-xl border p-3">
                <Avatar className="size-10">
                  <AvatarImage src={friend.image || ""} alt="" />
                  <AvatarFallback>{friend.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{friend.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{friend.email}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={addMutation.isPending}
                  onClick={() => addMutation.mutate(friend.id)}
                >
                  {addMutation.isPending && addMutation.variables === friend.id ? "Adding..." : "Add"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
