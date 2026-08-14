import { z } from "zod";

export const analyticsRangeQuerySchema = z
  .object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  })
  .strict();

export const analyticsExportQuerySchema = analyticsRangeQuerySchema.extend({
  format: z.enum(["csv", "pdf"]).default("csv"),
  reportType: z
    .enum(["pipeline", "matches", "sources", "applications", "dashboard"])
    .default("dashboard"),
});

export type AnalyticsRangeQuery = z.infer<typeof analyticsRangeQuerySchema>;
export type AnalyticsExportQuery = z.infer<typeof analyticsExportQuerySchema>;
