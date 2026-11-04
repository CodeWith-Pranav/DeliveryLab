# Architecture

Browser config -> POST /api/simulate -> validation -> seeded simulation -> attempt/effect/queue report -> dashboard.

Producer event IDs remain stable across retries. Pending attempts are ordered by timestamp and event ID. Exponential delay uses deterministic 50–100% jitter. 429 selects a fixed three-second Retry-After instead. Successful acknowledgement finishes a delivery. Retryable failures exhaust at maxAttempts; permanent failures stop immediately.

The receiver's seen-event set is independent of sender acknowledgement state. A lost ACK commits its side effect but returns a timeout to the sender. This creates the educational contrast between transport delivery and receiver processing.

There is no persistent server state or shared workspace. Client configuration is localStorage data, and downloaded reports are explicit exports. Inputs are bounded. Responses are no-store; POSTs reject foreign Origin headers. No secrets, targets, arbitrary source execution or user data are accepted.
