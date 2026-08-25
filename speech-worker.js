import {
    KokoroTTS
} from 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js';

const KOKORO_MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const DEFAULT_VOICE = 'af_heart';
const SUPPORTED_VOICES = new Set(
    [
        'af_heart',
        'af_bella',
        'af_nicole',
        'af_nova',
        'am_fenrir',
        'am_michael',
        'bf_emma',
        'bm_fable'
    ]
);

let synthesizer = null;
let kokoroLoadPromise = null;
let requestQueue = Promise.resolve();

function describeError(error) {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return String(error || 'Kokoro narration failed.');
}

function postStatus(text) {
    self.postMessage(
        {
            kind: 'status',
            text,
            ready: synthesizer !== null,
            loading: kokoroLoadPromise !== null
        }
    );
}

async function ensureKokoro() {
    if (synthesizer) {
        return synthesizer;
    }

    if (kokoroLoadPromise) {
        return kokoroLoadPromise;
    }

    kokoroLoadPromise = KokoroTTS.from_pretrained(
        KOKORO_MODEL,
        {
            device: 'wasm',
            dtype: 'q8'
        }
    );
    postStatus('Downloading the Kokoro voice model for local narration…');

    try {
        synthesizer = await kokoroLoadPromise;
        return synthesizer;
    } catch (error) {
        throw new Error('Kokoro could not load: ' + describeError(error));
    } finally {
        kokoroLoadPromise = null;
        postStatus(
            synthesizer
                ? 'Kokoro is ready.'
                : 'Kokoro could not be prepared.'
        );
    }
}

function copyTransferableSamples(sourceSamples) {
    const samples = sourceSamples instanceof Float32Array
        ? sourceSamples
        : new Float32Array(sourceSamples);

    if (
        samples.buffer instanceof ArrayBuffer
        && samples.byteOffset === 0
        && samples.byteLength === samples.buffer.byteLength
    ) {
        return samples;
    }

    const transferableSamples = new Float32Array(samples.length);

    transferableSamples.set(samples);

    return transferableSamples;
}

async function synthesizePage(payload) {
    const text = String(payload.text || '').trim();
    const requestedVoice = String(payload.voice || DEFAULT_VOICE);
    const voice = SUPPORTED_VOICES.has(requestedVoice)
        ? requestedVoice
        : DEFAULT_VOICE;
    const requestedSpeed = Number(payload.speed);
    const speed = Number.isFinite(requestedSpeed)
        ? Math.max(0.5, Math.min(requestedSpeed, 2))
        : 0.95;

    if (!text) {
        throw new Error('No page text was supplied to Kokoro.');
    }

    const kokoro = await ensureKokoro();

    postStatus('Kokoro is preparing this page…');

    const audio = await kokoro.generate(
        text,
        {
            voice,
            speed
        }
    );
    const samples = copyTransferableSamples(audio.audio);

    return {
        samples,
        sampleRate: audio.sampling_rate
    };
}

async function handleRequest(message) {
    if (
        !message
        || message.kind !== 'request'
        || message.action !== 'synthesize'
    ) {
        return;
    }

    try {
        const result = await synthesizePage(message.payload || {});

        self.postMessage(
            {
                kind: 'response',
                id: message.id,
                ok: true,
                result
            },
            [result.samples.buffer]
        );
        postStatus('Kokoro is ready.');
    } catch (error) {
        self.postMessage(
            {
                kind: 'response',
                id: message.id,
                ok: false,
                error: describeError(error)
            }
        );
    }
}

function handleMessage(event) {
    const message = event.data;

    requestQueue = requestQueue.then(
        function processQueuedRequest() {
            return handleRequest(message);
        }
    );
    requestQueue = requestQueue.catch(
        function recoverRequestQueue(error) {
            postStatus('Kokoro stopped unexpectedly: ' + describeError(error));
        }
    );
}

self.addEventListener('message', handleMessage);
