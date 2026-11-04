export function simulate(input = {}) {
  const {
    scenario = "transient",
    events = 6,
    maxAttempts = 4,
    baseDelay = 1000,
    seed = 42,
    dedupe = true,
    redrive = false,
  } = input;
  if (
    !["healthy", "transient", "permanent", "rate-limit", "lost-ack"].includes(
      scenario,
    )
  )
    throw Error("Unknown receiver scenario");
  for (const [key, value, min, max] of [
    ["events", events, 1, 30],
    ["maxAttempts", maxAttempts, 1, 8],
    ["baseDelay", baseDelay, 100, 60000],
    ["seed", seed, 0, 2147483647],
  ])
    if (!Number.isInteger(value) || value < min || value > max)
      throw Error("Invalid " + key);
  if (typeof dedupe !== "boolean" || typeof redrive !== "boolean")
    throw Error("Flags must be boolean");
  let rng = seed >>> 0;
  const random = () => {
    rng = (Math.imul(1664525, rng) + 1013904223) >>> 0;
    return rng / 4294967296;
  };
  const queue = Array.from({ length: events }, (_, i) => ({
    id: "evt_" + String(i + 1).padStart(3, "0"),
    attempt: 1,
    time: 0,
    redriven: false,
  }));
  const attempts = [],
    receipts = [],
    seen = new Set(),
    dead = [],
    delivered = new Set();
  let effects = 0,
    seq = 0;
  while (queue.length) {
    queue.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
    const job = queue.shift();
    let status = 200,
      committed = false;
    const previouslySeen = seen.has(job.id);
    if (!job.redriven) {
      if (scenario === "transient" && job.attempt <= 2) status = 503;
      else if (scenario === "permanent") status = 400;
      else if (scenario === "rate-limit" && job.attempt === 1) status = 429;
      else if (scenario === "lost-ack" && job.attempt === 1) status = 0;
    }
    if (status === 200 || (scenario === "lost-ack" && status === 0)) {
      const duplicate = seen.has(job.id);
      committed = true;
      if (!dedupe || !duplicate) {
        effects++;
        receipts.push({
          id: job.id,
          time: job.time,
          duplicate,
          sideEffect: effects,
        });
      }
      seen.add(job.id);
    }
    const retryable = status === 0 || status === 429 || status >= 500;
    const success = status >= 200 && status < 300;
    const record = {
      sequence: ++seq,
      ...job,
      status,
      label: status === 0 ? "Timeout after receiver commit" : String(status),
      committed,
      deduplicated: committed && dedupe && previouslySeen,
      decision: "",
      nextAt: null,
    };
    if (success) {
      record.decision = "Delivered";
      delivered.add(job.id);
    } else if (retryable && job.attempt < maxAttempts) {
      const delay =
        status === 429
          ? 3000
          : Math.round(
              baseDelay * 2 ** (job.attempt - 1) * (0.5 + random() * 0.5),
            );
      record.decision = "Retry scheduled";
      record.nextAt = job.time + delay;
      queue.push({ ...job, attempt: job.attempt + 1, time: record.nextAt });
    } else {
      record.decision = retryable ? "Attempts exhausted" : "Permanent failure";
      dead.push({ ...job, reason: record.decision });
    }
    attempts.push(record);
  }
  if (redrive && dead.length) {
    const start = (attempts.at(-1)?.time || 0) + baseDelay;
    for (const job of dead.splice(0)) {
      const duplicate = seen.has(job.id);
      if (!dedupe || !duplicate) {
        effects++;
        receipts.push({
          id: job.id,
          time: start,
          duplicate,
          sideEffect: effects,
        });
      }
      seen.add(job.id);
      delivered.add(job.id);
      attempts.push({
        sequence: ++seq,
        id: job.id,
        attempt: 1,
        time: start,
        redriven: true,
        status: 200,
        label: "200 — recovered receiver",
        committed: true,
        deduplicated: dedupe && duplicate,
        decision: "Delivered",
        nextAt: null,
      });
    }
  }
  return {
    config: { scenario, events, maxAttempts, baseDelay, seed, dedupe, redrive },
    summary: {
      events,
      delivered: delivered.size,
      dead: dead.length,
      attempts: attempts.length,
      sideEffects: effects,
      duplicates: Math.max(0, effects - seen.size),
      duration: Math.max(0, ...attempts.map((a) => a.time)),
    },
    attempts,
    receipts,
    dead,
    limitations: [
      "Virtual-clock simulation; no requests are sent to external URLs.",
      "Receiver effects and deduplication are modeled in memory, not a production transactional store.",
      "Redrive models a recovered receiver and creates one new delivery attempt per dead letter.",
    ],
  };
}
