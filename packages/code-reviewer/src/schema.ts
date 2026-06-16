import { z } from "zod";

export const reviewSchema = z.object({
  summary: z.string().describe("Brief summary of the code review"),
  issues: z.array(
    z.object({
      severity: z.enum(["error", "warning", "info"]),
      description: z.string(),
      suggestion: z.string().optional(),
    }),
  ),
  approved: z.boolean().describe("Whether the code passes review"),
});
