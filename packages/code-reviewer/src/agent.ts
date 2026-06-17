import { ToolLoopAgent, Output } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { reviewSchema, ReviewOutput } from "./schema.js";
import { SYSTEM_PROMPT } from "./prompt.js";

export { ReviewOutput };

export async function reviewCode(params: {
  diff: string;
  prTitle: string;
  prBody?: string;
}): Promise<ReviewOutput> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  const openrouter = createOpenRouter({ apiKey });
  const agent = new ToolLoopAgent({
    model: openrouter("anthropic/claude-sonnet-4-5"),
    instructions: SYSTEM_PROMPT,
    output: Output.object({ schema: reviewSchema }),
  });

  const prBodyLine = params.prBody ? `PR body: ${params.prBody}\n\n` : "";
  const prompt = `PR title: ${params.prTitle}\n${prBodyLine}Review the following git diff:\n\n${params.diff}`;

  const { output } = await agent.generate({ prompt });
  return output;
}
