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

const narrationSupported = 'speechSynthesis' in window
    && 'SpeechSynthesisUtterance' in window;

let pages = [];
let currentBookId = '';
let currentPageIndex = 0;
let scrollFrame = 0;
let narrationActive = false;
let lastOpenButton = null;

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
    createProgressDots();
    chapterLabel.textContent = book.title;
    readerView.dataset.book = bookId;
    readerView.setAttribute('aria-label', book.title + ' story reader');
    libraryView.hidden = true;
    readerView.hidden = false;
    pageBody.classList.add('is-reading');
    document.title = book.title + ' — Juliet’s Grand Adventures';
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
