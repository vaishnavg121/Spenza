import { PrismaClient, ReceiptStatus } from "@prisma/client";

export type ReceiptRecord = {
  id: string;
  groupId: string;
  expenseId: string | null;
  uploaderId: string;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  status: "PENDING" | "READY" | "DELETED";
  createdAt: Date;
  updatedAt: Date;
};

export interface ReceiptRepository {
  expenseExistsInGroup(expenseId: string, groupId: string): Promise<boolean>;
  createPendingReceipt(data: Omit<ReceiptRecord, "id" | "createdAt" | "updatedAt" | "status">): Promise<ReceiptRecord>;
  getReceiptById(receiptId: string): Promise<ReceiptRecord | null>;
  markReceiptReady(receiptId: string): Promise<ReceiptRecord>;
  markReceiptDeleted(receiptId: string): Promise<void>;
  findReceiptsByExpenseId(expenseId: string): Promise<ReceiptRecord[]>;
}

export class PrismaReceiptRepository implements ReceiptRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async expenseExistsInGroup(expenseId: string, groupId: string): Promise<boolean> {
    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, groupId, voidedAt: null },
      select: { id: true },
    });
    return expense !== null;
  }

  async createPendingReceipt(data: Omit<ReceiptRecord, "id" | "createdAt" | "updatedAt" | "status">): Promise<ReceiptRecord> {
    return this.prisma.receipt.create({
      data: {
        ...data,
        status: ReceiptStatus.PENDING,
      },
    }) as Promise<ReceiptRecord>;
  }

  async getReceiptById(receiptId: string): Promise<ReceiptRecord | null> {
    return this.prisma.receipt.findUnique({
      where: { id: receiptId },
    }) as Promise<ReceiptRecord | null>;
  }

  async markReceiptReady(receiptId: string): Promise<ReceiptRecord> {
    return this.prisma.receipt.update({
      where: { id: receiptId },
      data: { status: ReceiptStatus.READY },
    }) as Promise<ReceiptRecord>;
  }

  async markReceiptDeleted(receiptId: string): Promise<void> {
    await this.prisma.receipt.update({
      where: { id: receiptId },
      data: { status: ReceiptStatus.DELETED },
    });
  }

  async findReceiptsByExpenseId(expenseId: string): Promise<ReceiptRecord[]> {
    return this.prisma.receipt.findMany({
      where: { expenseId, status: ReceiptStatus.READY },
    }) as Promise<ReceiptRecord[]>;
  }
}
