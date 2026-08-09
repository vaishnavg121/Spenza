import {
  GroupInviteAcceptanceSchema,
  GroupInviteCreatedSchema,
  GroupInvitePreviewSchema,
  type GroupInviteAcceptance,
  type GroupInviteCreated,
  type GroupInvitePreview,
} from "@spenza/contracts";
import { AppError, ForbiddenError, NotFoundError } from "../errors/app-error.js";
import type { GroupInviteRepository } from "./group-invite-repository.js";
import { GroupInviteTokenCodec, InvalidGroupInviteTokenError } from "./group-invite-token.js";

export class GroupInviteService {
  constructor(
    private readonly repository: GroupInviteRepository,
    private readonly tokenCodec: GroupInviteTokenCodec,
    private readonly now: () => number = Date.now,
  ) {}

  async createInvite(actorUserId: string, groupId: string): Promise<GroupInviteCreated> {
    const group = await this.repository.findForCreation(groupId, actorUserId);
    if (!group || group.actorRole === null) throw new NotFoundError("Group not found");
    if (group.actorRole !== "ADMIN") throw new ForbiddenError("Only group administrators can create invite links");

    const issued = this.tokenCodec.issue(groupId, actorUserId, this.now());
    await this.repository.storeInviteHash(groupId, this.tokenCodec.hash(issued.token));
    return GroupInviteCreatedSchema.parse({ token: issued.token, expiresAt: issued.expiresAt.toISOString() });
  }

  async revokeInvite(actorUserId: string, groupId: string): Promise<void> {
    const result = await this.repository.revokeInviteHash(groupId, actorUserId);
    if (result === "NOT_FOUND") throw new NotFoundError("Group not found");
    if (result === "FORBIDDEN") throw new ForbiddenError("Only group administrators can revoke invite links");
  }

  async previewInvite(token: string): Promise<GroupInvitePreview> {
    const verified = this.verify(token);
    const context = await this.repository.findInviteContext(
      verified.groupId,
      verified.inviterId,
      this.tokenCodec.hash(token),
    );
    if (!context) throw new AppError(410, "GROUP_INVITE_REVOKED", "This invite link is no longer active");
    return GroupInvitePreviewSchema.parse({ ...context, expiresAt: new Date(verified.expiresAt).toISOString() });
  }

  async acceptInvite(actorUserId: string, token: string): Promise<GroupInviteAcceptance> {
    const verified = this.verify(token);
    const result = await this.repository.acceptInvite(
      verified.groupId,
      verified.inviterId,
      actorUserId,
      this.tokenCodec.hash(token),
    );
    if (!result) throw new AppError(410, "GROUP_INVITE_REVOKED", "This invite link is no longer active");
    return GroupInviteAcceptanceSchema.parse({ groupId: verified.groupId, ...result });
  }

  private verify(token: string) {
    try {
      const verified = this.tokenCodec.verify(token);
      if (verified.expiresAt <= this.now()) {
        throw new AppError(410, "GROUP_INVITE_EXPIRED", "This invite link has expired");
      }
      return verified;
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof InvalidGroupInviteTokenError) {
        throw new NotFoundError("Invite link not found", "GROUP_INVITE_INVALID");
      }
      throw error;
    }
  }
}
