import { z } from "zod";

export const ReceiptStatusSchema = z.enum(["PENDING", "READY", "DELETED"]);

export const ReceiptResponseSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  expenseId: z.string().nullable(),
  uploaderId: z.string(),
  objectKey: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int(),
  status: ReceiptStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}).strict();

export const CreateUploadRequestSchema = z.object({
  expenseId: z.string().trim().min(1).max(200),
  contentType: z.string().regex(/^image\/(jpeg|png|webp)$/),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024), // 10MB
}).strict();

export const UploadRequestResponseSchema = z.object({
  id: z.string(),
  uploadUrl: z.string(),
  objectKey: z.string(),
  method: z.string(),
}).strict();

export const FinalizeUploadSchema = z.object({}).strict();

export type ReceiptResponse = z.infer<typeof ReceiptResponseSchema>;
export type CreateUploadRequestInput = z.infer<typeof CreateUploadRequestSchema>;
export type UploadRequestResponse = z.infer<typeof UploadRequestResponseSchema>;
