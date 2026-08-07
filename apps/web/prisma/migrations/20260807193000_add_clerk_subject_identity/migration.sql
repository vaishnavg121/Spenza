-- Additive Clerk identity link. Existing User IDs and all relationships remain unchanged.
ALTER TABLE "user" ADD COLUMN "clerkSubjectId" TEXT;

CREATE UNIQUE INDEX "user_clerkSubjectId_key" ON "user"("clerkSubjectId");
