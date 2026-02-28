# 100x100

## ElevenLabs live voice setup

Set these environment variables in Vercel project settings:

- `ELEVENLABS_API_KEY` (required)
- `ELEVENLABS_VOICE_ID` (optional, defaults to `YOq2y2Up4RgXP2HyXjE5`)
- `ELEVENLABS_VOICE_ID2` (optional)
- `ELEVENLABS_VOICE_ID3` (optional)
- `ELEVENLABS_VOICE_ID4` (optional)
- `ELEVENLABS_VOICE_ID5` (optional)
- `ELEVENLABS_MODEL_ID` (optional, defaults to `eleven_turbo_v2_5`)

The app sends shout-out text to `/api/tts`, and this endpoint securely calls ElevenLabs and returns playable audio.
You can switch between configured voices in the app UI.