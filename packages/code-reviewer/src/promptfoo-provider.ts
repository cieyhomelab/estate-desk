import { reviewCode } from './agent.js';

// promptfoo injects the provider's config: block into context.config at runtime.
// The type declarations don't expose it, so we widen the context param here.
const provider = {
  id: () => 'code-reviewer',
  async callApi(
    _prompt: string,
    context?: { vars?: Record<string, string>; config?: Record<string, string> },
  ): Promise<{ output: unknown }> {
    const vars = context?.vars ?? {};
    const model: string | undefined = context?.config?.model;
    const result = await reviewCode({
      diff: vars.diff ?? '',
      prTitle: vars.prTitle ?? '',
      prBody: vars.prBody,
      model,
    });
    return { output: result };
  },
};

export default provider;
