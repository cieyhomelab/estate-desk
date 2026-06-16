import "dotenv/config";
import { reviewCode } from "./agent";

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

  const output = await reviewCode(sampleCode);
  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
}

void main().catch((err: unknown) => {
  process.stderr.write(String(err) + "\n");
});
