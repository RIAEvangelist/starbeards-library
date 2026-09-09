import DBOPFS from 'arcane/DBOPFS';
import {arcaneEvents} from 'arcane-os/event-manager';

export const JUJU_SPEECH_AUTHORITY_REQUIRED = 'ARCANE_AI_MODEL_AUTHORITY_REQUIRED';

const ARCANE_SDK_VERSION = '0.26.0';
const CONFIGURATION_ID = 'juju-grand-adventures-browser-speech';
const DEFAULT_SPEED = 0.95;
const NARRATION_TABLE = 'juju_narration_audio';

function bookPreparationOrder(pageCount, selectedPageIndex) {
    const order = [selectedPageIndex];
    let followingPageIndex = selectedPageIndex + 1;
    let precedingPageIndex = 0;

    while (followingPageIndex < pageCount || precedingPageIndex < selectedPageIndex) {
        if (followingPageIndex < pageCount) {
            order.push(followingPageIndex);
            followingPageIndex += 1;
        }

        if (precedingPageIndex < selectedPageIndex) {
            order.push(precedingPageIndex);
            precedingPageIndex += 1;
        }
    }

    return order;
}

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
    let bookPreparation = null;
    let activePlayback = null;

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
            dbopfs,
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

    function reportBookState(book, state, pageIndex, error) {
        if (bookPreparation !== book || book.controller.signal.aborted || disposed) {
            return;
        }

        onState(
            {
                state,
                bookId: book.id,
                voice: book.voice,
                pageIndex,
                completedPages: book.completedPages,
                failedPages: book.failedPages,
                totalPages: book.pages.length,
                error
            }
        );
    }

    function preparePage(book, pageIndex) {
        const page = book.pages[pageIndex];

        reportBookState(book, 'book-preparing', pageIndex);

        return runtime.ai.prepareTTS(
            {
                parts: page.passages.map(
                    function describeNarrationPart(passage) {
                        return {
                            input: passage.text,
                            voice: book.voice,
                            speed: book.speed,
                            pauseAfterMs: passage.pauseMs
                        };
                    }
                ),
                storage: {
                    db: runtime.dbopfs,
                    table: NARRATION_TABLE,
                    key: JSON.stringify([book.id, page.id, book.voice])
                },
                identity: {
                    bookId: book.id,
                    pageId: page.id,
                    providerId: runtime.authority.providerId,
                    model: runtime.authority.model,
                    runtime: runtime.authority.runtime
                },
                signal: book.controller.signal
            }
        );
    }

    async function prepareBook(book, selectedPreparation) {
        for (const pageIndex of book.order) {
            if (book.controller.signal.aborted || disposed) {
                return;
            }

            try {
                const prepared = pageIndex === book.selectedPageIndex
                    ? selectedPreparation
                    : preparePage(book, pageIndex);

                // Advance on generation/storage completion, never on playback.
                // The SDK owns concurrent punctuation segments inside each page.
                await prepared.ready;

                if (book.controller.signal.aborted || disposed) {
                    return;
                }

                book.completedPages += 1;
                reportBookState(book, 'book-preparing', pageIndex);
            } catch (error) {
                if (book.controller.signal.aborted || disposed) {
                    return;
                }

                book.failedPages += 1;
                reportBookState(book, 'book-preparation-error', pageIndex, error);
            }
        }

        reportBookState(book, 'book-prepared', book.selectedPageIndex);
    }

    async function read({
        bookId,
        pages,
        pageIndex,
        voice,
        speed = DEFAULT_SPEED
    } = {}) {
        assertActive();

        const stopping = stop();
        const operationGeneration = generation;

        await initialize();
        await stopping;

        if (operationGeneration !== generation || disposed) {
            return false;
        }

        const selectedVoice = String(voice || runtime.authority.defaultVoice);
        const book = {
            id: bookId,
            pages,
            selectedPageIndex: pageIndex,
            voice: selectedVoice,
            speed,
            order: bookPreparationOrder(pages.length, pageIndex),
            controller: new AbortController(),
            completedPages: 0,
            failedPages: 0,
            done: Promise.resolve(),
            settled: false
        };

        bookPreparation = book;

        let playback = null;

        try {
            const selectedPreparation = preparePage(book, pageIndex);

            book.done = prepareBook(book, selectedPreparation).finally(
                function settleBookPreparation() {
                    book.settled = true;
                }
            );
            book.done.catch(
                function reportBookObserverFailure(error) {
                    console.error('JuJu book preparation could not report its result.', error);
                }
            );

            onState(
                {
                    state: 'queued'
                }
            );

            // Cached reads precede model loading inside the SDK. Playback can
            // attach while generation continues, without an eager model unmute.
            playback = runtime.ai.playPreparedTTS(
                selectedPreparation,
                {
                    onState: function reportSelectedPlaybackState(detail) {
                        if (operationGeneration !== generation || disposed) {
                            return;
                        }

                        if (detail.state === 'waiting-for-gesture') {
                            onState({state: 'waiting-for-gesture'});
                        } else if (detail.state === 'scheduled') {
                            onState({state: 'queued'});
                        }
                    }
                }
            );
            activePlayback = playback;

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

            const completed = await playback.finished;

            if (!completed && playback.error) {
                throw playback.error;
            }

            return operationGeneration === generation
                && !disposed
                && completed;
        } catch (error) {
            if (operationGeneration === generation && !disposed) {
                playback?.stop();
            }

            throw error;
        } finally {
            if (activePlayback === playback) {
                activePlayback = null;
            }

            if (operationGeneration === generation) {
                generation += 1;
            }
        }
    }

    async function resume() {
        assertActive();

        if (!activePlayback) {
            return false;
        }

        const operationGeneration = generation;
        const playback = activePlayback;
        const resumed = await playback.resume();

        if (operationGeneration !== generation || disposed) {
            return false;
        }

        if (playback.error) {
            throw playback.error;
        }

        return resumed;
    }

    function stop({cancelPreparation = true} = {}) {
        generation += 1;

        const playback = activePlayback;
        const book = cancelPreparation ? bookPreparation : null;
        const stopping = [pendingStop];

        activePlayback = null;

        if (playback) {
            stopping.push(playback.stop());
        }

        if (book) {
            if (!book.settled) {
                reportBookState(book, 'book-stopped', book.selectedPageIndex);
            }

            book.controller.abort();
            bookPreparation = null;
            stopping.push(book.done);
        }

        const stopOperation = Promise.all(stopping).then(
            function finishNarrationStop() {
                return Boolean(playback || book);
            }
        );

        pendingStop = stopOperation;

        function clearSettledStop() {
            if (pendingStop === stopOperation) {
                pendingStop = Promise.resolve(false);
            }
        }

        stopOperation.then(clearSettledStop, clearSettledStop);
        return stopOperation;
    }

    async function dispose() {
        if (disposed) {
            return false;
        }

        disposed = true;

        const stopping = stop();

        if (!runtime) {
            return true;
        }

        let stopError = null;

        try {
            await stopping;
        } catch (error) {
            stopError = error;
        }

        try {
            await runtime.ai.disposeBrowserSpeech();
        } catch (error) {
            if (stopError) {
                throw new AggregateError(
                    [stopError, error],
                    'JuJu read aloud could not stop preparation or release browser speech.'
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
