from __future__ import annotations

import base64

import httpx

from .config import Settings


def detect_audio_mime(filename: str | None, content_type: str | None, data: bytes) -> str:
    name = (filename or "").lower()
    if name.endswith(".wav") or data[:4] == b"RIFF":
        return "audio/wav"
    if name.endswith(".mp3") or data[:3] == b"ID3":
        return "audio/mpeg"
    if name.endswith(".m4a") or data[4:8] == b"ftyp":
        return "audio/m4a"
    return content_type or "audio/m4a"


async def transcribe_audio(settings: Settings, filename: str | None, content_type: str | None, data: bytes) -> str:
    if not settings.dashscope_api_key:
        raise RuntimeError("DASHSCOPE_API_KEY is not configured")

    mime_type = detect_audio_mime(filename, content_type, data)
    data_url = f"data:{mime_type};base64,{base64.b64encode(data).decode('ascii')}"
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            f"{settings.dashscope_base_url.rstrip('/')}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.dashscope_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.dashscope_asr_model,
                "messages": [
                    {
                        "role": "user",
                        "content": [{"type": "input_audio", "input_audio": {"data": data_url}}],
                    }
                ],
                "stream": False,
                "asr_options": {"language": "zh", "enable_itn": True},
            },
        )
    payload = response.json()
    if response.status_code >= 400:
        raise RuntimeError(payload.get("error", {}).get("message") or payload.get("error") or "DashScope ASR request failed")
    return str(payload.get("choices", [{}])[0].get("message", {}).get("content", "")).strip()

