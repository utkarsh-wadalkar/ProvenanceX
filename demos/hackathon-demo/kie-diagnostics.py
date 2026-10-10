"""Read existing task failures only; never submit or generate narration."""
import json
import os
from pathlib import Path
import re
import requests
from dotenv import load_dotenv

root = Path(__file__).resolve().parents[2]
load_dotenv(root / '.env')
key = os.environ['KIE_API_KEY']
tasks = [
 ('b618643afafd040dbff96ec8e2d5c156', 'elevenlabs/text-to-speech-turbo-2-5', 'EkK5I93UQWFDigLMpZcX', 'en'),
 ('13a83b97dfc7d2a5d4de9069b093528c', 'elevenlabs/text-to-speech-turbo-2-5', '21m00Tcm4TlvDq8ikWAM', 'en'),
 ('87c572ff0c6e1a5a51e6295a138dc643', 'elevenlabs/text-to-speech-multilingual-v2', '21m00Tcm4TlvDq8ikWAM', 'en'),
 ('e59c808ceec600e4eefd9a442e0bf9f1', 'elevenlabs/text-to-speech-turbo-2-5', 'Rachel', ''),
]
records = []
for task, model, voice, language in tasks:
    try:
        response = requests.get('https://api.kie.ai/api/v1/jobs/recordInfo', params={'taskId': task},
            headers={'Authorization': 'Bearer ' + key}, timeout=(10, 35))
        body = response.json()
        data = body.get('data', {})
        message = str(data.get('failMsg', '')).replace(key, '[REDACTED]')
        message = re.sub(r'https?://\S+', '[URL omitted]', message)
        records.append({'taskId': task, 'request': {'model': model, 'input': {
            'text': 'This is a narration test for the hackathon demo.', 'voice': voice,
            'stability': 0.5, 'similarity_boost': 0.75, 'style': 0, 'speed': 1,
            'timestamps': False, 'language_code': language}},
            'httpStatus': response.status_code, 'apiCode': body.get('code'),
            'state': data.get('state'), 'failCode': data.get('failCode'),
            'failMsg': message[:600], 'resultPresent': bool(data.get('resultJson'))})
    except requests.RequestException:
        records.append({'taskId': task, 'diagnosticRead': 'Connection failed; previously observed generation failure code 500.'})
log = {'date': '2026-10-10', 'provider': 'KIE only', 'endpoint': 'https://api.kie.ai/api/v1/jobs/createTask',
       'authentication': 'Bearer token loaded privately from project .env; deliberately omitted',
       'tasks': records,
       'additionalAttempt': {'voice': 'EkK5I93UQWFDigLMpZcX', 'language_code': '',
          'result': 'Connection timeout before a task ID was returned. Acceptance unknown; do not automatically resubmit.'}}
dest = Path(__file__).with_name('kie-errors.json')
dest.write_text(json.dumps(log, indent=2), encoding='utf-8')
for row in records:
    print(row['taskId'], row.get('state'), row.get('failCode'), row.get('failMsg', row.get('diagnosticRead')))
print('Sanitized log saved:', dest)
