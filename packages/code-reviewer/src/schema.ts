import { z } from "zod";

export const criterionSchema = z.object({
  name: z.enum([
    "implementation_correctness",
    "idiomaticity",
    "complexity",
    "test_risk_coverage",
    "documentation",
    "security_safety",
  ]),
  score: z.number().int(),
  rationale: z.string(),
  issues: z.array(z.string()).optional(),
});

export const reviewSchema = z.object({
  summary: z.string(),
  criteria: z.array(criterionSchema),
  overall_score: z.number().int(),
});

export type ReviewOutput = z.infer<typeof reviewSchema>;
