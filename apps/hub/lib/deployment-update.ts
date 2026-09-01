import { z } from "zod";

export const deploymentUpdateSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("activate"),
    projectSlug: z.string().min(1),
    deploymentId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("rename"),
    projectSlug: z.string().min(1),
    deploymentId: z.string().uuid(),
    versionName: z.string().trim().min(1).max(80),
    changeSummary: z.string().trim().max(500).optional(),
  }),
]);
