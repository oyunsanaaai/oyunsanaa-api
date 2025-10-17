export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1️⃣ Health check
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2️⃣ Chat endpoint
    if (url.pathname === "/v1/chat" && request.method === "POST") {
      try {
        const body = await request.json();
        const text = body.text || "";
        const images = body.images || [];
        const userLang = body.userLang || "mn";
        const model = "gpt-4o-mini";
        const maxOutput = 800;

        // ⬇️ INPUT TYPE FIX
        const parts = [];
        if (text?.trim())
          parts.push({ type: "input_text", text: text.slice(0, 8000) });
        if (images?.length)
          for (const d of images)
            parts.push({ type: "input_image", image_data: d });

        // 3️⃣ OpenAI Responses API руу хүсэлт
        const r = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model,
            input: [{ role: "user", content: parts }],
            max_output_tokens: maxOutput,
            metadata: { app: "oyunsanaa-chat", userLang },
          }),
        });

        const data = await r.json();

        // ⬇️ OUTPUT FIX
        const out = data?.output?.[0]?.content || [];
        const reply =
          (out.find((c) => c.type === "output_text")?.text) ??
          (out[0]?.text) ??
          "…";

        return new Response(
          JSON.stringify({
            ok: true,
            model,
            reply,
            raw: data,
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "SERVER_ERROR",
            detail: err.message,
          }),
          { status: 500 }
        );
      }
    }

    // 4️⃣ Default — not found
    return new Response("Not Found", { status: 404 });
  },
};
