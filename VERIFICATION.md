# Verification record

Date: 2026-11-04. Runtime: Node 22+.

## Automated

`npm test`: 12 tests covering healthy delivery, transient retries, permanent failure, retry exhaustion, Retry-After, lost acknowledgements, enabled/disabled deduplication, receiver commits despite delivery failure, recovered redrive, seeded reproducibility and request validation. `node --check public/app.js` passed.

## Deployed browser checks

Production: https://deliverylab-three.vercel.app/.

- Permanent 400: six events produce six dead letters and no receiver effects.
- Repair & redrive: six delivered, twelve total attempts, zero dead letters, six effects.
- Lost ACK with deduplication: six delivered, twelve attempts, six effects.
- Lost ACK without deduplication: six delivered, twelve attempts, twelve effects including six duplicates.
- Attempt explorer filtering evt_001 displays its two attempts.
- JSON export triggered a completed browser download. Export bytes were not separately inspected.
- Desktop layout inspected visually. Dedicated mobile viewport and assistive-technology testing have not been performed.

## Limits

These are correctness checks for a small deterministic simulator, not a penetration test or load test. No external webhook, durable queue, production receiver, multi-user account isolation or distributed transaction is implemented. All 18 uploaded source files were byte-matched against the local implementation, and the tests passed again from a fresh public clone. GitHub Actions Tests passed on commit 4da3592. Vercel Git integration is connected.
