// src/worker.js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // --- CORS helper ---
    const origin = request.headers.get("Origin") || "";
    const allow = [
      "https://chat.oyunsanaa.com",
      "https://oyunsanaa-chatbox-wix.pages.dev",
    ];
    const allowOrigin = allow.includes(origin) ? origin : "*";
    const cors = (extra = {}) => ({
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
      ...extra,
    });

    // Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors() });
    }

    // Health
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
        headers: cors({ "Content-Type": "application/json" }),
      });
    }

    // Chat endpoint
    if (url.pathname === "/v1/chat" && request.method === "POST") {
      try {
        const body = await request.json().catch(() => ({}));
        const text = body.text || "";
        const images = Array.isArray(body.images) ? body.images : [];
        const chatHistory = Array.isArray(body.chatHistory) ? body.chatHistory : [];
        const userLang = (body.userLang || "mn").split("-")[0];
        const forceModel = body.forceModel || "";
        const maxOutput = body.maxOutput || 800;

        // Model selection
        const hasImage = images.length > 0;
        let model = "gpt-4o-mini";
        if (forceModel) model = forceModel;
        else if (hasImage) model = "gpt-4o";
        else if (chatHistory.length >= 12) model = "gpt-4o";

        // Build input parts (Responses API expects input_text / input_image)
        const parts = [];
        if (text.trim()) parts.push({ type: "input_text", text: text.slice(0, 8000) });
        for (const d of images) parts.push({ type: "input_image", image_data: d });

        const r = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model,
            input: [{ role: "user", content: parts }],
            max_output_tokens: maxOutput,
            metadata: { app: "oyunsanaa-chat", userLang },
          }),
        });

        if (!r.ok) {
          return new Response(
            JSON.stringify({ ok: false, error: "OPENAI_ERROR", detail: await r.text() }),
            { status: 502, headers: cors({ "Content-Type": "application/json" }) }
          );
        }

        const data = await r.json();
        const out = (data?.output?.[0]?.content) || [];
        const reply =
          (out.find(c => c.type === "output_text")?.text) ??
          (out[0]?.text) ?? "";

        // Return in the shape your UI expects
        return new Response(
          JSON.stringify({
            ok: true,
            model,
            output: [
              { role: "assistant", content: [{ type: "text", text: reply }] }
            ],
          }),
          { headers: cors({ "Content-Type": "application/json" }) }
        );
      } catch (e) {
        return new Response(
          JSON.stringify({ ok: false, error: "SERVER_ERROR", detail: String(e) }),
          { status: 500, headers: cors({ "Content-Type": "application/json" }) }
        );
      }
    }

    // Fallback
    return new Response("Not Found", { status: 404, headers: cors() });
  }
};
