import { z } from "zod";
export const emergencyStopBodySchema = z
    .object({
    active: z.boolean().default(true),
})
    .strict();
export type EmergencyStopBody = z.infer<typeof emergencyStopBodySchema>;
