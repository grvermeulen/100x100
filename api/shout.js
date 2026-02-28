const DEFAULT_MODEL = "gpt-5-nano";

function parseBody(req) {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  if (typeof req.body === "object" && req.body !== null) {
    return req.body;
  }
  return {};
}

function sanitizeOneLine(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/["'`]/g, "")
    .trim()
    .slice(0, 90);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
  }

  const model = String(process.env.OPENAI_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  const body = parseBody(req);

  const swimmerName = sanitizeOneLine(body.swimmerName || "Swimmer");
  const totalMeters = Number.isFinite(Number(body.totalMeters))
    ? Math.max(0, Math.floor(Number(body.totalMeters)))
    : 0;
  const recentShouts = Array.isArray(body.recentShouts)
    ? body.recentShouts.map((line) => sanitizeOneLine(line)).filter(Boolean).slice(-20)
    : [];

  const systemPrompt =
    "You create energetic and playful swimming encouragement one-liners. " +
    "Use fluent natural English. Keep it family-friendly. " +
    "Return only one short line, no quotes, no emojis, no hashtags.";

  const userPrompt = [
    `Swimmer: ${swimmerName}`,
    `Team total: ${totalMeters}m`,
    recentShouts.length ? `Avoid repeating these lines: ${recentShouts.join(" | ")}` : "",
    "Write one unique shout-out under 14 words."
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 1.05,
        max_tokens: 40,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text();
      return res.status(openAiResponse.status).json({
        error: "OpenAI request failed",
        details: errorText.slice(0, 500)
      });
    }

    const data = await openAiResponse.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    const shout = sanitizeOneLine(raw);
    if (!shout) {
      return res.status(500).json({ error: "Model returned empty shout" });
    }
    return res.status(200).json({ shout });
  } catch (error) {
    return res.status(500).json({
      error: "Shout generation failed",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
