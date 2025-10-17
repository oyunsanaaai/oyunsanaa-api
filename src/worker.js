// src/worker.js
export default {
  async fetch(request, env) {
    const ORIGIN = request.headers.get("Origin") || "";
    const ALLOW = [
      "https://chat.oyunsanaa.com",
      "https://oyunsanaa-chatbox-wix.pages.dev",
    ];
    const allow = ALLOW.includes(ORIGIN) ? ORIGIN : "*";
    const cors = (extra = {}) => ({
      "Access-Control-Allow-Origin": allow,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
      ...extra,
    });

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors() });
    }

    const url = new URL(request.url);

    // Health
    if (url.pathname === "/health") {
      return Response.json({ ok: true, ts: Date.now() }, { headers: cors() });
    }

    // --- MAIN CHAT ENDPOINT ---
    if (url.pathname === "/v1/chat" && request.method === "POST") {
      try {
        const {
          text = "",
          images = [],            // array of dataURLs
          chatHistory = [],
          userLang = "mn",
          forceModel = "",        // 'gpt-4o' | 'gpt-4o-mini'
          maxOutput = 700,
        } = await request.json().catch(() => ({}));

        const hasImage = Array.isArray(images) && images.length > 0;
        let model = "gpt-4o-mini";
        if (forceModel) model = forceModel;
        else if (hasImage) model = "gpt-4o";
        else if (Array.isArray(chatHistory) && chatHistory.length >= 12) model = "gpt-4o";

        const parts = [];
        if (text?.trim()) parts.push({ type: "text", text: text.slice(0, 8000) });
        if (hasImage) for (const d of images) parts.push({ type: "input_image", image_data: d });

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
          return Response.json(
            { ok: false, error: "OPENAI_ERROR", detail: await r.text() },
            { status: 502, headers: cors({ "Content-Type": "application/json" }) }
          );
        }

        const data = await r.json();
        const reply = data?.output?.[0]?.content?.[0]?.text ?? "";

        return Response.json(
          { ok: true, model, output: [{ role: "assistant", content: [{ type: "text", text: reply }]}] },
          { headers: cors({ "Content-Type": "application/json" }) }
        );
      } catch (e) {
        return Response.json(
          { ok: false, error: "SERVER_ERROR", detail: String(e) },
          { status: 500, headers: cors({ "Content-Type": "application/json" }) }
        );
      }
    }

    // Not found / wrong method
    return new Response("Not Found", { status: 404, headers: cors() });
  }
};
