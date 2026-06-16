import { ToolLoopAgent, Output } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { reviewSchema } from "./schema";
import { SYSTEM_PROMPT } from "./prompt";

export type ReviewOutput = z.infer<typeof reviewSchema>;

export async function reviewCode(code: string): Promise<ReviewOutput> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  const openrouter = createOpenRouter({ apiKey });
  // ToolLoopAgent ready for future tool extension
  const agent = new ToolLoopAgent({
    model: openrouter("anthropic/claude-sonnet-4-5"),
    instructions: SYSTEM_PROMPT,
    output: Output.object({ schema: reviewSchema }),
  });
  const { output } = await agent.generate({
    prompt: `Review this code for bugs and issues:\n\n${code}`,
  });
  return output;
}
