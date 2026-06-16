import { ToolLoopAgent, Output } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { reviewSchema } from "./schema";
import { SYSTEM_PROMPT } from "./prompt";

export type ReviewOutput = z.infer<typeof reviewSchema>;

export async function reviewCode(code: string): Promise<ReviewOutput> {
  const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
  const agent = new ToolLoopAgent({
    model: openrouter("anthropic/claude-sonnet-4-5"),
    instructions: SYSTEM_PROMPT,
    output: Output.object({ schema: reviewSchema }),
  });
  const { output } = await agent.generate({
    prompt: `Review this JavaScript code for bugs and issues:\n\n${code}`,
  });
  return output;
}
