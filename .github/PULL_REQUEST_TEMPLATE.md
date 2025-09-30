## Summary

This pull request applies a targeted refactor to address a Qlty-reported maintainability smell in `src/controllers/helpers.js`.

What changed:
- Extracted helper functions from `helpers.formatApiResponse` to reduce function complexity.

Qlty validation:
- Ran: `qlty smells src/controllers/helpers.js --no-snippets`
- Result: complexity of the previously targeted function reduced; remaining high-complexity functions noted for future work.

Testing notes:
- `npm run lint` produced no new errors (1 unrelated warning).
- `npm test` failed in the environment due to EADDRINUSE (port 4567 already in use). Local test run on a clean environment is recommended.

Manual verification steps:
1. Start NodeBB locally.
2. Trigger API routes that use `helpers.formatApiResponse` (e.g., permission-denied responses) and observe logs.

Closes: (none) — this is a small refactor. Please review and advise if you'd like me to continue with other Qlty issues in this file.
