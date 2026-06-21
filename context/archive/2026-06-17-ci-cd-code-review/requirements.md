## Overall concept
- GitHub Actions workflow run for every new pull request to master
- composite action for the review itself so that main workflow is easy to reason about

## Input parameters
- pull request title
- pull request description (?? cost tradeoff)
- git diff

## Code Review Criteria

1) **Implementation correctness** — Does the code do what it claims, without logical errors, off-by-ones, or incorrect assumptions about data flow?
   - 1: Broken logic, wrong outputs, or clearly missing edge-case handling
   - 10: All code paths are correct, edge cases handled, behavior matches intent

2) **Idiomaticity** — Does the code follow the conventions and patterns natural to the language and framework in use?
   - 1: Reinvents built-ins, ignores language conventions, reads like a port from another paradigm
   - 10: Reads as native to the stack; uses framework idioms, standard library features, and established patterns throughout

3) **Complexity** — Is the code as simple as it can be for the problem it solves, without unnecessary indirection or abstraction?
   - 1: Deeply nested, hard to trace, over-engineered with layers that add no value
   - 10: Flat, linear, each function does one thing; complexity matches the problem domain, not the author's preference

4) **Test / risk coverage** — Are the riskiest paths and logic branches exercised by tests proportional to their probability of failure?
   - 1: No tests, or tests that only cover the happy path on trivial code
   - 10: High-risk paths, edge cases, and integration points all covered; tests fail meaningfully when the code breaks

5) **Documentation** — Are non-obvious decisions, constraints, and public contracts explained where a future reader would need them?
   - 1: No comments where intent is genuinely unclear; public APIs undocumented
   - 10: Every non-obvious why is captured; public interfaces have concise contracts; nothing over-commented

6) **Security and safety** — Does the code handle untrusted input, sensitive data, and shared state without introducing exploitable vulnerabilities?
   - 1: Accepts raw user input unsanitized, leaks secrets, or introduces obvious injection vectors
   - 10: All trust boundaries validated, secrets isolated server-side, no known OWASP top-10 patterns present

## Parked for later
- business alignment (require broader context)
- architectural fit (require broader context)

## Expected side-effects
- PR comment with summary
- labels: `ai-cr:failed` (red) OR `ai-cr:passed` (green)

## Expected behavior
- on-demand retry when label `ai-cr:review` (grey) is added