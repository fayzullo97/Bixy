Menu

## Overview [#](https://aisha.group/en/api-documentation/text-to-speech#overview)

1. 1 Send `transcript` to `POST /api/v1/tts/post/` to generate audio.
2. 2 Pass `webhook_notification_url` to run the request asynchronously and receive `202 Accepted`.
3. 3 Check the result through `GET /api/v1/tts/status/{id}/` or history.
4. 4 Use wss://back.aisha.group/api/v1/tts/realtime for realtime TTS over WebSocket or back.aisha.group:443 over gRPC.
5. 5 Send multiple text turns over one persistent connection; do not reconnect for every turn.
6. 6 TTS character billing is enforced after balance verification when the stream starts.

Prefer a CLI? The `aisha-ai` npm package wraps these endpoints: `npx aisha-ai tts` / `npx aisha-ai stt`. [aisha-ai on npm ↗](https://www.npmjs.com/package/aisha-ai)

## API Key [#](https://aisha.group/en/api-documentation/text-to-speech#authentication)

- ### API Key

 `X-Api-Key: <api_key>`

 Recommended for server-to-server integrations.

- ### Streaming auth

 `WebSocket: ?token=<api_key> | gRPC: x-api-key: <api_key>`

 WebSocket uses a query token and gRPC uses API-key metadata.

## Generate audio [#](https://aisha.group/en/api-documentation/text-to-speech#tts-generate)

POST `https://back.aisha.group/api/v1/tts/post/` Copy

Converts text to an audio file. The built-in `Gulnoza` model is used for `language=uz`. For `en` and `ru`, `model`, `mood`, and `speed` are not sent.

Authentication: Send `X-Api-Key`. Public requests may require reCAPTCHA.

- Limit: 1000 characters with API key, 500 characters for public requests.
- `speed` must be `0` or between `0.5-2.0`.
- `mood` is only for the built-in `Gulnoza` flow. When `voice_id` is used, `mood` is not sent.

### Request fields [#](https://aisha.group/en/api-documentation/text-to-speech#tts-generate-fields)

`transcript` required

string

Text to synthesize.

Example: `Assalomu alaykum`

`language`

string

Supported values: `uz`, `en`, `ru`. Default: `uz`.

Example: `uz`

`model`

string

Only for the built-in `uz` flow. There is currently one model: `Gulnoza`.

Example: `Gulnoza`

`mood`

string

Only for built-in `Gulnoza`. There are 4 moods: `Neutral`, `Cheerful`, `Happy`, `Sad`. Not sent for `voice_id`, `en`, or `ru` flows.

Example: `Neutral`

`speed`

float

Only for the `uz` flow. `0` uses the default speed. Custom range: `0.5-2.0`.

Example: `1.0`

`voice_id`

integer

READY custom voice ID owned by the user. If `voice_id` is used, `mood` is not sent.

Example: `12`

`webhook_notification_url`

string

Runs TTS asynchronously when provided.

Example: `https://example.com/webhooks/tts`

### Examples [#](https://aisha.group/en/api-documentation/text-to-speech#tts-generate-examples)

#### Sync request

Copy

```
curl --request POST \
  --url https://back.aisha.group/api/v1/tts/post/ \
  --header 'X-Api-Key: your_api_key' \
  --header 'Accept-Language: uz' \
  --form 'transcript=Assalomu alaykum, bu AIsha TTS sinovi.' \
  --form 'language=uz' \
  --form 'model=Gulnoza' \
  --form 'mood=Neutral' \
  --form 'speed=1.0'
```

#### Async request

Copy

```
curl --request POST \
  --url https://back.aisha.group/api/v1/tts/post/ \
  --header 'X-Api-Key: your_api_key' \
  --form 'transcript=Webhook orqali qaytadigan sinov matni.' \
  --form 'language=uz' \
  --form 'webhook_notification_url=https://example.com/webhooks/tts'
```

#### CLI (aisha-ai)

Copy

```
export AISHA_API_KEY=your_api_key
npx aisha-ai tts "Salom dunyo" --model Gulnoza --out salom.wav
```

### Responses [#](https://aisha.group/en/api-documentation/text-to-speech#tts-generate-responses)

201 Created

#### Sync success

Copy

```
{
  "audio_path": "/media/tts_audios/request-id.wav"
}
```

202 Accepted

#### Async queued

Copy

```
{
  "id": 184,
  "task_id": "7d5f8779-9cb0-4230-9318-2f8c3c3f0e31",
  "status": "PENDING"
}
```

### Status codes [#](https://aisha.group/en/api-documentation/text-to-speech#tts-generate-codes)

`201`

Audio is ready and \`audio\_path\` is returned.

`202`

Async task was queued.

`400`

Invalid transcript, language, model, or speed.

`401`

Custom voice requires authentication.

`402`

Insufficient balance.

`503`

TTS service is temporarily unavailable.

## Check status [#](https://aisha.group/en/api-documentation/text-to-speech#tts-status)

GET `https://back.aisha.group/api/v1/tts/status/{id}/` Copy

Returns the state of an async TTS task.

Authentication: Send `X-Api-Key`.

- Possible statuses: `PENDING`, `SUCCESS`, `FAILED`.

### Examples [#](https://aisha.group/en/api-documentation/text-to-speech#tts-status-examples)

#### Status request

Copy

```
curl --request GET \
  --url https://back.aisha.group/api/v1/tts/status/184/ \
  --header 'X-Api-Key: your_api_key'
```

### Responses [#](https://aisha.group/en/api-documentation/text-to-speech#tts-status-responses)

200 OK

#### Pending

Copy

```
{
  "id": 184,
  "status": "PENDING",
  "task_id": "7d5f8779-9cb0-4230-9318-2f8c3c3f0e31"
}
```

200 OK

#### Completed

Copy

```
{
  "id": 184,
  "status": "SUCCESS",
  "task_id": "7d5f8779-9cb0-4230-9318-2f8c3c3f0e31",
  "audio_path": "/media/tts_audios/request-id.wav",
  "characters": 42
}
```

### Status codes [#](https://aisha.group/en/api-documentation/text-to-speech#tts-status-codes)

`200`

Status returned.

`403`

No access to another user's record.

`404`

TTS record not found.

## History list [#](https://aisha.group/en/api-documentation/text-to-speech#tts-history)

GET `https://back.aisha.group/api/v1/tts/get/?page=1&limit=10` Copy

Returns the current user's TTS audio history with pagination.

Authentication: Requires `X-Api-Key`.

- Response format: `count`, `next`, `previous`, `results`.

### Examples [#](https://aisha.group/en/api-documentation/text-to-speech#tts-history-examples)

#### History request

Copy

```
curl --request GET \
  --url 'https://back.aisha.group/api/v1/tts/get/?page=1&limit=10' \
  --header 'X-Api-Key: your_api_key'
```

### Responses [#](https://aisha.group/en/api-documentation/text-to-speech#tts-history-responses)

200 OK

#### Paginated success

Copy

```
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 184,
      "transcript": "Assalomu alaykum, bu AIsha TTS sinovi.",
      "audio_url": "/media/tts_audios/request-id.wav",
      "model": "Gulnoza",
      "mood": "Neutral",
      "created_at": "2026-05-04T10:15:30Z"
    }
  ]
}
```

### Status codes [#](https://aisha.group/en/api-documentation/text-to-speech#tts-history-codes)

`200`

History returned.

`403`

API key is invalid or missing.

## Realtime WebSocket TTS [#](https://aisha.group/en/api-documentation/text-to-speech#tts-realtime-ws)

WS `wss://back.aisha.group/api/v1/tts/realtime?token=YOUR_API_KEY` Copy

Send multiple text turns over one persistent WebSocket connection. Each turn returns metadata followed by binary WAV bytes.

Authentication: Send the API key as the token query parameter. Balance and character pricing are checked when the session starts.

- Requests are JSON text messages with request\_id, speaker\_id, language, text, and speed.
- Built-in speakers: happy, cheerful, neutral, sad.
- Defaults: language=uz and speed=1.0.
- The response is a mono, 16-bit, 16 kHz WAV. The JSON metadata frame is followed by one binary audio frame.
- Send {"type":"end"} once to close the session. Keep the connection open for subsequent turns.

### Request fields [#](https://aisha.group/en/api-documentation/text-to-speech#tts-realtime-ws-fields)

`token` required

string

API key in the query string.

Example: `YOUR_API_KEY`

`speaker_id`

string

One of happy, cheerful, neutral, sad.

Example: `happy`

`language`

string

Default: uz.

Example: `uz`

`text` required

string

Text to synthesize.

Example: `Assalomu alaykum`

`speed`

float

Default: 1.0.

Example: `1.0`

### Examples [#](https://aisha.group/en/api-documentation/text-to-speech#tts-realtime-ws-examples)

#### Browser WebSocket

Copy

```
const token = 'your_api_key'
const ws = new WebSocket('wss://back.aisha.group/api/v1/tts/realtime?token=' + encodeURIComponent(token))

ws.onmessage = event => {
  if (typeof event.data === 'string') {
    const message = JSON.parse(event.data)
    if (message.type === 'audio') console.log(message.request_id, message.sample_rate, message.duration_sec)
    if (message.type === 'error') console.error(message.code, message.message)
    return
  }
  // Binary frame: complete 16 kHz mono WAV bytes.
  playWav(event.data)
}

ws.onopen = () => ws.send(JSON.stringify({
  request_id: 'turn-1',
  speaker_id: 'happy',
  language: 'uz',
  text: 'Assalomu alaykum, bu Aisha TTS sinovi.'
}))

// Reuse this connection for later turns, then close the session once.
function finishSession() {
  ws.send(JSON.stringify({ type: 'end' }))
}
```

#### Request JSON

Copy

```
{
  "request_id": "turn-1",
  "speaker_id": "happy",
  "language": "uz",
  "text": "Assalomu alaykum, bu Aisha TTS sinovi.",
  "speed": 1.0
}
```

### Responses [#](https://aisha.group/en/api-documentation/text-to-speech#tts-realtime-ws-responses)

message

#### Session started

Copy

```
{
  "type": "session_started",
  "session_id": "7ab6d67a-9a29-4ad9-90b7-d2f5b2fc08fb",
  "billing": "characters"
}
```

message + binary

#### Audio metadata + WAV bytes

Copy

```
{
  "type": "audio",
  "request_id": "turn-1",
  "speaker_id": "happy",
  "sample_rate": 16000,
  "duration_sec": 1.84,
  "characters": 42
}

// The next WebSocket frame is binary audio_wav bytes.
```

message

#### Balance error

Copy

```
{
  "type": "error",
  "code": "insufficient_balance",
  "message": "TTS character balance limit reached"
}
```

### Status codes [#](https://aisha.group/en/api-documentation/text-to-speech#tts-realtime-ws-codes)

`1000`

Session closed normally.

`1008`

API key or balance was rejected.

`synthesis_failed`

Text or speaker synthesis failed.

## Persistent gRPC TTS stream [#](https://aisha.group/en/api-documentation/text-to-speech#tts-grpc-stream)

gRPC `back.aisha.group:443/aisha.tts.RealtimeTTS/Synthesize` Copy

Send sequential text turns in one client-streaming request and receive one server-streaming audio response per turn.

Authentication: Send x-api-key: <api\_key> as gRPC metadata.

- TLS endpoint: back.aisha.group:443.
- Each SynthesizeRequest is one text turn. Send end=true to finish the stream.
- Reuse one gRPC channel for the complete voice-agent session; do not create a channel for every turn.
- Each response contains 16 kHz WAV audio\_wav, sample\_rate, duration\_sec, characters, and request\_id.
- TTS billing is based on characters after balance verification at stream start.

### Request fields [#](https://aisha.group/en/api-documentation/text-to-speech#tts-grpc-stream-fields)

`text` required

string

Text to synthesize.

Example: `Assalomu alaykum`

`speaker_id`

string

Built-in speaker ID.

Example: `neutral`

`language`

string

Default: uz.

Example: `uz`

`speed`

float

Default: 1.0.

Example: `1.0`

`end`

boolean

Finishes the persistent stream.

Example: `true`

### Examples [#](https://aisha.group/en/api-documentation/text-to-speech#tts-grpc-stream-examples)

#### Python persistent stream

Copy

```
import grpc
import tts_pb2
import tts_pb2_grpc

channel = grpc.secure_channel('back.aisha.group:443', grpc.ssl_channel_credentials())
client = tts_pb2_grpc.RealtimeTTSStub(channel)

def requests():
    yield tts_pb2.SynthesizeRequest(
        request_id='turn-1', speaker_id='happy', language='uz',
        text='Assalomu alaykum, bu Aisha TTS sinovi.'
    )
    yield tts_pb2.SynthesizeRequest(
        request_id='turn-2', speaker_id='neutral', language='uz',
        text='Keyingi turn shu channel ichida davom etadi.'
    )
    yield tts_pb2.SynthesizeRequest(end=True)

for response in client.Synthesize(requests(), metadata=(('x-api-key', 'your_api_key'),)):
    if response.error_code:
        raise RuntimeError(response.error_message)
    save_wav(response.audio_wav)

# Reuse channel and create another Synthesize stream for the next session.
channel.close()
```

### Responses [#](https://aisha.group/en/api-documentation/text-to-speech#tts-grpc-stream-responses)

OK

#### Synthesis response

Copy

```
{
  "request_id": "turn-1",
  "speaker_id": "happy",
  "sample_rate": 16000,
  "duration_sec": 1.84,
  "characters": 42,
  "audio_wav": "bytes"
}
```

stream response

#### Error

Copy

```
{
  "type": "error",
  "code": "insufficient_balance",
  "message": "TTS character balance limit reached"
}
```

### Status codes [#](https://aisha.group/en/api-documentation/text-to-speech#tts-grpc-stream-codes)

`OK`

Audio response returned.

`UNAUTHENTICATED`

API key metadata is missing or invalid.

`RESOURCE_EXHAUSTED`

TTS character balance is insufficient.