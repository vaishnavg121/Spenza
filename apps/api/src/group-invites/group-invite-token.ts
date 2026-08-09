import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const InvitePayloadSchema = z.object({
  version: z.literal(1),
  groupId: z.string().min(1),
  inviterId: z.string().min(1),
  expiresAt: z.number().int().positive(),
  nonce: z.string().min(32),
}).strict();

export type VerifiedGroupInviteToken = z.infer<typeof InvitePayloadSchema>;

export class InvalidGroupInviteTokenError extends Error {}

export class GroupInviteTokenCodec {
  private readonly signingKey: Buffer;

  constructor(secret: string) {
    if (Buffer.byteLength(secret, "utf8") < 32) {
      throw new Error("GROUP_INVITE_SECRET must contain at least 32 bytes");
    }
    this.signingKey = createHmac("sha256", secret).update("spenza-group-invites-v1").digest();
  }

  issue(groupId: string, inviterId: string, now = Date.now(), lifetimeMs = 7 * 24 * 60 * 60 * 1000) {
    const payload: VerifiedGroupInviteToken = {
      version: 1,
      groupId,
      inviterId,
      expiresAt: now + lifetimeMs,
      nonce: randomBytes(32).toString("base64url"),
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const signature = this.sign(encodedPayload).toString("base64url");
    return { token: `${encodedPayload}.${signature}`, expiresAt: new Date(payload.expiresAt) };
  }

  verify(token: string): VerifiedGroupInviteToken {
    const parts = token.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) throw new InvalidGroupInviteTokenError();
    const expected = this.sign(parts[0]);
    if (parts[1] !== expected.toString("base64url")) throw new InvalidGroupInviteTokenError();
    let supplied: Buffer;
    try {
      supplied = Buffer.from(parts[1], "base64url");
    } catch {
      throw new InvalidGroupInviteTokenError();
    }
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new InvalidGroupInviteTokenError();
    }

    try {
      const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
      return InvitePayloadSchema.parse(payload);
    } catch {
      throw new InvalidGroupInviteTokenError();
    }
  }

  hash(token: string): string {
    return createHash("sha256").update(token, "utf8").digest("hex");
  }

  private sign(payload: string): Buffer {
    return createHmac("sha256", this.signingKey).update(payload, "utf8").digest();
  }
}
