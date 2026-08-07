import { z } from "zod";

export const RequestIdSchema = z.string().min(1);
export type RequestId = z.infer<typeof RequestIdSchema>;

export const ApiErrorDetailSchema = z.object({
  path: z.array(z.union([z.string(), z.number()])).optional(),
  code: z.string(),
  message: z.string(),
});
export type ApiErrorDetail = z.infer<typeof ApiErrorDetailSchema>;

export const ApiErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(ApiErrorDetailSchema).optional(),
    requestId: z.string(),
  }),
});
export type ApiErrorEnvelope = z.infer<typeof ApiErrorEnvelopeSchema>;

export const createApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
  });

export const ApiSuccessEnvelopeSchema = z.object({
  data: z.unknown(),
});
export type ApiSuccessEnvelope<T = unknown> = {
  data: T;
};

export const PageMetaSchema = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});
export type PageMeta = z.infer<typeof PageMetaSchema>;

export const createPaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    page: PageMetaSchema,
  });
