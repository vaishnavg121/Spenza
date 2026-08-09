"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Copy, Link2, Loader2, RotateCcw, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { createGroupInviteApi, revokeGroupInviteApi } from "@/lib/api-group-invites";

interface ShareGroupDialogProps {
  groupId: string;
  groupName: string;
}

export function ShareGroupDialog({ groupId, groupName }: ShareGroupDialogProps) {
  const [open, setOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createGroupInviteApi(groupId),
    onSuccess: (invite) => {
      setInviteUrl(`${window.location.origin}/join/${invite.token}`);
      setExpiresAt(invite.expiresAt);
      toast.success("Invite link ready");
    },
    onError: (error) => toast.error(error.message || "Failed to create invite link"),
  });

  const revokeMutation = useMutation({
    mutationFn: () => revokeGroupInviteApi(groupId),
    onSuccess: () => {
      setInviteUrl(null);
      setExpiresAt(null);
      toast.success("Invite link revoked");
    },
    onError: (error) => toast.error(error.message || "Failed to revoke invite link"),
  });

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Invite link copied");
    } catch {
      toast.error("Copy failed. Select and copy the link manually.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full sm:w-auto">
          <Link2 className="mr-2 h-4 w-4" />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share {groupName}</DialogTitle>
          <DialogDescription>
            Anyone with the active link can sign in and explicitly join as a member. Creating another link revokes the previous one.
          </DialogDescription>
        </DialogHeader>

        {inviteUrl ? (
          <div className="space-y-3 py-2">
            <Input value={inviteUrl} readOnly aria-label="Group invite link" onFocus={(event) => event.currentTarget.select()} />
            <p className="text-xs text-muted-foreground">
              Expires {expiresAt ? new Date(expiresAt).toLocaleString() : "soon"}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            Generate a seven-day link for this group. The recipient will see the group and inviter before joining.
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {inviteUrl ? (
            <Button
              variant="ghost"
              onClick={() => revokeMutation.mutate()}
              disabled={revokeMutation.isPending}
              className="text-destructive"
            >
              {revokeMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
              Revoke
            </Button>
          ) : <span />}
          <div className="flex flex-col gap-2 sm:flex-row">
            {inviteUrl ? (
              <Button variant="outline" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Replace link
              </Button>
            ) : null}
            <Button
              onClick={inviteUrl ? () => void copyInvite() : () => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : inviteUrl ? <Copy className="mr-2 h-4 w-4" /> : <Link2 className="mr-2 h-4 w-4" />}
              {inviteUrl ? "Copy link" : "Create invite link"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
