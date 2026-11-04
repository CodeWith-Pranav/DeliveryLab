# DeliveryLab: understand it before presenting it

## What you built

A browser-based teaching and debugging sandbox for webhook reliability. A webhook is an HTTP notification sent when an event occurs. DeliveryLab models the sender and receiver rather than contacting a real remote service. It lets you inspect what would happen after failures, retries and lost acknowledgements.

The frontend is `public/index.html`, `public/style.css` and `public/app.js`. The backend is `api/index.mjs`. The simulation logic is `core/engine.mjs`. Vercel serves both. There is no AI model, paid API, account system or database. Those would not add value to this experiment.

## Trace one request

1. The user configures a scenario and clicks Run experiment.
2. The browser sends JSON to `/api/simulate` on the same site.
3. The API checks request size, origin and configuration bounds.
4. The engine creates events and repeatedly takes the earliest scheduled attempt.
5. A modeled response either acknowledges an event, schedules a retry, or creates a dead letter.
6. The API returns counters, attempt records, effects and dead letters as JSON.
7. The frontend renders the response. Export JSON downloads that result.

The virtual clock advances through scheduled timestamps without actually waiting. A simulated 30-second delay does not require a 30-second function invocation.

## Five-minute demonstration

Use six events and four attempts. Run transient failures: each event receives two 503 responses before success. Open Attempt explorer and inspect a single event. Run permanent failure: each event stops after one 400 response. Open Dead-letter queue, then Repair & redrive to model a repaired receiver. Finally run Lost acknowledgement with deduplication enabled, then disabled. Both deliver six events, but disabling deduplication applies twelve effects. Explain why a timeout does not prove the receiver failed to process the event.

## Concepts to explain in interviews

- Delivery acknowledgement and committed processing are different facts.
- At-least-once delivery can duplicate processing; receiver deduplication uses stable event IDs.
- Exponential backoff reduces repeated load; jitter spreads retry timestamps.
- Retry budgets prevent endless retries. Permanent failures should not be retried blindly.
- A dead-letter queue retains failures for inspection and a later recovery attempt.
- A seed makes pseudo-random experiments repeatable. This generator is not cryptographic.
- A sorted array is adequate for these small bounds; a min-heap improves scheduling at larger scales.
- The in-memory Set models deduplication. A real receiver needs transactional durable storage and a suitable unique constraint to handle concurrent workers safely.

Be candid about scope and assistance. Explain what you understand, what you changed and how you verified it. Do not claim production traffic, users, measured throughput, real integrations or model training that did not happen.

## Run on your computer

Install Node 22 or newer, extract the source, open a terminal in the deliverylab folder, run `npm ci`, then `npm test`, then `npm start`. Open http://localhost:3000. Keep the terminal running. Stop with Ctrl+C. No environment file is required. If port 3000 is occupied, use a different PORT environment variable using your terminal's syntax.

## Where to make changes

| Goal | Files |
| --- | --- |
| Change copy, labels or form controls | public/index.html |
| Change layout and colors | public/style.css |
| Change tables, view behavior or export | public/app.js |
| Change retry policy or scenarios | core/engine.mjs |
| Change HTTP validation | api/index.mjs |
| Verify changed behavior | tests/engine.mjs |

To add a scenario, update the select options, the engine's allowed scenarios and response rules, then add a behavior test. Keep UI labels and the documented contract consistent. For a UI-only change, inspect it in the browser and check console errors; do not add tests that just repeat markup.

## Common questions

**Why does 400 stop immediately?** This project's policy treats it as a permanent request problem. A real service's documented contract may require a different classification.

**Why is every 429 delay three seconds?** It is a controlled modeled Retry-After value. The project does not parse arbitrary real HTTP date or integer headers.

**What does redrive do?** It reruns the configuration with a recovery phase, retaining the modeled deduplication state within that run. It does not update a persisted queue from a previous request.

**What survives refresh?** Configuration is saved in localStorage. Results are recalculated; JSON export is the portable record. Different browser profiles do not share saved configuration.

**Why does the deployed API work without a separate backend URL?** Both frontend and API use the same Vercel domain. A relative request path reaches the backend through Vercel routing.

**What if the API fails?** The interface displays the error. Retry after checking the network and Vercel deployment status. A 400 usually means invalid input; a 413 means the request body exceeded the limit. Do not paste credentials into configuration fields.

## GitHub and deployment

GitHub stores source and real commit history. Vercel hosts the running app. The current deployment was uploaded directly; it does not yet auto-deploy on GitHub changes. After repository creation, upload this source, verify the Actions test run, and link the existing Vercel project to the repository to enable Git-driven deployments. Do not create another Vercel project just to link Git. Keep future commits honest and descriptive; do not invent past dates or development history.

## Good next learning change

Implement a min-heap scheduler while preserving deterministic tie-breaking. Compare the old and new engine outputs for identical configurations, and document the complexity difference. This adds a concrete DSA contribution you can defend in an interview.
