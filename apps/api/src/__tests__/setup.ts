import { vi } from "vitest";

export const mockClerkClient = {
  users: {
    getUser: vi.fn().mockImplementation(async (userId: string) => ({
      id: userId,
      firstName: "Ada",
      lastName: "Lovelace",
      primaryEmailAddressId: "email_1",
      emailAddresses: [
        {
          id: "email_1",
          emailAddress: "ada@example.com",
          verification: { status: "verified" },
        },
      ],
    })),
  },
};

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ isAuthenticated: false, userId: null }),
  clerkClient: mockClerkClient,
}));
