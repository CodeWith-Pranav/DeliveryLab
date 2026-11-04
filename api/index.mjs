import { simulate } from "../core/engine.mjs";
export default {
  async fetch(req) {
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    };
    const url = new URL(req.url);
    if (req.method === "GET")
      return Response.json(
        { status: "ok", app: "DeliveryLab", version: "1.0.0" },
        { headers },
      );
    if (req.method !== "POST")
      return Response.json({ error: "Use POST" }, { status: 405, headers });
    if (req.headers.get("origin") && req.headers.get("origin") !== url.origin)
      return Response.json(
        { error: "Foreign origin rejected" },
        { status: 403, headers },
      );
    try {
      const reader = req.body?.getReader();
      let text = "",
        size = 0;
      const decoder = new TextDecoder();
      if (!reader) throw Error("JSON body required");
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 8000) {
          await reader.cancel();
          return Response.json(
            { error: "Request too large" },
            { status: 413, headers },
          );
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
      return Response.json(simulate(JSON.parse(text)), { headers });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 400, headers });
    }
  },
};
