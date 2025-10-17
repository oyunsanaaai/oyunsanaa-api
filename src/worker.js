export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      try {
        const { text = "", images = [], chatHistory = [], userLang = "mn" } =
          await request.json().catch(() => ({}));

        // OpenAI Responses API (JSON mode)
        const r = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            input: [
              { role: "system", content: `You are OY Assistant. lang=${userLang}` },
              ...chatHistory,
              {
                role: "user",
                content: images.length
                  ? [{ type: "input_text", text }, ...images.map(d => ({ type: "input_image", image_url: d }))]
                  : [{ type: "input_text", text }],
              },
            ],
            response_format: { type: "text" },
          }),
        });

        const j = await r.json();
        const reply =
          j?.output_text ||
          j?.content?.[0]?.text ||
          j?.message ||
          "…";

        return new Response(JSON.stringify({ reply }), {
          headers: { "Content-Type": "application/json", ...cors },
        });
      } catch (e) {
        return new Response(
          JSON.stringify({ reply: "⚠️ Серверт алдаа гарлаа." }),
          { status: 500, headers: { "Content-Type": "application/json", ...cors } }
        );
      }
    }

    return new Response("OK", { headers: cors });
  },
};
