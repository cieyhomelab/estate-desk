import 'dotenv/config';
import { reviewCode } from './agent.js';

// promptfoo instantiates the default export with `new`, so it must be a class.
// It injects the provider's config: block into context.config at runtime;
// the type declarations don't expose it, so we widen the context param here.
class CodeReviewerProvider {
  id() {
    return 'code-reviewer';
  }

  async callApi(
    _prompt: string,
    context?: { vars?: Record<string, string>; config?: Record<string, unknown> },
  ): Promise<{ output?: unknown; error?: string }> {
    try {
      const vars = context?.vars ?? {};
      const model = context?.config?.['model'] as string | undefined;
      const result = await reviewCode({
        diff: vars.diff ?? '',
        prTitle: vars.prTitle ?? '',
        prBody: vars.prBody,
        model,
      });
      return { output: result };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export default CodeReviewerProvider;
