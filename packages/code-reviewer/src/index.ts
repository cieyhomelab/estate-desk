import "dotenv/config";
import { readFileSync } from "fs";
import { reviewCode, ReviewOutput } from "./agent.js";

type CIReviewOutput = ReviewOutput & { passed: boolean };

async function main() {
  const prTitle = process.env.PR_TITLE;
  const diffFile = process.env.DIFF_FILE;

  if (!prTitle) {
    process.stderr.write("Missing required env var: PR_TITLE\n");
    process.exit(1);
  }
  if (!diffFile) {
    process.stderr.write("Missing required env var: DIFF_FILE\n");
    process.exit(1);
  }

  const diff = readFileSync(diffFile, "utf-8");
  const prBody = process.env.PR_BODY ?? "";

  const output = await reviewCode({ diff, prTitle, prBody });
  const augmented: CIReviewOutput = { ...output, passed: output.overall_score >= 7 };
  process.stdout.write(JSON.stringify(augmented) + "\n");
}

void main().catch((err: unknown) => {
  process.stderr.write(String(err) + "\n");
  process.exit(1);
});
