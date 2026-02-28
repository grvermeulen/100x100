const DEFAULT_MODEL = "gpt-5-nano";
const KNOWN_NAMES = ["carlijn", "guido", "rik", "saskia", "wouter"];
const BANNED_WORDS = ["team"];

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

function removeKnownNames(text) {
  let cleaned = String(text || "");
  for (const name of KNOWN_NAMES) {
    const pattern = new RegExp(`\\b${name}\\b`, "gi");
    cleaned = cleaned.replace(pattern, "");
  }
  cleaned = cleaned
    .replace(/^[\s,:;\-–—]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned;
}

function removeBannedWords(text) {
  let cleaned = String(text || "");
  for (const word of BANNED_WORDS) {
    const pattern = new RegExp(`\\b${word}\\b`, "gi");
    cleaned = cleaned.replace(pattern, "");
  }
  return cleaned
    .replace(/\s{2,}/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,+/g, ",")
    .replace(/,\./g, ".")
    .replace(/\s+\./g, ".")
    .replace(/^[\s,:;\-–—]+/, "")
    .trim();
}

function extractTextFromOpenAi(data) {
  const messageContent = data?.choices?.[0]?.message?.content;
  if (typeof messageContent === "string") return messageContent;
  if (Array.isArray(messageContent)) {
    return messageContent
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        if (typeof part?.content === "string") return part.content;
        return "";
      })
      .join(" ")
      .trim();
  }

  if (typeof data?.choices?.[0]?.text === "string") return data.choices[0].text;
  if (typeof data?.output_text === "string") return data.output_text;

  if (Array.isArray(data?.output)) {
    const joined = data.output
      .flatMap((item) => (Array.isArray(item?.content) ? item.content : []))
      .map((part) => {
        if (typeof part?.text === "string") return part.text;
        if (typeof part === "string") return part;
        return "";
      })
      .join(" ")
      .trim();
    if (joined) return joined;
  }

  return "";
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

  const totalMeters = Number.isFinite(Number(body.totalMeters))
    ? Math.max(0, Math.floor(Number(body.totalMeters)))
    : 0;
  const recentShouts = Array.isArray(body.recentShouts)
    ? body.recentShouts.map((line) => sanitizeOneLine(line)).filter(Boolean).slice(-20)
    : [];

  const systemPrompt =
    "You create energetic and playful swimming encouragement one-liners. " +
    "Use fluent natural English. Keep it family-friendly. " +
    "Do not include any person's name in the line. " +
    "Do not use the word 'team'. " +
    "Return only one short line, no quotes, no emojis, no hashtags.";

  const userPrompt = [
    `Team total: ${totalMeters}m`,
    recentShouts.length ? `Avoid repeating these lines: ${recentShouts.join(" | ")}` : "",
    "Write one unique shout-out under 14 words."
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        max_output_tokens: 220,
        reasoning: { effort: "minimal" },
        input: [
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
    const raw = extractTextFromOpenAi(data);
    const shout = sanitizeOneLine(removeBannedWords(removeKnownNames(raw)));
    if (!shout) {
      return res.status(500).json({
        error: "Model returned empty shout",
        details: JSON.stringify(data).slice(0, 500)
      });
    }
    return res.status(200).json({ shout });
  } catch (error) {
    return res.status(500).json({
      error: "Shout generation failed",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
