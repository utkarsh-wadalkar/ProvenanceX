#!/usr/bin/env python3
"""KIE Gemini 3.8 Flash Lite TTS adapter. Produces the MP3 consumed by demo-studio."""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlencode, urlparse

import requests
from dotenv import load_dotenv

API = "https://api.kie.ai/api/v1/jobs"
MODEL = "google/gemini-3-8-flash-lite-tts"
DEFAULT_VOICE = "Kira"
DEFAULT_TEMPERATURE = 0.85
DEFAULT_STYLE = (
    "Clear, confident technical presenter. Conversational and slightly energetic. "
    "Natural English. Not dramatic, not robotic, not like an advertisement."
)
HTTP_ERRORS = {
    400: "invalid parameters",
    401: "authentication failed",
    402: "insufficient KIE balance",
    404: "resource not found",
    422: "validation error",
    429: "rate limit",
    500: "KIE internal error",
}


class NarrationError(RuntimeError):
    def __init__(self, message, diagnostic=None):
        super().__init__(message)
        self.diagnostic = diagnostic or {}


def sanitize(value):
    text = "" if value is None else str(value)
    text = re.sub(r"(?i)(bearer\s+)[^\s]+", r"\1[REDACTED]", text)
    return re.sub(r"https?://\S+", "[URL omitted]", text)[:800]


def load_key():
    load_dotenv(Path(__file__).resolve().parents[3] / ".env", override=False)
    load_dotenv(Path.cwd() / ".env", override=False)
    key = os.environ.get("KIE_API_KEY", "").strip()
    if not key:
        raise NarrationError("KIE_API_KEY is missing from the environment or project .env.")
    return key


def kie_failure(status=None, code=None, message="KIE request failed."):
    if code == 402 or status == 402:
        return NarrationError("KIE account has insufficient balance (402). Stop and add credits before retrying.")
    label = HTTP_ERRORS.get(code) or HTTP_ERRORS.get(status)
    detail = f"KIE {label}" if label else message
    if code is not None:
        detail += f" (code {code})"
    elif status is not None:
        detail += f" (HTTP {status})"
    return NarrationError(detail)


def api_request(session, method, endpoint, key, deadline, payload=None, diagnostic=None):
    """Retry GET/429/network failures. Never duplicate an ambiguous POST."""
    for attempt in range(4):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise NarrationError("KIE task timed out; use --task-id to resume without paying again.", diagnostic)
        try:
            response = session.request(
                method,
                API + endpoint,
                headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
                json=payload,
                timeout=(min(10, remaining), min(35, remaining)),
            )
            if diagnostic is not None:
                diagnostic["httpStatus"] = response.status_code
            if response.status_code == 402:
                raise kie_failure(status=402)
            retry = response.status_code == 429 or (method == "GET" and response.status_code >= 500)
            if retry and attempt < 3:
                time.sleep(min(2 ** (attempt + 1), max(0, deadline - time.monotonic())))
                continue
            if not response.ok:
                raise kie_failure(status=response.status_code)
            body = response.json()
            code = body.get("code")
            if diagnostic is not None:
                diagnostic["apiCode"] = code
            if code == 402:
                raise kie_failure(code=402)
            if code == 429 and attempt < 3:
                time.sleep(min(2 ** (attempt + 1), max(0, deadline - time.monotonic())))
                continue
            if code != 200:
                raise kie_failure(code=code, message=sanitize(body.get("msg", "KIE rejected the request.")))
            if not isinstance(body.get("data"), dict):
                raise NarrationError("KIE returned an invalid data object.", diagnostic)
            return body["data"]
        except NarrationError:
            raise
        except (requests.Timeout, requests.ConnectionError):
            if attempt < 3:
                time.sleep(min(2 ** attempt, max(0, deadline - time.monotonic())))
                continue
            raise NarrationError(
                "KIE connection failed. A submitted task may still exist; resume with --task-id before creating another.",
                diagnostic,
            ) from None
        except (ValueError, requests.RequestException):
            raise NarrationError("KIE returned an unreadable response or failed to connect.", diagnostic) from None
    raise NarrationError("KIE retry limit reached.", diagnostic)


def audio_url(data):
    try:
        result = data["resultJson"]
        result = json.loads(result) if isinstance(result, str) else result
        if not isinstance(result, dict):
            raise ValueError()
        url = result["resultUrls"][0]
        parsed = urlparse(url)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError()
        return url
    except (KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError):
        raise NarrationError("Successful KIE task did not contain a valid HTTPS audio URL in resultJson.") from None


def probe(path):
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,codec_long_name",
         "-of", "json", str(path)],
        capture_output=True, text=True, timeout=30, check=True,
    )
    info = json.loads(result.stdout)
    duration = float(info["format"]["duration"])
    streams = [s for s in info.get("streams", []) if s.get("codec_type") == "audio"]
    codec = (streams[0].get("codec_name") if streams else "") or ""
    return duration, codec.lower()


def validate_mp3(path):
    try:
        duration, codec = probe(path)
        if duration <= 0 or codec != "mp3":
            raise ValueError()
        return duration
    except (OSError, subprocess.SubprocessError, KeyError, ValueError, json.JSONDecodeError):
        raise NarrationError("Output is not a readable MP3 with duration greater than 0 seconds.") from None


def convert_to_mp3(source, target):
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(source), "-vn", "-codec:a", "libmp3lame", "-b:a", "192k", str(target)],
        capture_output=True, text=True, timeout=120, check=True,
    )


def download_audio(url, target, deadline):
    raw = target.with_suffix(".download.bin")
    converted = target.with_suffix(".convert.mp3")
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        for attempt in range(3):
            try:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise NarrationError("Audio download timed out.")
                with requests.get(url, stream=True, timeout=(min(10, remaining), min(40, remaining))) as response:
                    if not response.ok:
                        raise NarrationError(f"Audio download returned HTTP {response.status_code}.")
                    size = 0
                    with raw.open("wb") as output:
                        for chunk in response.iter_content(65536):
                            size += len(chunk)
                            if size > 50 * 1024 * 1024 or time.monotonic() > deadline:
                                raise NarrationError("Audio download exceeded the size or time limit.")
                            output.write(chunk)
                break
            except (requests.Timeout, requests.ConnectionError):
                if attempt == 2:
                    raise NarrationError("Audio download failed after three attempts.") from None
                time.sleep(2 ** attempt)
            except requests.RequestException:
                raise NarrationError("Audio download failed.") from None
        duration, codec = probe(raw)
        if duration <= 0:
            raise NarrationError("Downloaded audio has zero duration.")
        if codec == "mp3":
            raw.replace(target)
        else:
            convert_to_mp3(raw, converted)
            converted.replace(target)
        return validate_mp3(target)
    except subprocess.CalledProcessError:
        raise NarrationError("ffmpeg/ffprobe could not inspect or convert the downloaded audio.") from None
    finally:
        raw.unlink(missing_ok=True)
        converted.unlink(missing_ok=True)


def fingerprint(text, voice, temperature):
    payload = f"{MODEL}\n{voice}\n{temperature}\n{text}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def write_diagnostic(path, payload):
    if not path:
        return
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    safe = json.loads(json.dumps(payload))
    path.write_text(json.dumps(safe, indent=2), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", required=True)
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--text")
    source.add_argument("--text-file")
    parser.add_argument("--voice", default=DEFAULT_VOICE, help="KIE Gemini preset voice_name, for example Kira")
    parser.add_argument("--temperature", type=float, default=DEFAULT_TEMPERATURE)
    parser.add_argument("--timeout", type=float, default=600)
    parser.add_argument("--task-id", help="Resume an existing task without a second paid submission")
    parser.add_argument("--force", action="store_true", help="Regenerate even if a matching MP3 already exists")
    parser.add_argument("--diagnostics", help="Write a sanitized failure log to this JSON path")
    args = parser.parse_args()
    if not 0 <= args.temperature <= 2 or args.timeout <= 0:
        parser.error("temperature must be 0–2 and timeout must be positive")
    target = Path(args.out).resolve()
    diagnostic = {
        "model": MODEL,
        "payload": None,
        "httpStatus": None,
        "apiCode": None,
        "taskId": args.task_id,
        "taskState": None,
        "failCode": None,
        "failMsg": None,
    }
    try:
        text = Path(args.text_file).read_text(encoding="utf-8-sig") if args.text_file else args.text
        if not args.task_id and not (text and text.strip()):
            parser.error("provide --text or --text-file")
        text = (text or "").strip()
        receipt = target.with_suffix(".task.json")
        digest = fingerprint(text, args.voice, args.temperature) if text else None
        if not args.force and not args.task_id and target.exists() and receipt.exists():
            cached = json.loads(receipt.read_text(encoding="utf-8"))
            if cached.get("fingerprint") == digest and cached.get("model") == MODEL:
                duration = validate_mp3(target)
                print(f"Reusing validated audio ({duration:.2f}s): {target}")
                return
        key = load_key()
        deadline = time.monotonic() + args.timeout
        session = requests.Session()
        task_id = args.task_id
        if not task_id and receipt.exists() and digest:
            cached = json.loads(receipt.read_text(encoding="utf-8"))
            if cached.get("fingerprint") == digest and cached.get("model") == MODEL and cached.get("taskId"):
                task_id = cached["taskId"]
                print(f"Resuming saved KIE task {task_id}; no second createTask.")
        payload = {
            "model": MODEL,
            "input": {
                "speakers": [{"speaker_id": "Speaker 1", "voice_name": args.voice}],
                "dialogue_turns": [{
                    "speaker_id": "Speaker 1",
                    "text": text,
                    "style": DEFAULT_STYLE,
                }],
                "filler_words": False,
                "temperature": args.temperature,
            },
        }
        diagnostic["payload"] = payload
        if not task_id:
            data = api_request(session, "POST", "/createTask", key, deadline, payload, diagnostic)
            task_id = data.get("taskId")
            if not isinstance(task_id, str) or not task_id:
                raise NarrationError("KIE did not return a task ID.", diagnostic)
            receipt.parent.mkdir(parents=True, exist_ok=True)
            receipt.write_text(json.dumps({
                "taskId": task_id,
                "model": MODEL,
                "voice": args.voice,
                "temperature": args.temperature,
                "fingerprint": digest,
            }, indent=2), encoding="utf-8")
        diagnostic["taskId"] = task_id
        print(f"Polling KIE Gemini TTS task {task_id}.")
        while time.monotonic() < deadline:
            data = api_request(session, "GET", "/recordInfo?" + urlencode({"taskId": task_id}), key, deadline, diagnostic=diagnostic)
            state = data.get("state")
            diagnostic["taskState"] = state
            if state == "success":
                duration = download_audio(audio_url(data), target, deadline)
                print(f"Saved MP3 ({duration:.2f}s): {target}")
                print(f"KIE model: {MODEL}")
                return
            if state == "fail":
                diagnostic["failCode"] = data.get("failCode")
                diagnostic["failMsg"] = sanitize(data.get("failMsg"))
                raise NarrationError(
                    f"KIE task {task_id} failed (failCode={data.get('failCode')}; failMsg={sanitize(data.get('failMsg'))}).",
                    diagnostic,
                )
            if state not in ("waiting", "queuing", "generating"):
                raise NarrationError(f"KIE returned an unsupported task state: {state!r}.", diagnostic)
            time.sleep(min(4, max(0, deadline - time.monotonic())))
        raise NarrationError(f"KIE task {task_id} timed out; rerun with --task-id {task_id} to resume.", diagnostic)
    except NarrationError as error:
        details = {**diagnostic, **(error.diagnostic or {})}
        write_diagnostic(args.diagnostics, details)
        raise


if __name__ == "__main__":
    try:
        main()
    except (NarrationError, OSError, ValueError) as error:
        print(f"Narration error: {error}", file=sys.stderr)
        sys.exit(1)
