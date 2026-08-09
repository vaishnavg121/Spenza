import { apiFetch } from "./api-client";
import type { GroupInviteAcceptance, GroupInviteCreated, GroupInvitePreview } from "@spenza/contracts";

export function createGroupInviteApi(groupId: string): Promise<GroupInviteCreated> {
  return apiFetch<GroupInviteCreated>(`/v1/groups/${groupId}/invites`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function revokeGroupInviteApi(groupId: string): Promise<void> {
  return apiFetch<void>(`/v1/groups/${groupId}/invites/current`, { method: "DELETE" });
}

export function previewGroupInviteApi(token: string): Promise<GroupInvitePreview> {
  return apiFetch<GroupInvitePreview>(`/v1/group-invites/${encodeURIComponent(token)}`);
}

export function acceptGroupInviteApi(token: string): Promise<GroupInviteAcceptance> {
  return apiFetch<GroupInviteAcceptance>(`/v1/group-invites/${encodeURIComponent(token)}/accept`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
