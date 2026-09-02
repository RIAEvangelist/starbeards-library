import {
    AI_BROWSER_SPEECH_CONFIGURATION_PROTOCOL,
    AI_READY_EVENT
} from 'arcane/AI';
import DBOPFS from 'arcane/DBOPFS';
import {arcaneEvents} from 'arcane-os/event-manager';
import SpeechPlayback from 'arcane-os/speech-playback';

export const JUJU_SPEECH_AUTHORITY_REQUIRED = 'ARCANE_AI_MODEL_AUTHORITY_REQUIRED';

const ARCANE_SDK_VERSION = '0.5.1';
const CONFIGURATION_ID = 'juju-grand-adventures-browser-speech';
const DEFAULT_SPEED = 0.95;

function createJuJuSpeechError(code, message, cause) {
    const error = cause === undefined
        ? new Error(message)
        : new Error(message, {cause});

    error.name = 'JuJuSpeechError';
    error.code = code;
    return error;
}

function requireSpeechAuthority(authority) {
    if (!authority) {
        throw createJuJuSpeechError(
            JUJU_SPEECH_AUTHORITY_REQUIRED,
            'JuJu read aloud needs a configured Kokoro runtime, model, and voice.'
        );
    }

    return authority;
}

function defaultSpeechStateObserver() {}

function readyCanonicalAI() {
    const ai = globalThis.ai;

    return ai?.ready === true ? ai : null;
}

function waitForCanonicalAI() {
    const readyAI = readyCanonicalAI();

    if (readyAI) {
        return Promise.resolve(readyAI);
    }

    return new Promise(
        function waitForCanonicalAIReady(resolve) {
            let unsubscribe = null;

            function resolveCanonicalAI() {
                const ai = readyCanonicalAI();

                if (!ai) {
                    return;
                }

                unsubscribe?.();
                resolve(ai);
            }

            unsubscribe = arcaneEvents.subscribe(
                AI_READY_EVENT,
                resolveCanonicalAI
            );
            resolveCanonicalAI();
        }
    );
}

export function createJuJuSpeech({
    authority = null,
    onState = defaultSpeechStateObserver
} = {}) {
    if (typeof onState !== 'function') {
        throw new TypeError('JuJu speech onState must be a function.');
    }

    let configurationPromise = null;
    let disposed = false;
    let generation = 0;
    let runtime = null;

    function assertActive() {
        if (disposed) {
            throw createJuJuSpeechError(
                'ARCANE_AI_PROVIDER_DISPOSED',
                'JuJu read aloud has been disposed.'
            );
        }
    }

    async function configureSpeechRuntime(selectedAuthority) {
        const dbopfs = new DBOPFS();
        const aiPromise = waitForCanonicalAI();

        await dbopfs.readyPromise;
        assertActive();

        const ai = await aiPromise;

        assertActive();

        const audio = document.createElement('audio');

        audio.dataset.jujuNarration = 'sdk';
        audio.hidden = true;
        audio.preload = 'none';
        document.body.append(audio);

        const playback = new SpeechPlayback(
            {
                audio,
                speech: ai,
                model: selectedAuthority.model.id,
                voice: selectedAuthority.defaultVoice,
                responseFormat: 'wav',
                speed: DEFAULT_SPEED,
                onState,
                messages: {
                    unavailable: 'Local read aloud is not ready.',
                    preparing: 'Preparing this page with Kokoro…',
                    queued: 'Waiting to prepare this page…',
                    ready: 'Narration is ready.',
                    playing: 'Reading this page.',
                    pausing: 'Turning to the next passage…',
                    buffering: 'Preparing the next passage…',
                    paused: 'Narration is paused.',
                    ended: 'Narration finished.',
                    stopped: 'Narration stopped.',
                    preparationStopped: 'Narration preparation stopped.',
                    autoplayBlocked: 'Narration is ready. Select Play narration to begin.',
                    playbackError: 'The prepared narration could not be played.',
                    fallbackError: 'Local read aloud stopped unexpectedly.'
                }
            }
        );

        const configuration = {
            protocol: AI_BROWSER_SPEECH_CONFIGURATION_PROTOCOL,
            id: CONFIGURATION_ID,
            dbopfs,
            tts: {
                providerId: selectedAuthority.providerId,
                model: selectedAuthority.model,
                runtime: selectedAuthority.runtime,
                offline: false
            }
        };

        try {
            await ai.configureBrowserSpeech(configuration);
            assertActive();
        } catch (error) {
            playback.destroy();
            audio.remove();

            if (
                ai.browserSpeechDescriptor?.configurationId
                === CONFIGURATION_ID
            ) {
                try {
                    await ai.disposeBrowserSpeech();
                } catch (cleanupError) {
                    throw createJuJuSpeechError(
                        'ARCANE_AI_BROWSER_SPEECH_CLEANUP_FAILED',
                        'JuJu read aloud could not cleanly release a failed browser-speech configuration.',
                        new AggregateError(
                            [error, cleanupError],
                            'Browser-speech setup and cleanup both failed.'
                        )
                    );
                }
            }

            throw error;
        }

        return {
            ai,
            audio,
            playback,
            authority: selectedAuthority
        };
    }

    async function initialize() {
        assertActive();

        if (!configurationPromise) {
            configurationPromise = Promise.resolve().then(
                async function configureAuthorizedBrowserSpeech() {
                    const selectedAuthority = requireSpeechAuthority(authority);

                    runtime = await configureSpeechRuntime(selectedAuthority);
                    return runtime.ai.browserSpeechDescriptor;
                }
            ).catch(
                function clearRejectedConfiguration(error) {
                    configurationPromise = null;
                    throw error;
                }
            );
        }

        return configurationPromise;
    }

    async function read({
        key,
        parts,
        voice,
        speed = DEFAULT_SPEED
    } = {}) {
        assertActive();

        const operationGeneration = generation + 1;

        generation = operationGeneration;
        await initialize();

        if (operationGeneration !== generation || disposed) {
            return {
                ready: false,
                played: false,
                cancelled: true
            };
        }

        const selectedVoice = String(voice || runtime.authority.defaultVoice);

        if (runtime.playback.hasAudio()) {
            const played = await runtime.playback.replay();

            return {
                ready: true,
                played,
                replayed: true
            };
        }

        await runtime.ai.setSpeechMuted(false);

        if (operationGeneration !== generation || disposed) {
            await runtime.ai.setSpeechMuted(true);
            return {
                ready: false,
                played: false,
                cancelled: true
            };
        }

        return runtime.playback.prepare(
            {
                key,
                parts,
                model: runtime.authority.model.id,
                voice: selectedVoice,
                responseFormat: 'wav',
                speed,
                autoplay: true
            }
        );
    }

    function stop() {
        generation += 1;

        if (!runtime) {
            return Promise.resolve(false);
        }

        runtime.playback.stop();

        const status = runtime.ai.providerRuntime.status('tts');

        if (status.state === 'loading') {
            return runtime.ai.setSpeechMuted(true);
        }

        return Promise.resolve(status);
    }

    async function dispose() {
        if (disposed) {
            return false;
        }

        disposed = true;
        generation += 1;

        if (!runtime) {
            return true;
        }

        runtime.playback.destroy();
        runtime.audio.remove();
        await runtime.ai.disposeBrowserSpeech();
        runtime = null;
        return true;
    }

    function inspect() {
        return {
            sdkVersion: ARCANE_SDK_VERSION,
            configured: Boolean(runtime?.ai.browserSpeechDescriptor?.tts),
            provider: runtime
                ? runtime.ai.providerRuntime.status('tts')
                : null,
            playback: runtime
                ? {
                    state: runtime.playback.state,
                    key: runtime.playback.key,
                    hasAudio: runtime.playback.hasAudio()
                }
                : null
        };
    }

    return {
        initialize,
        read,
        stop,
        dispose,
        inspect
    };
}
