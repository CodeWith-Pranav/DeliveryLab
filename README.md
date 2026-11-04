# DeliveryLab

Live demo: https://deliverylab-three.vercel.app/

A deterministic webhook reliability sandbox. Explore exponential retries, seeded jitter, Retry-After, permanent errors, lost acknowledgements, receiver deduplication and dead-letter recovery.

## Run

Node 22+: `npm ci`, `npm test`, `npm start`. Open http://localhost:3000.

## What this demonstrates

At-least-once delivery may apply the same receiver effect more than once when an acknowledgement is lost. Toggle deduplication in the lost-ack scenario and compare attempts with committed effects. Permanent 4xx responses stop immediately; 429, timeouts and 5xx responses have a bounded retry budget. A 429 uses a modeled 3-second Retry-After. Redrive adds a recovery phase with one successful attempt per dead letter.

## Architecture

The vanilla HTML/CSS/JS interface sends experiment configuration to a Node web API. `core/engine.mjs` computes a discrete-event simulation. `api/index.mjs` validates requests and invokes the same engine tested locally. Vercel hosts static assets and the API. The local Node server is an alternative entrypoint.

## Scope

This is a simulation, not a production webhook dispatcher. No requests go to external URLs. Time is virtual; effects and deduplication records are modeled in memory. The browser saves configuration only; results can be exported as JSON. There are no user accounts, durable server queues, signatures, distributed leases, cron workers or real transactional receiver guarantees. No throughput or production reliability claim is made.

The current queue implementation sorts pending jobs before dispatch. This is simple for the bounded maximum of 30 events and 8 attempts. A heap is a sensible extension for larger simulations. The simulator processes logical attempts sequentially in virtual timestamp order; it does not benchmark concurrent network workers.

## Verification

`npm test` covers success, transient failures, nonretryable errors, retry exhaustion, Retry-After, receiver effects despite timeouts, deduplication, duplicate side effects, recovery, deterministic seeds, chronological scheduling, bounds and API validation.

## Deployment

Vercel only. Import the repository with no framework preset, output directory `public`, and Node 22. The API entrypoint is `api/index.mjs`; `vercel.json` routes `/api/*` to it. No private environment variables are required.

## Suggested extensions

Priority-queue scheduling, circuit breaking, richer scripted receiver responses and comparative policy experiments. A real delivery service would additionally require durable storage, leases, secret management, target validation and abuse controls.

## Learn and maintain

Start with [BEGINNER-GUIDE.md](BEGINNER-GUIDE.md) for the request flow, a demonstration script, interview questions and common changes. See [VERIFICATION.md](VERIFICATION.md) for the completed checks and their limits.
