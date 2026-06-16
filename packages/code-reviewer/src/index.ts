import "dotenv/config";
import { generateText, Output } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const model = openrouter("anthropic/claude-sonnet-4-5");

const reviewSchema = z.object({
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

async function main() {
  const sampleCode = `
function calculateTotal(items) {
  let total = 0;
  for (let i = 0; i <= items.length; i++) {
    total += items[i].price;
  }
  return total;
}
  `.trim();

  const { output } = await generateText({
    model,
    output: Output.object({ schema: reviewSchema }),
    system:
      "You are senior code reviewer. Report only genuine issues. correctnes bugs, security problems and clear maintainability concerns. Do not invent problems, empty findings list is valid result",
    prompt: `Review this JavaScript code for bugs and issues:\n\n${sampleCode}`,
  });

  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
}

void main().catch((err: unknown) => {
  process.stderr.write(String(err) + "\n");
});
