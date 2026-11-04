import test from "node:test";
import assert from "node:assert/strict";
import { simulate } from "../core/engine.mjs";
import api from "../api/index.mjs";
test("healthy delivers once", () => {
  const r = simulate({ scenario: "healthy" });
  assert.equal(r.summary.delivered, 6);
  assert.equal(r.summary.attempts, 6);
  assert.equal(r.summary.sideEffects, 6);
});
test("transient retries then succeeds without false dedupe", () => {
  const r = simulate();
  assert.equal(r.summary.attempts, 18);
  assert.equal(r.summary.delivered, 6);
  assert(r.attempts.every((x) => !x.deduplicated));
});
test("permanent errors are not retried", () => {
  const r = simulate({ scenario: "permanent" });
  assert.equal(r.summary.attempts, 6);
  assert.equal(r.summary.dead, 6);
});
test("retry budget produces dead letters", () =>
  assert.equal(simulate({ maxAttempts: 2 }).summary.dead, 6));
test("Retry-After sets exact delay", () => {
  const r = simulate({ scenario: "rate-limit", events: 1 });
  assert.equal(r.attempts[1].time, 3000);
});
test("lost acknowledgements deduplicate effects", () => {
  const r = simulate({ scenario: "lost-ack" });
  assert.equal(r.summary.attempts, 12);
  assert.equal(r.summary.sideEffects, 6);
  assert.equal(r.attempts.filter((x) => x.deduplicated).length, 6);
});
test("without dedupe timeout creates duplicate effects", () =>
  assert.equal(
    simulate({ scenario: "lost-ack", dedupe: false }).summary.duplicates,
    6,
  ));
test("timeout exhausting retries can have committed effects", () => {
  const r = simulate({ scenario: "lost-ack", maxAttempts: 1 });
  assert.equal(r.summary.dead, 6);
  assert.equal(r.summary.sideEffects, 6);
});
test("redrive recovers dead letters without duplicate effects", () => {
  const r = simulate({ scenario: "lost-ack", maxAttempts: 1, redrive: true });
  assert.equal(r.summary.dead, 0);
  assert.equal(r.summary.delivered, 6);
  assert.equal(r.summary.sideEffects, 6);
});
test("seed is reproducible and queue remains chronological", () => {
  const a = simulate({ seed: 4 }),
    b = simulate({ seed: 4 });
  assert.deepEqual(a, b);
  assert(a.attempts.every((x, i) => !i || x.time >= a.attempts[i - 1].time));
  assert.notDeepEqual(a.attempts, simulate({ seed: 5 }).attempts);
});
test("input bounds reject oversized simulation", () => {
  for (const input of [
    { events: 31 },
    { maxAttempts: 0 },
    { seed: -1 },
    { scenario: "url" },
    { dedupe: "yes" },
  ])
    assert.throws(() => simulate(input));
});
test("API computes result and rejects bad requests", async () => {
  const send = (body, origin = "https://app.test") =>
    api.fetch(
      new Request("https://app.test/api/simulate", {
        method: "POST",
        headers: { origin },
        body,
      }),
    );
  assert.equal((await send("{}")).status, 200);
  assert.equal((await send("bad")).status, 400);
  assert.equal((await send("{}", "https://evil.test")).status, 403);
  assert.equal((await send("x".repeat(8001))).status, 413);
});
