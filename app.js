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

const narrationSupported = 'speechSynthesis' in window
    && 'SpeechSynthesisUtterance' in window;

let pages = [];
let currentBookId = '';
let currentPageIndex = 0;
let scrollFrame = 0;
let narrationActive = false;
let lastOpenButton = null;
let activeCopyDrag = null;

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

function updateNarrationButton(isReading) {
    narrationActive = isReading;
    readButton.setAttribute('aria-pressed', String(isReading));
    readButtonLabel.textContent = isReading
        ? 'Stop reading'
        : 'Read this page';
}

function stopNarration() {
    if (!narrationSupported) {
        return;
    }

    window.speechSynthesis.cancel();
    updateNarrationButton(false);
}

function updateReaderState(index) {
    if (pages.length === 0) {
        return;
    }

    currentPageIndex = Math.max(0, Math.min(index, pages.length - 1));

    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
        pages[pageIndex].classList.toggle(
            'is-current',
            pageIndex === currentPageIndex
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

function collectNarration(page) {
    const passages = page.querySelectorAll('[data-narrate]');
    const narration = [];

    for (let index = 0; index < passages.length; index += 1) {
        narration.push(passages[index].textContent.trim());
    }

    return narration.join(' ');
}

function handleNarrationEnd() {
    updateNarrationButton(false);
}

function handleReadClick() {
    if (!narrationSupported || pages.length === 0) {
        return;
    }

    if (narrationActive) {
        stopNarration();
        return;
    }

    const pageNarration = collectNarration(pages[currentPageIndex]);
    const utterance = new SpeechSynthesisUtterance(pageNarration);

    utterance.rate = 0.88;
    utterance.pitch = 1.03;
    utterance.addEventListener('end', handleNarrationEnd);
    utterance.addEventListener('error', handleNarrationEnd);
    updateNarrationButton(true);
    window.speechSynthesis.speak(utterance);
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

if (!narrationSupported) {
    readButton.hidden = true;
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
window.addEventListener('pagehide', stopNarration);
