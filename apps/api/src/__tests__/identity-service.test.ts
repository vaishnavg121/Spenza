import { describe, expect, it, vi } from "vitest";
import { IdentityConflictError, IdentityRepositoryError, IdentityService } from "../identity/identity-service.js";
import type { IdentityRepository } from "../identity/identity-repository.js";
const user = { id:"u1", name:"Ada", username:null, email:"ada@example.com", clerkSubjectId:"user_1", emailVerified:false, image:null, phone:null, currency:"USD", theme:"system", createdAt:new Date(), updatedAt:new Date() };
const identity = { clerkSubjectId:"user_1", primaryVerifiedEmail:"ada@example.com", displayName:"Ada" };
function repo(): IdentityRepository { return { findByClerkSubjectId:vi.fn().mockResolvedValue(null), findLegacyCandidatesByEmail:vi.fn().mockResolvedValue([]), createUser:vi.fn().mockResolvedValue(user), updateProfile:vi.fn() }; }
describe("IdentityService", () => {
 it("returns an existing mapping", async()=>{const r=repo(); vi.mocked(r.findByClerkSubjectId).mockResolvedValue(user); expect((await new IdentityService(r).resolve(identity)).kind).toBe("resolved");});
 it("creates a user only when no legacy candidate exists", async()=>{const r=repo(); await new IdentityService(r).resolve(identity); expect(r.createUser).toHaveBeenCalledWith(expect.objectContaining({clerkSubjectId:"user_1"}));});
 it("does not link an email candidate", async()=>{const r=repo(); vi.mocked(r.findLegacyCandidatesByEmail).mockResolvedValue([user]); expect((await new IdentityService(r).resolve(identity)).kind).toBe("legacy-reconciliation-required"); expect(r.createUser).not.toHaveBeenCalled();});
 it("re-reads safely after a unique race", async()=>{const r=repo(); vi.mocked(r.createUser).mockRejectedValue({code:"P2002"}); vi.mocked(r.findByClerkSubjectId).mockResolvedValueOnce(null).mockResolvedValueOnce(user); expect((await new IdentityService(r).resolve(identity)).kind).toBe("resolved");});
 it("fails closed when a race cannot be resolved", async()=>{const r=repo(); vi.mocked(r.createUser).mockRejectedValue({code:"P2002"}); await expect(new IdentityService(r).resolve(identity)).rejects.toBeInstanceOf(IdentityConflictError);});
 it("fails closed for repository errors", async()=>{const r=repo(); vi.mocked(r.findByClerkSubjectId).mockRejectedValue(new Error()); await expect(new IdentityService(r).resolve(identity)).rejects.toBeInstanceOf(IdentityRepositoryError);});
});
