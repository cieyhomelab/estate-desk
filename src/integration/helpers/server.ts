import { spawn } from "node:child_process";

export const TEST_BASE_URL = "http://localhost:4322";
const TEST_SERVER_PORT = 4322;

let serverProcess: ReturnType<typeof spawn> | undefined;

export async function setup(): Promise<void> {
  serverProcess = spawn("npm", ["run", "dev", "--", "--port", String(TEST_SERVER_PORT), "--no-open"], {
    stdio: "ignore",
  });

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      await fetch(TEST_BASE_URL, { signal: AbortSignal.timeout(2_000) });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  serverProcess.kill("SIGTERM");
  serverProcess = undefined;
  throw new Error(`Dev server did not respond on port ${TEST_SERVER_PORT} within 60 s`);
}

export function teardown(): void {
  serverProcess?.kill("SIGTERM");
}
