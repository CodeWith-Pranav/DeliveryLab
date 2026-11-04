"use strict";
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let result = null,
  view = "overview",
  filter = "",
  busy = false;
const names = {
  overview: "Delivery overview",
  attempts: "Attempt explorer",
  receiver: "Receiver effects",
  dead: "Dead-letter queue",
};
function table(rows, columns) {
  return (
    '<div class="table-wrap"><table><thead><tr>' +
    columns.map((c) => "<th>" + esc(c[0]) + "</th>").join("") +
    "</tr></thead><tbody>" +
    rows
      .map(
        (r) =>
          "<tr>" +
          columns.map((c) => "<td>" + esc(c[1](r)) + "</td>").join("") +
          "</tr>",
      )
      .join("") +
    "</tbody></table></div>"
  );
}
function attempts(rows) {
  return table(rows, [
    ["EVENT", (x) => x.id],
    ["TIME", (x) => (x.time / 1000).toFixed(2) + "s"],
    ["TRY", (x) => x.attempt + (x.redriven ? " (redrive)" : "")],
    ["RESPONSE", (x) => x.label],
    ["DECISION", (x) => x.decision],
    [
      "NEXT",
      (x) => (x.nextAt === null ? "—" : (x.nextAt / 1000).toFixed(2) + "s"),
    ],
    ["DEDUPED", (x) => (x.deduplicated ? "Yes" : "—")],
  ]);
}
function render() {
  if (!result) return;
  const s = result.summary;
  $("#crumb").textContent = names[view];
  document
    .querySelectorAll(".nav")
    .forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  let html =
    '<div class="stats">' +
    [
      ["Delivered", s.delivered, "of " + s.events + " logical events"],
      ["HTTP attempts", s.attempts, "includes retries and redrive"],
      ["Dead letters", s.dead, "need inspection before redrive"],
      ["Receiver effects", s.sideEffects, s.duplicates + " duplicate effects"],
    ]
      .map(
        (x) =>
          '<div class="stat"><small>' +
          x[0] +
          "</small><strong>" +
          x[1] +
          "</strong><span>" +
          x[2] +
          "</span></div>",
      )
      .join("") +
    "</div>";
  if (view === "overview")
    html +=
      '<div class="banner">Experiment complete · ' +
      (s.duration / 1000).toFixed(2) +
      "s virtual duration · seed " +
      result.config.seed +
      '</div><div class="grid"><section class="panel"><h2>The delivery lifecycle</h2><div class="flow"><div class="node"><strong>' +
      s.events +
      '</strong>Produced</div>→<div class="node"><strong>' +
      s.attempts +
      '</strong>Attempts</div>→<div class="node"><strong>' +
      s.delivered +
      '</strong>Acknowledged</div></div><div class="notice">' +
      (result.config.scenario === "lost-ack"
        ? "A receiver can commit successfully while the sender sees a timeout. Compare deduplication on and off to see why at-least-once delivery is not exactly-once processing."
        : "Failures are classified before retrying. Retryable errors use bounded attempts; permanent errors stop immediately.") +
      '</div></section><section class="panel"><h2>Experiment contract</h2><p>Backoff: exponential with 50–100% seeded jitter.<br>429: a 3-second Retry-After.<br>Timeout and 5xx: retryable.<br>Other 4xx: permanent failure.</p><p>Receiver deduplication: <b>' +
      (result.config.dedupe ? "enabled" : "disabled") +
      "</b><br>Redrive recovery: <b>" +
      (result.config.redrive ? "enabled" : "not applied") +
      '</b></p></section></div><section class="panel"><div class="heading"><h2>Recent attempts</h2><button class="secondary" data-view="attempts">Inspect all →</button></div>' +
      attempts(result.attempts.slice(-8)) +
      "</section>";
  if (view === "attempts")
    html +=
      '<section class="panel"><div class="heading"><h2>Every attempt, explained</h2><input class="filter" id="filter" placeholder="Filter event ID…" value="' +
      esc(filter) +
      '" aria-label="Filter event ID"></div>' +
      attempts(result.attempts.filter((x) => x.id.includes(filter))) +
      "</section>";
  if (view === "receiver")
    html +=
      '<section class="panel"><h2>Committed side effects</h2><p>Each row is an effect applied by the simulated receiver. A retry with the same event ID must not apply that effect twice when deduplication is enabled.</p>' +
      table(result.receipts, [
        ["EVENT", (x) => x.id],
        ["TIME", (x) => (x.time / 1000).toFixed(2) + "s"],
        ["EFFECT #", (x) => x.sideEffect],
        ["DUPLICATE", (x) => (x.duplicate ? "Yes" : "No")],
      ]) +
      "</section>";
  if (view === "dead")
    html +=
      '<section class="panel"><div class="heading"><div><h2>Dead-letter queue</h2><p>Redrive models one retry after the receiver is repaired.</p></div><button class="primary" id="redrive" ' +
      (!s.dead ? "disabled" : "") +
      ">Repair & redrive →</button></div>" +
      (s.dead
        ? table(result.dead, [
            ["EVENT", (x) => x.id],
            ["LAST TRY", (x) => x.attempt],
            ["REASON", (x) => x.reason],
          ])
        : '<div class="empty">No dead letters. All events received an acknowledgement.</div>') +
      "</section>";
  $("#result").innerHTML = html;
}
function config() {
  return {
    scenario: $("#scenario").value,
    events: +$("#events").value,
    maxAttempts: +$("#maxAttempts").value,
    baseDelay: +$("#baseDelay").value,
    seed: +$("#seed").value,
    dedupe: $("#dedupe").checked,
    redrive: false,
  };
}
async function run(c) {
  if (busy) return;
  busy = true;
  $("#run").disabled = true;
  $("#run").textContent = "Running…";
  $("#error").textContent = "";
  try {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 20000);
    let r;
    try {
      r = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    const d = await r.json();
    if (!r.ok) throw Error(d.error || "Request failed");
    result = d;
    try {
      localStorage.setItem("deliverylab-config", JSON.stringify(c));
    } catch {}
    render();
  } catch (e) {
    $("#error").textContent =
      e.name === "AbortError" ? "Request timed out. Try again." : e.message;
  } finally {
    busy = false;
    $("#run").disabled = false;
    $("#run").textContent = "Run experiment →";
  }
}
$("#config").addEventListener("submit", (e) => {
  e.preventDefault();
  run(config());
});
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.view) {
    view = b.dataset.view;
    filter = "";
    render();
  }
  if (b.id === "redrive") run({ ...result.config, redrive: true });
});
document.addEventListener("input", (e) => {
  if (e.target.id === "filter") {
    filter = e.target.value;
    const pos = e.target.selectionStart;
    render();
    $("#filter").focus();
    $("#filter").setSelectionRange(pos, pos);
  }
});
$("#help").onclick = () => $("#guide").showModal();
$("#close-help").onclick = () => $("#guide").close();
$("#export").onclick = () => {
  if (!result) return;
  const a = document.createElement("a"),
    url = URL.createObjectURL(
      new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }),
    );
  a.href = url;
  a.download = "deliverylab-experiment.json";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
try {
  const saved = JSON.parse(localStorage.getItem("deliverylab-config"));
  if (saved) {
    for (const k of ["scenario", "events", "maxAttempts", "baseDelay", "seed"])
      if (saved[k] !== undefined) $("#" + k).value = saved[k];
    if (typeof saved.dedupe === "boolean") $("#dedupe").checked = saved.dedupe;
  }
} catch {}
run(config());
