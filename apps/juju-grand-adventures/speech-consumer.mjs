import DBOPFS from 'arcane/DBOPFS';
import {arcaneEvents} from 'arcane-os/event-manager';

export const JUJU_SPEECH_AUTHORITY_REQUIRED = 'ARCANE_AI_MODEL_AUTHORITY_REQUIRED';

const ARCANE_SDK_VERSION = '0.5.17';
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

function waitForCanonicalAI(aiReadyEvent) {
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
                aiReadyEvent,
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
    let pendingStop = Promise.resolve(false);

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

        await dbopfs.readyPromise;
        assertActive();

        const {default: UserEntity} = await import('arcane/entities/User');
        const user = new UserEntity();

        await user.load();
        assertActive();

        const savedTuple = user.preferredModels;

        // Complete the saved-provider upgrade before AI can hydrate this user.
        if (savedTuple[0] === 'OPENAI' || savedTuple[3] === 'OPENAI') {
            const migratedTuple = savedTuple.map(
                function migrateProviderOrDefault(value, slot) {
                    return (slot === 0 || slot === 3) && value === 'OPENAI'
                        ? 'TWIN'
                        : value;
                }
            );

            await user.updateExplicit({preferredModels: migratedTuple});
        }

        assertActive();

        const {
            AI_BROWSER_SPEECH_CONFIGURATION_PROTOCOL,
            AI_READY_EVENT
        } = await import('arcane/AI');
        const ai = await waitForCanonicalAI(AI_READY_EVENT);

        assertActive();

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
            ai.configureTTSSegmentation(
                {
                    punctuation: 'any',
                    wordCadence: null
                }
            );
        } catch (error) {
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
        passages,
        voice,
        speed = DEFAULT_SPEED
    } = {}) {
        assertActive();

        const operationGeneration = generation + 1;

        generation = operationGeneration;
        await initialize();
        await pendingStop;

        if (operationGeneration !== generation || disposed) {
            return false;
        }

        const selectedVoice = String(voice || runtime.authority.defaultVoice);

        await runtime.ai.setSpeechMuted(false);

        if (operationGeneration !== generation || disposed) {
            return false;
        }

        const stopObservingFailures = arcaneEvents.subscribe(
            'ai-tts-failure',
            function reportNarrationFailure(event) {
                if (operationGeneration === generation && !disposed) {
                    onState(
                        {
                            state: 'error',
                            error: event.detail.error
                        }
                    );
                }
            }
        );

        try {
            // The SDK owns segmentation, provider backpressure and ordered audio.
            // Submit the whole page before awaiting any passage's completion.
            const completions = passages.map(
                function queueJuJuPassage(passage) {
                    return runtime.ai.streamTTS(
                        passage.text,
                        true,
                        {
                            voice: selectedVoice,
                            speed,
                            pauseAfterMs: passage.pauseMs,
                            waitForPlayback: true
                        }
                    );
                }
            );
            const playbackCompletion = Promise.all(completions);

            onState(
                {
                    state: 'queued'
                }
            );
            resume().catch(
                function reportNarrationResumeFailure(error) {
                    if (operationGeneration === generation && !disposed) {
                        onState(
                            {
                                state: 'error',
                                error
                            }
                        );
                    }
                }
            );

            const results = await playbackCompletion;

            return operationGeneration === generation
                && !disposed
                && results.every(Boolean);
        } catch (error) {
            if (operationGeneration === generation && !disposed) {
                runtime.ai.stopAudio();
            }

            throw error;
        } finally {
            stopObservingFailures();

            if (operationGeneration === generation) {
                generation += 1;
            }
        }
    }

    async function resume() {
        assertActive();

        if (!runtime) {
            return false;
        }

        const operationGeneration = generation;
        const resumed = await runtime.ai.resumeAudio();

        if (operationGeneration !== generation || disposed) {
            return false;
        }

        if (!resumed) {
            onState(
                {
                    state: 'waiting-for-gesture'
                }
            );
        }

        return resumed;
    }

    function stop() {
        generation += 1;

        if (!runtime) {
            return Promise.resolve(false);
        }

        runtime.ai.stopAudio();

        const status = runtime.ai.providerRuntime.status('tts');

        if (status.state === 'loading') {
            const stopOperation = runtime.ai.setSpeechMuted(true);

            pendingStop = stopOperation;

            function clearSettledStop() {
                if (pendingStop === stopOperation) {
                    pendingStop = Promise.resolve(false);
                }
            }

            stopOperation.then(clearSettledStop, clearSettledStop);
        }

        return pendingStop;
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

        runtime.ai.stopAudio();

        let stopError = null;

        try {
            await pendingStop;
        } catch (error) {
            stopError = error;
        }

        try {
            await runtime.ai.disposeBrowserSpeech();
        } catch (error) {
            if (stopError) {
                throw new AggregateError(
                    [stopError, error],
                    'JuJu read aloud could not stop loading or release browser speech.'
                );
            }

            throw error;
        }

        runtime = null;

        if (stopError) {
            throw stopError;
        }

        return true;
    }

    function inspect() {
        return {
            sdkVersion: ARCANE_SDK_VERSION,
            configured: Boolean(runtime?.ai.browserSpeechDescriptor?.tts),
            provider: runtime
                ? runtime.ai.providerRuntime.status('tts', {execution: true})
                : null
        };
    }

    return {
        initialize,
        read,
        resume,
        stop,
        dispose,
        inspect
    };
}
