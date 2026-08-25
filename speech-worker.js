import {
    KokoroTTS
} from 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js';

const KOKORO_MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const DEFAULT_VOICE = 'af_heart';
const MAX_CHUNK_COUNT = 96;
const MAX_CHUNK_CHARACTERS = 320;
const MAX_SEQUENCE_CHARACTERS = 100000;
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

function postStatus(text, requestId = 0, current = 0, total = 0) {
    self.postMessage(
        {
            current,
            id: requestId,
            kind: 'status',
            text,
            total,
            ready: synthesizer !== null,
            loading: kokoroLoadPromise !== null
        }
    );
}

async function ensureKokoro(requestId) {
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
    postStatus(
        'Downloading the Kokoro voice model for local narration…',
        requestId
    );

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
                : 'Kokoro could not be prepared.',
            requestId
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

function normalizeNarrationChunks(payload) {
    const requestedChunks = payload.chunks;

    if (!Array.isArray(requestedChunks) || requestedChunks.length === 0) {
        throw new Error('No page chunks were supplied to Kokoro.');
    }

    if (requestedChunks.length > MAX_CHUNK_COUNT) {
        throw new Error('This page has too many narration chunks.');
    }

    const chunks = [];
    let totalCharacters = 0;

    for (let index = 0; index < requestedChunks.length; index += 1) {
        const text = String(requestedChunks[index] || '').trim();

        if (!text) {
            throw new Error('Kokoro received an empty narration chunk.');
        }

        if (text.length > MAX_CHUNK_CHARACTERS) {
            throw new Error('A narration chunk is too long for Kokoro.');
        }

        totalCharacters += text.length;

        if (totalCharacters > MAX_SEQUENCE_CHARACTERS) {
            throw new Error('This page is too long for local narration.');
        }

        chunks.push(text);
    }

    return chunks;
}

async function synthesizeSequence(payload, requestId) {
    const chunks = normalizeNarrationChunks(payload);
    const requestedVoice = String(payload.voice || DEFAULT_VOICE);
    const voice = SUPPORTED_VOICES.has(requestedVoice)
        ? requestedVoice
        : DEFAULT_VOICE;
    const requestedSpeed = Number(payload.speed);
    const speed = Number.isFinite(requestedSpeed)
        ? Math.max(0.5, Math.min(requestedSpeed, 2))
        : 0.95;
    const kokoro = await ensureKokoro(requestId);

    for (let index = 0; index < chunks.length; index += 1) {
        postStatus(
            'Kokoro is preparing part '
                + (index + 1)
                + ' of '
                + chunks.length
                + '…',
            requestId,
            index + 1,
            chunks.length
        );

        const audio = await kokoro.generate(
            chunks[index],
            {
                voice,
                speed
            }
        );
        const samples = copyTransferableSamples(audio.audio);

        if (
            samples.length === 0
            || !Number.isFinite(audio.sampling_rate)
            || audio.sampling_rate <= 0
        ) {
            throw new Error('Kokoro generated invalid audio for this page.');
        }

        self.postMessage(
            {
                id: requestId,
                index,
                kind: 'chunk',
                result: {
                    samples,
                    sampleRate: audio.sampling_rate
                },
                total: chunks.length
            },
            [samples.buffer]
        );
    }

    return {
        chunkCount: chunks.length
    };
}

async function handleRequest(message) {
    if (
        !message
        || message.kind !== 'request'
        || message.action !== 'synthesize-sequence'
    ) {
        return;
    }

    try {
        const result = await synthesizeSequence(
            message.payload || {},
            message.id
        );

        self.postMessage(
            {
                kind: 'response',
                id: message.id,
                ok: true,
                result
            }
        );
        postStatus('Kokoro is ready.', message.id);
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
