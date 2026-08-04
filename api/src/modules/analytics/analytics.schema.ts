import { z } from "zod";

export const analyticsRangeQuerySchema = z
  .object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  })
  .strict();

export type AnalyticsRangeQuery = z.infer<typeof analyticsRangeQuerySchema>;
