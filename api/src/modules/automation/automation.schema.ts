import { z } from "zod";

export const emergencyStopBodySchema = z
  .object({
    /** When true (default), activate stop + drain. When false, clear stop. */
    active: z.boolean().default(true),
  })
  .strict();

export type EmergencyStopBody = z.infer<typeof emergencyStopBodySchema>;
