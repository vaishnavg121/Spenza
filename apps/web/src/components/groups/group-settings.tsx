"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { GroupResponse } from "@spenza/contracts";
import { useRouter } from "next/navigation";
import { Archive, LogOut, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { leaveGroupApi, removeGroupMemberApi, updateGroupApi } from "@/lib/api-groups";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function GroupSettings({ group, currentUserId, isAdmin }: { group: GroupResponse; currentUserId: string; isAdmin: boolean }) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [imageUrl, setImageUrl] = useState(group.imageUrl ?? "");
  const [pendingAction, setPendingAction] = useState<{ kind: "remove" | "leave" | "archive"; userId?: string } | null>(null);
  const queryClient = useQueryClient();
  const router = useRouter();

  const updateMutation = useMutation({
    mutationFn: () => updateGroupApi(group.id, { name, description: description.trim() || null, imageUrl: imageUrl.trim() || null }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["group-details", group.id] });
      toast.success("Group settings updated");
    },
    onError: showMutationError,
  });
  const membershipMutation = useMutation({
    mutationFn: async (action: NonNullable<typeof pendingAction>) => {
      if (action.kind === "leave") return leaveGroupApi(group.id);
      if (action.kind === "remove" && action.userId) return removeGroupMemberApi(group.id, action.userId);
      if (action.kind === "archive") return updateGroupApi(group.id, { isArchived: true });
      throw new Error("Invalid group action");
    },
    onSuccess: async (_, action) => {
      setPendingAction(null);
      if (action.kind === "remove") {
        await queryClient.invalidateQueries({ queryKey: ["group-details", group.id] });
        toast.success("Member removed");
      } else {
        await queryClient.invalidateQueries({ queryKey: ["groups"] });
        toast.success(action.kind === "leave" ? "You left the group" : "Group archived");
        router.push("/dashboard/groups");
      }
    },
    onError: showMutationError,
  });

  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
    <Card>
      <CardHeader><CardTitle>Group details</CardTitle><CardDescription>{isAdmin ? "Update the shared group profile. Currency remains fixed for financial consistency." : "Only group administrators can edit these details."}</CardDescription></CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); updateMutation.mutate(); }}>
          <SettingField label="Name"><Input value={name} onChange={(event) => setName(event.target.value)} disabled={!isAdmin} minLength={2} maxLength={100} /></SettingField>
          <SettingField label="Description"><Input value={description} onChange={(event) => setDescription(event.target.value)} disabled={!isAdmin} maxLength={500} /></SettingField>
          <SettingField label="Image URL"><Input type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} disabled={!isAdmin} placeholder="https://…" /></SettingField>
          <SettingField label="Currency"><Input value={group.currency} disabled /><p className="text-xs text-muted-foreground">Group currency cannot be changed from this settings screen.</p></SettingField>
          {isAdmin ? <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? "Saving…" : "Save settings"}</Button> : null}
        </form>
      </CardContent>
    </Card>
    <div className="space-y-5">
      <Card>
        <CardHeader><CardTitle>Members</CardTitle><CardDescription>Roles are server-controlled. Removal is blocked when financial history makes it unsafe.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {group.members.map((member) => <div key={member.id} className="flex min-h-14 items-center gap-3 rounded-xl border p-3">
            <Avatar className="size-9"><AvatarImage src={member.user.image || ""} /><AvatarFallback>{member.user.name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{member.user.name}{member.userId === currentUserId ? " (You)" : ""}</p><p className="truncate text-xs text-muted-foreground">{member.user.email}</p></div>
            <Badge variant={member.role === "ADMIN" ? "default" : "outline"}>{member.role}</Badge>
            {isAdmin && member.userId !== currentUserId ? <Button variant="ghost" size="icon" aria-label={`Remove ${member.user.name}`} onClick={() => setPendingAction({ kind: "remove", userId: member.userId })}><UserMinus className="size-4" /></Button> : null}
          </div>)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Group access</CardTitle><CardDescription>Financial records are never deleted by these actions.</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button variant="outline" onClick={() => setPendingAction({ kind: "leave" })}><LogOut className="mr-2 size-4" />Leave group</Button>
          {isAdmin ? <Button variant="destructive" onClick={() => setPendingAction({ kind: "archive" })}><Archive className="mr-2 size-4" />Archive group</Button> : null}
        </CardContent>
      </Card>
    </div>
    {pendingAction ? <div role="alertdialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"><Card className="w-full max-w-md"><CardHeader><CardTitle>Confirm group action</CardTitle><CardDescription>{confirmationText(pendingAction.kind)}</CardDescription></CardHeader><CardContent className="flex justify-end gap-2"><Button variant="outline" onClick={() => setPendingAction(null)}>Cancel</Button><Button variant="destructive" disabled={membershipMutation.isPending} onClick={() => membershipMutation.mutate(pendingAction)}>{membershipMutation.isPending ? "Working…" : "Confirm"}</Button></CardContent></Card></div> : null}
  </div>;
}

function SettingField({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function confirmationText(kind: "remove" | "leave" | "archive") { if (kind === "remove") return "Remove this member? The API will refuse if they have financial history."; if (kind === "leave") return "Leave this group? The API will refuse if your role or financial history makes this unsafe."; return "Archive this group? It will stop accepting new financial changes."; }
function showMutationError(error: Error) { toast.error(error.message || "The group action could not be completed"); }
