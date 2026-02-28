const DEFAULT_VOICE_ID = "YOq2y2Up4RgXP2HyXjE5";
const DEFAULT_MODEL_ID = "eleven_turbo_v2_5";
const ALLOWED_VOICE_KEYS = [
  "ELEVENLABS_VOICE_ID",
  "ELEVENLABS_VOICE_ID2",
  "ELEVENLABS_VOICE_ID3",
  "ELEVENLABS_VOICE_ID4",
  "ELEVENLABS_VOICE_ID5"
];

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = String(process.env.ELEVENLABS_API_KEY || "").trim();
  if (!apiKey) {
    return res.status(500).json({ error: "Missing ELEVENLABS_API_KEY" });
  }

  const body = parseBody(req);
  const rawText = typeof body.text === "string" ? body.text : "";
  const text = rawText.trim();
  const requestedVoiceKey = String(body.voiceKey || "").trim();

  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }

  if (text.length > 220) {
    return res.status(400).json({ error: "Text too long" });
  }

  const fallbackVoiceId = String(process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID).trim();
  const selectedVoiceKey = ALLOWED_VOICE_KEYS.includes(requestedVoiceKey)
    ? requestedVoiceKey
    : "ELEVENLABS_VOICE_ID";
  const selectedVoiceId = String(process.env[selectedVoiceKey] || "").trim();
  const voiceId = selectedVoiceId || fallbackVoiceId;
  const modelId = String(process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL_ID).trim();
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  try {
    const elevenResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
        "xi-api-key": apiKey
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.75,
          style: 0.35,
          use_speaker_boost: true
        }
      })
    });

    if (!elevenResponse.ok) {
      const errorText = await elevenResponse.text();
      return res.status(elevenResponse.status).json({
        error: "ElevenLabs request failed",
        details: errorText.slice(0, 500)
      });
    }

    const audioBuffer = Buffer.from(await elevenResponse.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(audioBuffer);
  } catch (error) {
    return res.status(500).json({
      error: "TTS proxy failed",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
