"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import * as z from "zod";

const createGroupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  currency: z.string().default("USD"),
});

export async function createGroup(data: z.infer<typeof createGroupSchema>) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const parsed = createGroupSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid input");
  }

  const group = await prisma.group.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      currency: parsed.data.currency,
      members: {
        create: {
          userId: session.user.id,
          role: "ADMIN",
        },
      },
      activities: {
        create: {
          userId: session.user.id,
          action: "GROUP_CREATED",
          details: { name: parsed.data.name },
        },
      },
    },
  });

  revalidatePath("/dashboard/groups");
  return group;
}

export async function getGroups() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const groups = await prisma.group.findMany({
    where: {
      members: {
        some: {
          userId: session.user.id,
        },
      },
      isArchived: false,
    },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, image: true, email: true }
          }
        }
      },
      _count: {
        select: { expenses: true }
      }
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return groups;
}