'use strict';

const BOOKS = Object.freeze(
    {
        planets: Object.freeze(
            {
                title: 'The Three Little Planets',
                templateId: 'book-planets-template'
            }
        ),
        doughnut: Object.freeze(
            {
                title: 'Starbeard and the Doughnut Planet Map',
                templateId: 'book-doughnut-template'
            }
        ),
        moonlit: Object.freeze(
            {
                title: 'The Song of the Moonlit Blossom Planet',
                templateId: 'book-moonlit-template'
            }
        ),
        sockCaper: Object.freeze(
            {
                title: 'The Great Galactic Sock Caper',
                templateId: 'book-sock-caper-template'
            }
        ),
        pluto: Object.freeze(
            {
                title: 'The Treasure of Pluto and the Luminous Labyrinth',
                templateId: 'book-pluto-template'
            }
        ),
        starwater: Object.freeze(
            {
                title: 'Starbeard and the Starwater',
                templateId: 'book-starwater-template'
            }
        )
    }
);

const pageBody = document.body;
const libraryView = document.querySelector('#library-view');
const readerView = document.querySelector('#reader-view');
const storyTrack = document.querySelector('#story-track');
const previousButton = document.querySelector('#previous-button');
const nextButton = document.querySelector('#next-button');
const libraryButton = document.querySelector('#library-button');
const readerBrandButton = document.querySelector('#reader-brand-button');
const readButton = document.querySelector('#read-button');
const readButtonLabel = document.querySelector('#read-button-label');
const musicButton = document.querySelector('#music-button');
const musicButtonIcon = document.querySelector('#music-button-icon');
const musicButtonLabel = document.querySelector('#music-button-label');
const musicStatus = document.querySelector('#music-status');
const backgroundMusic = document.querySelector('#background-music');
const libraryMusicSlot = document.querySelector('#library-music-slot');
const readerMusicSlot = document.querySelector('#reader-music-slot');
const voiceControl = document.querySelector('#voice-control');
const voiceSelect = document.querySelector('#voice-select');
const narrationStatus = document.querySelector('#narration-status');
const chapterLabel = document.querySelector('#chapter-label');
const statusText = document.querySelector('#page-status-text');
const progressDots = document.querySelector('#progress-dots');
const openBookButtons = document.querySelectorAll('[data-open-book]');
const readerBar = document.querySelector('.reader-bar');
const readerControls = document.querySelector('.reader-controls');

const COPY_MOVE_STEP = 16;
const COPY_MOVE_LARGE_STEP = 48;
const COPY_EDGE_GAP = 12;
const COPY_CONTROL_GAP = 8;

const AudioContextConstructor = window.AudioContext
    || window.webkitAudioContext;
const kokoroNarrationSupported = 'Worker' in window
    && 'WebAssembly' in window
    && typeof AudioContextConstructor === 'function';
const browserNarrationSupported = 'speechSynthesis' in window
    && 'SpeechSynthesisUtterance' in window;
const narrationSupported = kokoroNarrationSupported
    || browserNarrationSupported;
const BACKGROUND_MUSIC_VOLUME = 0.005;
const VOICE_STORAGE_KEY = 'juju-grand-adventures.kokoro-voice';
const SPEECH_REQUEST_TIMEOUT_MS = 10 * 60 * 1000;
const SPEECH_CHUNK_TIMEOUT_MS = 90 * 1000;
const MIN_NARRATION_CHUNK_CHARACTERS = 80;
const TARGET_NARRATION_CHUNK_CHARACTERS = 240;
const MAX_NARRATION_CHUNK_CHARACTERS = 320;
const MAX_NARRATION_CHUNKS = 96;
const LINE_BREAK_PAUSE_MS = 120;
const PASSAGE_BREAK_PAUSE_MS = 200;
const AUDIO_SCHEDULE_LEAD_SECONDS = 0.025;
const AUDIO_EDGE_FADE_SECONDS = 0.004;

let pages = [];
let currentBookId = '';
let currentPageIndex = 0;
let scrollFrame = 0;
let narrationActive = false;
let narrationRevision = 0;
let speechRequestId = 0;
let speechWorker = null;
let audioContext = null;
let activeAudioPlayback = null;
let nativeUtterance = null;
let nativeNarrationRevision = 0;
let lastOpenButton = null;
let activeCopyDrag = null;

const speechRequests = new Map();

function moveMusicButton(targetSlot) {
    if (musicButton.parentElement !== targetSlot) {
        targetSlot.append(musicButton);
    }
}

function updateMusicButton() {
    const isPlaying = !backgroundMusic.paused;

    musicButton.setAttribute(
        'aria-label',
        isPlaying ? 'Pause background music' : 'Play background music'
    );
    musicButton.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
    musicButtonLabel.textContent = isPlaying ? 'Pause music' : 'Play music';
    musicButtonIcon.textContent = isPlaying ? '❚❚' : '♪';
}

function handleBackgroundMusicPlay() {
    musicButton.setAttribute('aria-busy', 'false');
    updateMusicButton();
    musicStatus.textContent = 'Background music is playing softly.';
}

function handleBackgroundMusicPause() {
    musicButton.setAttribute('aria-busy', 'false');
    updateMusicButton();
    musicStatus.textContent = 'Background music is paused.';
}

function handleBackgroundMusicError() {
    musicButton.setAttribute('aria-busy', 'false');
    updateMusicButton();
    musicStatus.textContent = 'Background music could not start. Please try again.';
}

async function handleMusicButtonClick() {
    if (!backgroundMusic.paused) {
        backgroundMusic.pause();
        return;
    }

    musicButton.setAttribute('aria-busy', 'true');
    musicStatus.textContent = 'Starting background music.';

    try {
        await backgroundMusic.play();
    } catch (error) {
        handleBackgroundMusicError();
    }
}

function createProgressDots() {
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < pages.length; index += 1) {
        const dot = document.createElement('button');
        const pageLabel = pages[index].dataset.pageLabel || 'Page ' + (index + 1);

        dot.className = index === 0
            ? 'progress-dot is-current'
            : 'progress-dot';
        dot.type = 'button';
        dot.dataset.pageIndex = String(index);
        dot.setAttribute('aria-label', 'Go to ' + pageLabel);
        dot.setAttribute('aria-current', index === 0 ? 'page' : 'false');
        fragment.append(dot);
    }

    progressDots.replaceChildren(fragment);
}

function getCopyOffset(copy, axis) {
    const rawValue = axis === 'x'
        ? copy.dataset.copyX
        : copy.dataset.copyY;
    const value = Number.parseFloat(rawValue || '0');

    return Number.isFinite(value) ? value : 0;
}

function updateCopyPosition(copy, x, y) {
    const hasMoved = Math.abs(x) > 0.5 || Math.abs(y) > 0.5;
    const resetButton = copy.querySelector('.copy-reset-button');

    copy.dataset.copyX = String(x);
    copy.dataset.copyY = String(y);
    copy.style.setProperty('--copy-drag-x', x + 'px');
    copy.style.setProperty('--copy-drag-y', y + 'px');
    copy.classList.toggle('is-moved', hasMoved);

    if (resetButton) {
        resetButton.hidden = !hasMoved;
    }
}

function resetCopyPosition(copy) {
    updateCopyPosition(copy, 0, 0);
}

function clampValue(value, minimum, maximum) {
    if (minimum > maximum) {
        return 0;
    }

    return Math.max(minimum, Math.min(value, maximum));
}

function getCopyMovementBounds(copy) {
    const page = copy.closest('.story-page');
    const pageBounds = page.getBoundingClientRect();
    const copyBounds = copy.getBoundingClientRect();
    const topBoundary = pageBounds.top
        + readerBar.getBoundingClientRect().height
        + COPY_CONTROL_GAP;
    const bottomBoundary = pageBounds.bottom
        - readerControls.getBoundingClientRect().height
        - COPY_CONTROL_GAP;

    return Object.freeze(
        {
            minimumX: pageBounds.left + COPY_EDGE_GAP - copyBounds.left,
            maximumX: pageBounds.right - COPY_EDGE_GAP - copyBounds.right,
            minimumY: topBoundary - copyBounds.top,
            maximumY: bottomBoundary - copyBounds.bottom
        }
    );
}

function moveCopyBy(copy, deltaX, deltaY) {
    const bounds = getCopyMovementBounds(copy);
    const safeDeltaX = clampValue(
        deltaX,
        bounds.minimumX,
        bounds.maximumX
    );
    const safeDeltaY = clampValue(
        deltaY,
        bounds.minimumY,
        bounds.maximumY
    );
    const nextX = getCopyOffset(copy, 'x') + safeDeltaX;
    const nextY = getCopyOffset(copy, 'y') + safeDeltaY;

    updateCopyPosition(copy, nextX, nextY);
}

function handleCopyDragStart(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
    }

    if (activeCopyDrag) {
        return;
    }

    const handle = event.currentTarget;
    const copy = handle.closest('.page-copy');

    activeCopyDrag = Object.freeze(
        {
            pointerId: event.pointerId,
            handle,
            copy,
            originClientX: event.clientX,
            originClientY: event.clientY,
            originCopyX: getCopyOffset(copy, 'x'),
            originCopyY: getCopyOffset(copy, 'y'),
            bounds: getCopyMovementBounds(copy)
        }
    );

    if (typeof handle.setPointerCapture === 'function') {
        handle.setPointerCapture(event.pointerId);
    }

    copy.classList.add('is-dragging');
    pageBody.classList.add('is-moving-copy');
    event.preventDefault();
    event.stopPropagation();
}

function clearCopyDragState() {
    if (!activeCopyDrag) {
        return null;
    }

    const completedDrag = activeCopyDrag;

    completedDrag.copy.classList.remove('is-dragging');
    pageBody.classList.remove('is-moving-copy');
    activeCopyDrag = null;

    return completedDrag;
}

function handleCopyDragMove(event) {
    if (!activeCopyDrag || event.pointerId !== activeCopyDrag.pointerId) {
        return;
    }

    const deltaX = clampValue(
        event.clientX - activeCopyDrag.originClientX,
        activeCopyDrag.bounds.minimumX,
        activeCopyDrag.bounds.maximumX
    );
    const deltaY = clampValue(
        event.clientY - activeCopyDrag.originClientY,
        activeCopyDrag.bounds.minimumY,
        activeCopyDrag.bounds.maximumY
    );

    updateCopyPosition(
        activeCopyDrag.copy,
        activeCopyDrag.originCopyX + deltaX,
        activeCopyDrag.originCopyY + deltaY
    );
    event.preventDefault();
    event.stopPropagation();
}

function finishCopyDrag(event) {
    if (!activeCopyDrag || event.pointerId !== activeCopyDrag.pointerId) {
        return;
    }

    const completedDrag = clearCopyDragState();
    const handle = completedDrag.handle;

    if (
        typeof handle.hasPointerCapture === 'function'
        && handle.hasPointerCapture(event.pointerId)
    ) {
        handle.releasePointerCapture(event.pointerId);
    }

    event.preventDefault();
    event.stopPropagation();
}

function handleCopyCaptureLost(event) {
    if (!activeCopyDrag || event.pointerId !== activeCopyDrag.pointerId) {
        return;
    }

    clearCopyDragState();
}

function cancelCopyDrag() {
    const completedDrag = clearCopyDragState();

    if (!completedDrag) {
        return;
    }

    if (
        typeof completedDrag.handle.hasPointerCapture === 'function'
        && completedDrag.handle.hasPointerCapture(completedDrag.pointerId)
    ) {
        completedDrag.handle.releasePointerCapture(completedDrag.pointerId);
    }
}

function handleCopyMoveKeydown(event) {
    const copy = event.currentTarget.closest('.page-copy');
    const movementStep = event.shiftKey
        ? COPY_MOVE_LARGE_STEP
        : COPY_MOVE_STEP;
    let deltaX = 0;
    let deltaY = 0;

    if (event.key === 'Home') {
        resetCopyPosition(copy);
        event.preventDefault();
        event.stopPropagation();
        return;
    }

    if (event.key === 'ArrowLeft') {
        deltaX = -movementStep;
    } else if (event.key === 'ArrowRight') {
        deltaX = movementStep;
    } else if (event.key === 'ArrowUp') {
        deltaY = -movementStep;
    } else if (event.key === 'ArrowDown') {
        deltaY = movementStep;
    } else {
        return;
    }

    moveCopyBy(copy, deltaX, deltaY);
    event.preventDefault();
    event.stopPropagation();
}

function handleCopyResetClick(event) {
    const copy = event.currentTarget.closest('.page-copy');
    const moveButton = copy.querySelector('.copy-drag-handle');

    resetCopyPosition(copy);
    moveButton.focus();
    event.preventDefault();
    event.stopPropagation();
}

function updateCopySizeButton(copy, isCollapsed) {
    const sizeButton = copy.querySelector('.copy-size-button');

    if (!sizeButton) {
        return;
    }

    sizeButton.textContent = isCollapsed
        ? 'Show words'
        : 'Shrink words';
    sizeButton.setAttribute('aria-expanded', String(!isCollapsed));
    sizeButton.setAttribute(
        'aria-label',
        isCollapsed
            ? 'Show all the words on this page'
            : 'Shrink the words to a small control so more art is visible'
    );
}

function handleCopySizeClick(event) {
    const copy = event.currentTarget.closest('.page-copy');
    const isCollapsed = !copy.classList.contains('is-collapsed');

    copy.classList.toggle('is-collapsed', isCollapsed);
    updateCopySizeButton(copy, isCollapsed);
    moveCopyBy(copy, 0, 0);
    event.preventDefault();
    event.stopPropagation();
}

function createCopyMovementControls() {
    const copies = storyTrack.querySelectorAll('.page-copy');

    for (let index = 0; index < copies.length; index += 1) {
        const tools = document.createElement('div');
        const moveButton = document.createElement('button');
        const grip = document.createElement('span');
        const label = document.createElement('span');
        const sizeButton = document.createElement('button');
        const resetButton = document.createElement('button');

        tools.className = 'copy-move-tools';
        moveButton.className = 'copy-drag-handle';
        moveButton.type = 'button';
        moveButton.setAttribute(
            'aria-label',
            'Move the words on this page. Drag, use arrow keys, or press Home to reset.'
        );
        moveButton.title = 'Drag the words, or use the arrow keys. Hold Shift for larger steps.';
        grip.className = 'copy-move-grip';
        grip.setAttribute('aria-hidden', 'true');
        grip.textContent = '✥';
        label.className = 'copy-move-label';
        label.textContent = 'Move words';
        sizeButton.className = 'copy-size-button';
        sizeButton.type = 'button';
        sizeButton.textContent = 'Shrink words';
        sizeButton.setAttribute('aria-expanded', 'true');
        sizeButton.setAttribute(
            'aria-label',
            'Shrink the words to a small control so more art is visible'
        );
        resetButton.className = 'copy-reset-button';
        resetButton.type = 'button';
        resetButton.hidden = true;
        resetButton.textContent = 'Reset';
        resetButton.setAttribute(
            'aria-label',
            'Reset the words to their original position'
        );

        moveButton.append(grip, label);
        tools.append(moveButton, sizeButton, resetButton);
        copies[index].append(tools);
        moveButton.addEventListener('pointerdown', handleCopyDragStart);
        moveButton.addEventListener('pointermove', handleCopyDragMove);
        moveButton.addEventListener('pointerup', finishCopyDrag);
        moveButton.addEventListener('pointercancel', finishCopyDrag);
        moveButton.addEventListener('lostpointercapture', handleCopyCaptureLost);
        moveButton.addEventListener('keydown', handleCopyMoveKeydown);
        sizeButton.addEventListener('click', handleCopySizeClick);
        resetButton.addEventListener('click', handleCopyResetClick);
    }
}

function keepCopyPositionsVisible() {
    for (let index = 0; index < pages.length; index += 1) {
        const copy = pages[index].querySelector('.page-copy');

        if (copy) {
            moveCopyBy(copy, 0, 0);
        }
    }
}

function getSelectedVoiceLabel() {
    if (!voiceSelect) {
        return 'Kokoro';
    }

    const selectedOption = voiceSelect.options[voiceSelect.selectedIndex];

    return selectedOption
        ? selectedOption.textContent.trim()
        : 'Kokoro';
}

function updateNarrationStatus(message) {
    if (narrationStatus) {
        narrationStatus.textContent = message;
    }
}

function updateNarrationButton(isReading, label, isBusy = false) {
    narrationActive = isReading;
    readButton.setAttribute('aria-pressed', String(isReading));
    readButton.setAttribute('aria-busy', String(isBusy));
    readButtonLabel.textContent = label || (
        isReading
            ? 'Stop reading'
            : 'Read this page'
    );

    if (voiceSelect) {
        voiceSelect.disabled = isReading || !kokoroNarrationSupported;
    }
}

function rejectSpeechRequests(message) {
    const error = new Error(message);

    for (const pendingRequest of speechRequests.values()) {
        window.clearTimeout(pendingRequest.timeoutId);
        pendingRequest.reject(error);
    }

    speechRequests.clear();
}

function destroySpeechWorker(message) {
    if (speechWorker) {
        speechWorker.terminate();
        speechWorker = null;
    }

    if (speechRequests.size > 0) {
        rejectSpeechRequests(message || 'Kokoro narration stopped.');
    }
}

function hasStartedKokoroPlayback() {
    return Boolean(
        activeAudioPlayback
        && activeAudioPlayback.scheduledCount > 0
    );
}

function handleSpeechRequestTimeout(requestId) {
    const pendingRequest = speechRequests.get(requestId);

    if (!pendingRequest) {
        return;
    }

    speechRequests.delete(requestId);
    pendingRequest.reject(
        new Error('Kokoro took too long to prepare this page.')
    );
    destroySpeechWorker('Kokoro narration timed out.');
}

function refreshSpeechRequestTimeout(
    requestId,
    timeoutMs = SPEECH_REQUEST_TIMEOUT_MS
) {
    const pendingRequest = speechRequests.get(requestId);

    if (!pendingRequest) {
        return;
    }

    window.clearTimeout(pendingRequest.timeoutId);
    pendingRequest.timeoutId = window.setTimeout(
        handleSpeechRequestTimeout,
        timeoutMs,
        requestId
    );
}

function failSpeechRequest(requestId, pendingRequest, error) {
    const requestError = error instanceof Error
        ? error
        : new Error(String(error || 'Kokoro narration failed.'));

    speechRequests.delete(requestId);
    window.clearTimeout(pendingRequest.timeoutId);
    pendingRequest.reject(requestError);
    destroySpeechWorker(requestError.message);
}

function handleSpeechWorkerChunk(message) {
    const pendingRequest = speechRequests.get(message.id);

    if (!pendingRequest) {
        return;
    }

    const result = message.result || {};
    const validChunk = Number.isInteger(message.index)
        && message.index === pendingRequest.nextChunkIndex
        && message.total === pendingRequest.total
        && result.samples
        && result.samples.length > 0
        && Number.isFinite(result.sampleRate)
        && result.sampleRate > 0;

    if (!validChunk) {
        failSpeechRequest(
            message.id,
            pendingRequest,
            new Error('Kokoro returned an invalid narration chunk.')
        );
        return;
    }

    refreshSpeechRequestTimeout(
        message.id,
        SPEECH_CHUNK_TIMEOUT_MS
    );
    pendingRequest.nextChunkIndex += 1;

    try {
        pendingRequest.onChunk(
            result,
            message.index,
            message.total,
            pendingRequest.chunks[message.index].pauseMs
        );
    } catch (error) {
        failSpeechRequest(message.id, pendingRequest, error);
    }
}

function handleSpeechWorkerResponse(message) {
    const pendingRequest = speechRequests.get(message.id);

    if (!pendingRequest) {
        return;
    }

    speechRequests.delete(message.id);
    window.clearTimeout(pendingRequest.timeoutId);

    if (
        message.ok
        && message.result
        && message.result.chunkCount === pendingRequest.total
        && pendingRequest.nextChunkIndex === pendingRequest.total
    ) {
        pendingRequest.resolve(message.result);
        return;
    }

    pendingRequest.reject(
        new Error(
            message.error || 'Kokoro returned an incomplete narration.'
        )
    );
}

function handleSpeechWorkerMessage(event) {
    const message = event.data || {};

    if (message.kind === 'status') {
        if (message.id) {
            refreshSpeechRequestTimeout(
                message.id,
                message.current > 0
                    ? SPEECH_CHUNK_TIMEOUT_MS
                    : SPEECH_REQUEST_TIMEOUT_MS
            );
        }

        if (
            narrationActive
            && !hasStartedKokoroPlayback()
            && message.loading
        ) {
            updateNarrationButton(true, 'Loading voice…', true);
        } else if (
            narrationActive
            && !hasStartedKokoroPlayback()
            && message.ready
        ) {
            const preparationLabel = message.current > 0
                ? 'Preparing ' + message.current + ' of ' + message.total + '…'
                : 'Preparing page…';

            updateNarrationButton(true, preparationLabel, true);
        }

        if (
            narrationActive
            && !hasStartedKokoroPlayback()
            && message.text
        ) {
            updateNarrationStatus(message.text);
        }

        return;
    }

    if (message.kind === 'chunk') {
        handleSpeechWorkerChunk(message);
        return;
    }

    if (message.kind === 'response') {
        handleSpeechWorkerResponse(message);
    }
}

function handleSpeechWorkerError(event) {
    const message = event.message || 'Kokoro narration failed.';

    destroySpeechWorker(message);
}

function handleSpeechWorkerMessageError() {
    destroySpeechWorker('Kokoro returned unreadable audio data.');
}

function ensureSpeechWorker() {
    if (speechWorker) {
        return speechWorker;
    }

    speechWorker = new Worker(
        './speech-worker.js',
        {
            type: 'module',
            name: 'juju-kokoro-narrator'
        }
    );
    speechWorker.addEventListener('message', handleSpeechWorkerMessage);
    speechWorker.addEventListener('error', handleSpeechWorkerError);
    speechWorker.addEventListener(
        'messageerror',
        handleSpeechWorkerMessageError
    );

    return speechWorker;
}

function requestKokoroChunks(chunks, voice, onChunk) {
    const worker = ensureSpeechWorker();
    const requestId = speechRequestId + 1;
    const chunkTexts = [];

    for (let index = 0; index < chunks.length; index += 1) {
        chunkTexts.push(chunks[index].text);
    }

    speechRequestId = requestId;

    return new Promise(
        function registerSpeechRequest(resolve, reject) {
            speechRequests.set(
                requestId,
                {
                    chunks,
                    nextChunkIndex: 0,
                    onChunk,
                    resolve,
                    reject,
                    timeoutId: 0,
                    total: chunks.length
                }
            );
            refreshSpeechRequestTimeout(requestId);

            try {
                worker.postMessage(
                    {
                        kind: 'request',
                        id: requestId,
                        action: 'synthesize-sequence',
                        payload: {
                            chunks: chunkTexts,
                            voice,
                            speed: 0.95
                        }
                    }
                );
            } catch (error) {
                const pendingRequest = speechRequests.get(requestId);

                speechRequests.delete(requestId);

                if (pendingRequest) {
                    window.clearTimeout(pendingRequest.timeoutId);
                }

                reject(error);
            }
        }
    );
}

async function ensureAudioContext() {
    if (!audioContext) {
        audioContext = new AudioContextConstructor(
            {
                latencyHint: 'interactive'
            }
        );
    }

    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }

    return audioContext;
}

function stopAudioPlayback() {
    if (!activeAudioPlayback) {
        return;
    }

    const playback = activeAudioPlayback;
    const scheduledSources = Array.from(playback.sources);

    activeAudioPlayback = null;

    for (let index = 0; index < scheduledSources.length; index += 1) {
        const scheduledSource = scheduledSources[index];

        scheduledSource.source.removeEventListener(
            'ended',
            scheduledSource.handleEnded
        );

        try {
            scheduledSource.source.stop();
        } catch (error) {
            // A scheduled source may already have reached its natural end.
        }

        scheduledSource.source.disconnect();
        scheduledSource.gain.disconnect();
    }

    playback.sources.clear();
    settleAudioPlayback(
        playback,
        true
    );
}

function createAudioPlayback(revision, total) {
    let resolveCompletion = null;
    const completion = new Promise(
        function registerAudioPlaybackCompletion(resolve) {
            resolveCompletion = resolve;
        }
    );

    return {
        completion,
        nextStartTime: 0,
        resolveCompletion,
        revision,
        scheduledCount: 0,
        settled: false,
        sources: new Set(),
        total,
        workerComplete: false
    };
}

function settleAudioPlayback(playback, force = false) {
    if (playback.settled) {
        return;
    }

    const naturallyComplete = playback.workerComplete
        && playback.scheduledCount === playback.total
        && playback.sources.size === 0;

    if (!force && !naturallyComplete) {
        return;
    }

    playback.settled = true;

    if (activeAudioPlayback === playback) {
        activeAudioPlayback = null;
    }

    playback.resolveCompletion();
}

function finishScheduledAudioSource(playback, scheduledSource) {
    if (!playback.sources.has(scheduledSource)) {
        return;
    }

    scheduledSource.source.removeEventListener(
        'ended',
        scheduledSource.handleEnded
    );
    scheduledSource.source.disconnect();
    scheduledSource.gain.disconnect();
    playback.sources.delete(scheduledSource);
    settleAudioPlayback(playback);
}

function scheduleKokoroAudioChunk(
    result,
    chunkIndex,
    total,
    pauseMs,
    revision
) {
    const playback = activeAudioPlayback;

    if (
        !playback
        || playback.revision !== revision
        || revision !== narrationRevision
        || !narrationActive
    ) {
        return;
    }

    if (
        total !== playback.total
        || chunkIndex !== playback.scheduledCount
    ) {
        throw new Error('Kokoro returned narration chunks out of order.');
    }

    const waveform = result.samples instanceof Float32Array
        ? result.samples
        : new Float32Array(result.samples);
    const buffer = audioContext.createBuffer(
        1,
        waveform.length,
        result.sampleRate
    );
    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    const startTime = Math.max(
        playback.nextStartTime,
        audioContext.currentTime + AUDIO_SCHEDULE_LEAD_SECONDS
    );
    const endTime = startTime + buffer.duration;
    const fadeDuration = Math.min(
        AUDIO_EDGE_FADE_SECONDS,
        buffer.duration / 4
    );
    const fadeOutTime = Math.max(
        startTime + fadeDuration,
        endTime - fadeDuration
    );
    const scheduledSource = {
        gain,
        handleEnded: null,
        source
    };

    function handleScheduledAudioEnd() {
        finishScheduledAudioSource(playback, scheduledSource);
    }

    scheduledSource.handleEnded = handleScheduledAudioEnd;
    buffer.copyToChannel(waveform, 0);
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(audioContext.destination);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(1, startTime + fadeDuration);
    gain.gain.setValueAtTime(1, fadeOutTime);
    gain.gain.linearRampToValueAtTime(0, endTime);
    source.addEventListener(
        'ended',
        handleScheduledAudioEnd,
        {
            once: true
        }
    );
    playback.sources.add(scheduledSource);

    try {
        source.start(startTime);
    } catch (error) {
        finishScheduledAudioSource(playback, scheduledSource);
        throw error;
    }

    playback.scheduledCount += 1;
    playback.nextStartTime = endTime + Math.max(0, pauseMs) / 1000;

    if (playback.scheduledCount === 1) {
        updateNarrationButton(true, 'Stop reading');
        updateNarrationStatus(
            getSelectedVoiceLabel()
            + ' is reading while the next parts are prepared.'
        );
    }
}

function markAudioPlaybackWorkerComplete(playback) {
    playback.workerComplete = true;
    settleAudioPlayback(playback);
}

function handleNativeNarrationEnd() {
    nativeUtterance = null;

    if (nativeNarrationRevision === narrationRevision) {
        handleNarrationEnd();
    }
}

function speakWithBrowserNarrator(text, revision) {
    if (!browserNarrationSupported) {
        throw new Error('Read aloud is unavailable in this browser.');
    }

    const utterance = new SpeechSynthesisUtterance(text);

    nativeUtterance = utterance;
    nativeNarrationRevision = revision;
    utterance.rate = 0.88;
    utterance.pitch = 1.03;
    utterance.addEventListener('end', handleNativeNarrationEnd);
    utterance.addEventListener('error', handleNativeNarrationEnd);
    updateNarrationButton(true, 'Stop reading');
    window.speechSynthesis.speak(utterance);
}

async function beginKokoroNarration(chunks, voice, revision) {
    const narrationText = joinNarrationChunks(chunks);
    let playback = null;

    function handleSynthesizedChunk(
        result,
        chunkIndex,
        total,
        pauseMs
    ) {
        scheduleKokoroAudioChunk(
            result,
            chunkIndex,
            total,
            pauseMs,
            revision
        );
    }

    try {
        await ensureAudioContext();

        if (revision !== narrationRevision || !narrationActive) {
            return;
        }

        playback = createAudioPlayback(revision, chunks.length);
        activeAudioPlayback = playback;

        await requestKokoroChunks(
            chunks,
            voice,
            handleSynthesizedChunk
        );

        if (revision !== narrationRevision || !narrationActive) {
            return;
        }

        markAudioPlaybackWorkerComplete(playback);
        await playback.completion;

        if (revision === narrationRevision) {
            handleNarrationEnd();
        }
    } catch (error) {
        if (revision !== narrationRevision || !narrationActive) {
            return;
        }

        const playbackStarted = Boolean(
            playback
            && playback.scheduledCount > 0
        );

        stopAudioPlayback();
        destroySpeechWorker('Kokoro narration failed.');

        if (!playbackStarted && browserNarrationSupported) {
            updateNarrationStatus(
                'Kokoro is unavailable, so this browser’s voice is reading instead.'
            );
            speakWithBrowserNarrator(narrationText, revision);
            return;
        }

        narrationRevision += 1;
        updateNarrationButton(false);
        updateNarrationStatus(
            playbackStarted
                ? 'Kokoro stopped before finishing this page. Please try again.'
                : 'Read aloud could not start. Check the connection and try again.'
        );
    }
}

function handleUnexpectedNarrationFailure() {
    if (!narrationActive) {
        return;
    }

    stopNarration();
    updateNarrationStatus(
        'Read aloud stopped unexpectedly. Please try again.'
    );
}

function stopNarration() {
    narrationRevision += 1;

    if (browserNarrationSupported) {
        window.speechSynthesis.cancel();
        nativeUtterance = null;
    }

    stopAudioPlayback();

    if (speechRequests.size > 0) {
        destroySpeechWorker('Kokoro narration stopped.');
    }

    updateNarrationButton(false);
    updateNarrationStatus('Ready to read with ' + getSelectedVoiceLabel() + '.');
}

function updateReaderState(index) {
    if (pages.length === 0) {
        return;
    }

    currentPageIndex = Math.max(0, Math.min(index, pages.length - 1));
    const focusedPage = document.activeElement
        ? document.activeElement.closest('.story-page')
        : null;

    if (focusedPage && focusedPage !== pages[currentPageIndex]) {
        readerView.focus(
            {
                preventScroll: true
            }
        );
    }

    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
        const isCurrent = pageIndex === currentPageIndex;

        pages[pageIndex].classList.toggle(
            'is-current',
            isCurrent
        );
        pages[pageIndex].toggleAttribute('inert', !isCurrent);
        pages[pageIndex].setAttribute(
            'aria-hidden',
            isCurrent ? 'false' : 'true'
        );
    }

    const dots = progressDots.children;

    for (let dotIndex = 0; dotIndex < dots.length; dotIndex += 1) {
        const isCurrent = dotIndex === currentPageIndex;

        dots[dotIndex].classList.toggle('is-current', isCurrent);
        dots[dotIndex].setAttribute(
            'aria-current',
            isCurrent ? 'page' : 'false'
        );
    }

    const activeDot = dots[currentPageIndex];

    if (activeDot) {
        activeDot.scrollIntoView(
            {
                block: 'nearest',
                inline: 'nearest'
            }
        );
    }

    const currentLabel = pages[currentPageIndex].dataset.pageLabel
        || 'Page ' + (currentPageIndex + 1);

    previousButton.disabled = currentPageIndex === 0;
    nextButton.disabled = currentPageIndex === pages.length - 1;
    statusText.textContent = currentLabel
        + ' · '
        + (currentPageIndex + 1)
        + ' of '
        + pages.length;
}

function goToPage(index, useSmoothScroll = true) {
    if (pages.length === 0) {
        return;
    }

    const safeIndex = Math.max(0, Math.min(index, pages.length - 1));
    const pageWidth = storyTrack.clientWidth;

    stopNarration();
    storyTrack.scrollTo(
        {
            left: pageWidth * safeIndex,
            behavior: useSmoothScroll ? 'smooth' : 'auto'
        }
    );
    updateReaderState(safeIndex);
}

function finishOpeningBook() {
    storyTrack.scrollLeft = 0;
    updateReaderState(0);
    readerView.focus(
        {
            preventScroll: true
        }
    );
}

function openBookById(bookId, sourceButton) {
    const book = BOOKS[bookId];

    if (!book) {
        return;
    }

    const template = document.querySelector('#' + book.templateId);

    if (!template) {
        return;
    }

    moveMusicButton(readerMusicSlot);
    stopNarration();
    lastOpenButton = sourceButton || lastOpenButton;
    currentBookId = bookId;
    currentPageIndex = 0;
    storyTrack.replaceChildren(template.content.cloneNode(true));
    pages = Array.from(storyTrack.querySelectorAll('.story-page'));
    createCopyMovementControls();
    createProgressDots();
    chapterLabel.textContent = book.title;
    readerView.dataset.book = bookId;
    readerView.setAttribute('aria-label', book.title + ' story reader');
    libraryView.hidden = true;
    readerView.hidden = false;
    pageBody.classList.add('is-reading');
    document.title = book.title + ' | Juliet’s Grand Adventures';
    window.requestAnimationFrame(finishOpeningBook);
}

function focusLastOpenButton() {
    if (lastOpenButton) {
        lastOpenButton.focus();
    }
}

function returnToLibrary() {
    if (readerView.hidden) {
        return;
    }

    stopNarration();
    cancelCopyDrag();
    moveMusicButton(libraryMusicSlot);
    readerView.hidden = true;
    libraryView.hidden = false;
    pageBody.classList.remove('is-reading');
    storyTrack.replaceChildren();
    progressDots.replaceChildren();
    pages = [];
    currentBookId = '';
    currentPageIndex = 0;
    document.title = 'Juliet’s Grand Adventures';
    window.requestAnimationFrame(focusLastOpenButton);
}

function handleOpenBookClick(event) {
    openBookById(
        event.currentTarget.dataset.openBook,
        event.currentTarget
    );
}

function handlePreviousClick() {
    goToPage(currentPageIndex - 1);
}

function handleNextClick() {
    goToPage(currentPageIndex + 1);
}

function handleLibraryClick() {
    returnToLibrary();
}

function handleReaderBrandClick() {
    goToPage(0);
}

function handleStoryActionClick(event) {
    const control = event.target.closest('[data-story-action]');

    if (!control) {
        return;
    }

    if (control.dataset.storyAction === 'begin') {
        goToPage(1);
    }

    if (control.dataset.storyAction === 'again') {
        goToPage(0);
    }
}

function handleProgressClick(event) {
    const dot = event.target.closest('.progress-dot');

    if (!dot) {
        return;
    }

    goToPage(Number(dot.dataset.pageIndex));
}

function handleKeydown(event) {
    if (readerView.hidden) {
        return;
    }

    if (event.key === 'Escape') {
        event.preventDefault();
        returnToLibrary();
        return;
    }

    if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault();
        goToPage(currentPageIndex + 1);
    }

    if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        goToPage(currentPageIndex - 1);
    }

    if (event.key === 'Home') {
        event.preventDefault();
        goToPage(0);
    }

    if (event.key === 'End') {
        event.preventDefault();
        goToPage(pages.length - 1);
    }
}

function syncPageFromScroll() {
    scrollFrame = 0;

    const pageWidth = storyTrack.clientWidth;

    if (pageWidth === 0 || pages.length === 0) {
        return;
    }

    const nearestIndex = Math.round(storyTrack.scrollLeft / pageWidth);

    if (nearestIndex !== currentPageIndex) {
        stopNarration();
        updateReaderState(nearestIndex);
    }
}

function handleTrackScroll() {
    if (scrollFrame !== 0) {
        return;
    }

    scrollFrame = window.requestAnimationFrame(syncPageFromScroll);
}

function findNarrationChunkBreak(text) {
    const maximumBreakIndex = Math.min(
        MAX_NARRATION_CHUNK_CHARACTERS,
        text.length - 1
    );
    const searchIndex = maximumBreakIndex - 1;
    const softBoundaries = [',', ';', ':', '—', '–'];
    let breakIndex = -1;

    for (let index = 0; index < softBoundaries.length; index += 1) {
        const boundaryIndex = text.lastIndexOf(
            softBoundaries[index],
            searchIndex
        );

        if (boundaryIndex >= MIN_NARRATION_CHUNK_CHARACTERS) {
            breakIndex = Math.max(breakIndex, boundaryIndex + 1);
        }
    }

    if (breakIndex < MIN_NARRATION_CHUNK_CHARACTERS) {
        breakIndex = text.lastIndexOf(' ', searchIndex);
    }

    return breakIndex >= MIN_NARRATION_CHUNK_CHARACTERS
        ? breakIndex
        : maximumBreakIndex;
}

function appendBoundedNarrationText(parts, text) {
    let joinWithSpace = /^\s/.test(text);
    let remainingText = text.trim();

    while (remainingText.length > MAX_NARRATION_CHUNK_CHARACTERS) {
        const breakIndex = findNarrationChunkBreak(remainingText);
        const boundedText = remainingText.slice(0, breakIndex).trim();
        const followingText = remainingText.slice(breakIndex);

        if (boundedText) {
            parts.push(
                {
                    joinWithSpace,
                    text: boundedText
                }
            );
        }

        joinWithSpace = /^\s/.test(followingText);
        remainingText = followingText.trim();
    }

    if (remainingText) {
        parts.push(
            {
                joinWithSpace,
                text: remainingText
            }
        );
    }
}

function splitNarrationLine(line) {
    const punctuationSegments = line.match(
        /[^.!?…;:,—–]+(?:[.!?…;:,—–]+[”’"'»)\]]*|$)/g
    ) || [line];
    const boundedSegments = [];
    const chunks = [];
    let bufferedText = '';

    for (let index = 0; index < punctuationSegments.length; index += 1) {
        appendBoundedNarrationText(
            boundedSegments,
            punctuationSegments[index]
        );
    }

    for (let index = 0; index < boundedSegments.length; index += 1) {
        const segment = boundedSegments[index];
        const separator = bufferedText && segment.joinWithSpace
            ? ' '
            : '';
        const combinedLength = bufferedText
            ? bufferedText.length + segment.text.length + separator.length
            : segment.text.length;

        if (
            bufferedText
            && (
                combinedLength > MAX_NARRATION_CHUNK_CHARACTERS
                || (
                    bufferedText.length >= MIN_NARRATION_CHUNK_CHARACTERS
                    && combinedLength > TARGET_NARRATION_CHUNK_CHARACTERS
                )
            )
        ) {
            chunks.push(bufferedText);
            bufferedText = '';
        }

        bufferedText = bufferedText
            ? bufferedText + separator + segment.text
            : segment.text;

        if (
            bufferedText.length >= MIN_NARRATION_CHUNK_CHARACTERS
            && /[.!?…;:,—–][”’"'»)\]]*$/.test(segment.text)
        ) {
            chunks.push(bufferedText);
            bufferedText = '';
        }
    }

    if (bufferedText) {
        chunks.push(bufferedText);
    }

    return chunks;
}

function collectNarrationChunks(page) {
    const passages = page.querySelectorAll('[data-narrate]');
    const chunks = [];

    for (let index = 0; index < passages.length; index += 1) {
        const passage = passages[index].cloneNode(true);
        const lineBreaks = passage.querySelectorAll('br');

        for (let breakIndex = 0; breakIndex < lineBreaks.length; breakIndex += 1) {
            lineBreaks[breakIndex].replaceWith('\n');
        }

        const passageText = passage.textContent
            .replace(/\r\n?/g, '\n')
            .replace(/[^\S\n]+/g, ' ')
            .replace(/ *\n+ */g, '\n')
            .trim();
        const lines = passageText.split(/\n+/);
        const passageStartIndex = chunks.length;

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
            const lineChunks = splitNarrationLine(lines[lineIndex].trim());
            const lineStartIndex = chunks.length;

            for (let chunkIndex = 0; chunkIndex < lineChunks.length; chunkIndex += 1) {
                chunks.push(
                    {
                        text: lineChunks[chunkIndex],
                        pauseMs: 0
                    }
                );
            }

            if (
                chunks.length > lineStartIndex
                && lineIndex < lines.length - 1
            ) {
                chunks[chunks.length - 1].pauseMs = LINE_BREAK_PAUSE_MS;
            }
        }

        if (chunks.length > passageStartIndex) {
            chunks[chunks.length - 1].pauseMs = Math.max(
                chunks[chunks.length - 1].pauseMs,
                PASSAGE_BREAK_PAUSE_MS
            );
        }
    }

    if (chunks.length > 0) {
        chunks[chunks.length - 1].pauseMs = 0;
    }

    return chunks;
}

function joinNarrationChunks(chunks) {
    const narration = [];

    for (let index = 0; index < chunks.length; index += 1) {
        narration.push(chunks[index].text);
    }

    return narration.join(' ');
}

function handleNarrationEnd() {
    updateNarrationButton(false);
    updateNarrationStatus('Ready to read with ' + getSelectedVoiceLabel() + '.');
}

function handleReadClick() {
    if (!narrationSupported || pages.length === 0) {
        return;
    }

    if (narrationActive) {
        stopNarration();
        return;
    }

    const narrationChunks = collectNarrationChunks(pages[currentPageIndex]);
    const pageNarration = joinNarrationChunks(narrationChunks);
    const revision = narrationRevision + 1;

    if (!pageNarration) {
        updateNarrationStatus('This page has no text to read.');
        return;
    }

    narrationRevision = revision;

    if (
        kokoroNarrationSupported
        && narrationChunks.length <= MAX_NARRATION_CHUNKS
    ) {
        const selectedVoice = voiceSelect
            ? voiceSelect.value
            : 'af_heart';

        updateNarrationButton(true, 'Loading voice…', true);
        updateNarrationStatus(
            'Preparing ' + getSelectedVoiceLabel() + ' locally. The first use downloads the voice model.'
        );
        beginKokoroNarration(
            narrationChunks,
            selectedVoice,
            revision
        ).catch(handleUnexpectedNarrationFailure);
        return;
    }

    if (!browserNarrationSupported) {
        updateNarrationStatus(
            'This page has too many sections for local read aloud.'
        );
        return;
    }

    updateNarrationStatus('Using this browser’s built-in voice.');

    try {
        speakWithBrowserNarrator(pageNarration, revision);
    } catch (error) {
        handleUnexpectedNarrationFailure();
    }
}

function restoreVoicePreference() {
    if (!voiceSelect) {
        return;
    }

    try {
        const savedVoice = window.localStorage.getItem(VOICE_STORAGE_KEY);
        const savedOption = savedVoice
            ? voiceSelect.querySelector('option[value="' + savedVoice + '"]')
            : null;

        if (savedOption) {
            voiceSelect.value = savedVoice;
        }
    } catch (error) {
        // Voice persistence is optional when storage is unavailable.
    }
}

function handleVoiceChange() {
    if (narrationActive) {
        stopNarration();
    }

    try {
        window.localStorage.setItem(VOICE_STORAGE_KEY, voiceSelect.value);
    } catch (error) {
        // The current selection still works when storage is unavailable.
    }

    updateNarrationStatus('Ready to read with ' + getSelectedVoiceLabel() + '.');
}

function ignoreAudioCloseError() {
    // The page is leaving, so there is no recovery action to present.
}

function handlePageHide() {
    stopNarration();
    destroySpeechWorker('The story page closed.');
    backgroundMusic.pause();

    if (audioContext) {
        audioContext.close().catch(ignoreAudioCloseError);
        audioContext = null;
    }
}

function handleResize() {
    if (readerView.hidden || pages.length === 0) {
        return;
    }

    keepCopyPositionsVisible();
    storyTrack.scrollLeft = storyTrack.clientWidth * currentPageIndex;
}

for (let index = 0; index < openBookButtons.length; index += 1) {
    openBookButtons[index].addEventListener('click', handleOpenBookClick);
}

backgroundMusic.volume = BACKGROUND_MUSIC_VOLUME;
musicButton.addEventListener('click', handleMusicButtonClick);
backgroundMusic.addEventListener('play', handleBackgroundMusicPlay);
backgroundMusic.addEventListener('pause', handleBackgroundMusicPause);
backgroundMusic.addEventListener('ended', handleBackgroundMusicPause);
backgroundMusic.addEventListener('error', handleBackgroundMusicError);
backgroundMusic.play();
updateMusicButton();

if (!narrationSupported) {
    readButton.hidden = true;

    if (voiceControl) {
        voiceControl.hidden = true;
    }
} else {
    restoreVoicePreference();

    if (voiceSelect) {
        voiceSelect.disabled = !kokoroNarrationSupported;
        voiceSelect.addEventListener('change', handleVoiceChange);
    }

    if (kokoroNarrationSupported) {
        updateNarrationStatus('Ready to read with ' + getSelectedVoiceLabel() + '.');
    } else {
        updateNarrationStatus('Kokoro is unavailable; the browser voice will be used.');
    }
}

previousButton.addEventListener('click', handlePreviousClick);
nextButton.addEventListener('click', handleNextClick);
libraryButton.addEventListener('click', handleLibraryClick);
readerBrandButton.addEventListener('click', handleReaderBrandClick);
readButton.addEventListener('click', handleReadClick);
progressDots.addEventListener('click', handleProgressClick);
storyTrack.addEventListener('click', handleStoryActionClick);
storyTrack.addEventListener(
    'scroll',
    handleTrackScroll,
    {
        passive: true
    }
);
window.addEventListener('keydown', handleKeydown);
window.addEventListener('resize', handleResize);
window.addEventListener('pagehide', handlePageHide);
