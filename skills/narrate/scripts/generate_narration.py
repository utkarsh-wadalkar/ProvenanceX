#!/usr/bin/env python3
"""KIE provider adapter. Produces the MP3 consumed by demo-studio unchanged."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from urllib.parse import urlencode, urlparse
import requests
from dotenv import load_dotenv

API = "https://api.kie.ai/api/v1/jobs"
MODEL = "elevenlabs/text-to-speech-turbo-2-5"
DEFAULT_VOICE = "Rachel"


class NarrationError(RuntimeError):
    pass


def api_request(session, method, endpoint, key, deadline, payload=None):
    """Retry reads and explicit rate-limit rejections; never duplicate ambiguous POSTs."""
    for attempt in range(4):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise NarrationError("KIE task timed out; use --task-id to resume without paying again.")
        try:
            response = session.request(method, API + endpoint,
                headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
                json=payload, timeout=(min(10, remaining), min(35, remaining)))
            retry = response.status_code == 429 or (method == "GET" and response.status_code >= 500)
            if retry and attempt < 3:
                time.sleep(min(2 ** attempt, max(0, deadline - time.monotonic())))
                continue
            if not response.ok:
                raise NarrationError(f"KIE HTTP {response.status_code}; check access, credit balance or service status.")
            body = response.json()
            code = body.get("code")
            if code == 429 and attempt < 3:
                time.sleep(min(2 ** attempt, max(0, deadline - time.monotonic())))
                continue
            if code != 200:
                raise NarrationError(f"KIE rejected the request (code {code}); check access, balance and model input.")
            if not isinstance(body.get("data"), dict):
                raise NarrationError("KIE returned an invalid data object.")
            return body["data"]
        except (requests.Timeout, requests.ConnectionError):
            if method == "GET" and attempt < 3:
                time.sleep(min(2 ** attempt, max(0, deadline - time.monotonic())))
                continue
            raise NarrationError("KIE connection failed. A submitted task may still exist; check KIE logs before resubmitting.") from None
        except (ValueError, requests.RequestException):
            raise NarrationError("KIE returned an unreadable response or failed to connect.") from None
    raise NarrationError("KIE retry limit reached.")


def audio_url(data):
    try:
        result = data["resultJson"]
        result = json.loads(result) if isinstance(result, str) else result
        url = result["resultUrls"][0]
        parsed = urlparse(url)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError()
        return url
    except (KeyError, IndexError, TypeError, ValueError):
        raise NarrationError("Successful KIE task did not contain a valid HTTPS audio URL.") from None


def validate_audio(path):
    try:
        result = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
            "format=duration:stream=codec_type,codec_name", "-of", "json", str(path)],
            capture_output=True, text=True, timeout=30, check=True)
        info = json.loads(result.stdout)
        duration = float(info["format"]["duration"])
        if duration <= 0 or not any(s.get("codec_type") == "audio" and s.get("codec_name") == "mp3" for s in info["streams"]):
            raise ValueError()
        return duration
    except (OSError, subprocess.SubprocessError, KeyError, ValueError):
        raise NarrationError("Downloaded file is not a readable MP3 with non-zero duration; check ffprobe installation.") from None


def download_audio(url, target, deadline):
    temp = target.with_suffix(".download.mp3")
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        # Deliberately use a separate session: never send KIE authentication to the CDN.
        for attempt in range(3):
            try:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise NarrationError("Audio download timed out.")
                with requests.get(url, stream=True, timeout=(min(10, remaining), min(40, remaining))) as response:
                    if not response.ok:
                        raise NarrationError(f"Audio download returned HTTP {response.status_code}.")
                    size = 0
                    with temp.open("wb") as output:
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
        duration = validate_audio(temp)
        temp.replace(target)
        return duration
    finally:
        temp.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", required=True)
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--text")
    source.add_argument("--text-file")
    parser.add_argument("--voice", default=DEFAULT_VOICE, help="KIE-supported voice name (for example Rachel) or voice ID")
    parser.add_argument("--model", default=MODEL, choices=[MODEL, "elevenlabs/text-to-speech-multilingual-v2"])
    parser.add_argument("--speed", type=float, default=1.0)
    parser.add_argument("--timeout", type=float, default=600)
    parser.add_argument("--task-id", help="Resume an existing task without a second paid submission")
    args = parser.parse_args()
    if not 0.7 <= args.speed <= 1.2 or args.timeout <= 0:
        parser.error("speed must be 0.7–1.2 and timeout must be positive")
    target = Path(args.out).resolve()
    if target.exists():
        print(f"Reusing validated audio ({validate_audio(target):.2f}s): {target}")
        return
    load_dotenv(Path(__file__).resolve().parents[3] / ".env", override=False)
    key = os.environ.get("KIE_API_KEY", "").strip()
    if not key:
        raise NarrationError("KIE_API_KEY is missing from the environment or project .env.")
    text = Path(args.text_file).read_text(encoding="utf-8-sig") if args.text_file else args.text
    if not args.task_id and not (text and text.strip()):
        parser.error("provide --text or --text-file")
    deadline = time.monotonic() + args.timeout
    receipt = target.with_suffix(".task.json")
    session = requests.Session()
    task_id = args.task_id
    if not task_id and receipt.exists():
        cached = json.loads(receipt.read_text(encoding="utf-8"))
        import hashlib
        if cached.get("textSha256") == hashlib.sha256(text.encode()).hexdigest() and cached.get("voice") == args.voice and cached.get("speed") == args.speed and cached.get("model") == args.model:
            task_id = cached["taskId"]
    if not task_id:
        data = api_request(session, "POST", "/createTask", key, deadline, {
            "model": args.model, "input": {"text": text.strip(), "voice": args.voice,
            "stability": 0.5, "similarity_boost": 0.75, "style": 0,
            "speed": args.speed, "timestamps": False, "previous_text": "", "next_text": "", "language_code": ""}})
        task_id = data.get("taskId")
        if not isinstance(task_id, str) or not task_id:
            raise NarrationError("KIE did not return a task ID.")
        import hashlib
        receipt.parent.mkdir(parents=True, exist_ok=True)
        receipt.write_text(json.dumps({"taskId": task_id, "model": args.model, "voice": args.voice,
            "speed": args.speed, "textSha256": hashlib.sha256(text.encode()).hexdigest()}, indent=2), encoding="utf-8")
    print(f"Polling KIE task {task_id}; no direct ElevenLabs call.")
    interval = 2
    while time.monotonic() < deadline:
        data = api_request(session, "GET", "/recordInfo?" + urlencode({"taskId": task_id}), key, deadline)
        state = data.get("state")
        if state == "success":
            duration = download_audio(audio_url(data), target, deadline)
            print(f"Saved MP3 ({duration:.2f}s): {target}")
            return
        if state == "fail":
            # Provider response bodies may contain secrets or URLs; do not dump them.
            raise NarrationError(f"KIE task failed (failure code {data.get('failCode', 'unknown')}); inspect KIE logs for this task.")
        if state not in ("waiting", "queuing", "generating"):
            raise NarrationError(f"KIE returned an unsupported task state: {state!r}.")
        time.sleep(min(interval, max(0, deadline - time.monotonic())))
        interval = min(8, interval * 1.3)
    raise NarrationError(f"KIE task {task_id} timed out; rerun to resume the saved task.")


if __name__ == "__main__":
    try:
        main()
    except (NarrationError, OSError, ValueError) as error:
        print(f"Narration error: {error}", file=sys.stderr)
        sys.exit(1)
