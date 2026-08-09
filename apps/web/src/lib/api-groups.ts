import { apiFetch } from "./api-client";
import type { CreateGroupInput, UpdateGroupInput, GroupResponse } from "@spenza/contracts";

export async function fetchGroups(): Promise<GroupResponse[]> {
  return apiFetch<GroupResponse[]>("/v1/groups");
}

export async function fetchGroupById(groupId: string): Promise<GroupResponse> {
  return apiFetch<GroupResponse>(`/v1/groups/${groupId}`);
}

export async function createGroupApi(data: CreateGroupInput): Promise<GroupResponse> {
  return apiFetch<GroupResponse>("/v1/groups", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateGroupApi(groupId: string, data: UpdateGroupInput): Promise<GroupResponse> {
  return apiFetch<GroupResponse>(`/v1/groups/${groupId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function addGroupMemberApi(groupId: string, userId: string): Promise<GroupResponse> {
  return apiFetch<GroupResponse>(`/v1/groups/${groupId}/members`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export async function leaveGroupApi(groupId: string): Promise<void> {
  return apiFetch<void>(`/v1/groups/${groupId}/leave`, {
    method: "POST",
  });
}
