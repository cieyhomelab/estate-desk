import { ToolLoopAgent, Output } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { reviewSchema } from "./schema.js";
import type { ReviewOutput } from "./schema.js";
import { SYSTEM_PROMPT } from "./prompt.js";

export { ReviewOutput };

export async function reviewCode(params: {
  diff: string;
  prTitle: string;
  prBody?: string;
  model?: string;
}): Promise<ReviewOutput> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  const openrouter = createOpenRouter({ apiKey });
  const agent = new ToolLoopAgent({
    model: openrouter(params.model ?? "anthropic/claude-sonnet-4-6"),
    instructions: SYSTEM_PROMPT,
    output: Output.object({ schema: reviewSchema }),
  });

  const prBodySection = params.prBody
    ? `<pr_body>\n${params.prBody}\n</pr_body>\n\n`
    : "";
  const prompt = `<pr_title>${params.prTitle}</pr_title>\n\n${prBodySection}Review the following git diff:\n\n${params.diff}`;

  const timeoutMs = 60_000;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const { output } = await Promise.race([
    agent.generate({ prompt }),
    new Promise<never>((_, reject) =>
      timeoutSignal.addEventListener('abort', () =>
        reject(new Error(`reviewCode timed out after ${timeoutMs / 1000}s`)),
      ),
    ),
  ]);
  return output;
}
