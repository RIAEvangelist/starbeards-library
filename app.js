const storyTrack = document.querySelector('#story-track');
const pages = Array.from(document.querySelectorAll('.story-page'));
const previousButton = document.querySelector('#previous-button');
const nextButton = document.querySelector('#next-button');
const beginButton = document.querySelector('#begin-button');
const againButton = document.querySelector('#again-button');
const brandLink = document.querySelector('#brand-link');
const readButton = document.querySelector('#read-button');
const readButtonLabel = document.querySelector('#read-button-label');
const statusText = document.querySelector('#page-status-text');
const progressDots = document.querySelector('#progress-dots');

const narrationSupported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

let currentPageIndex = 0;
let scrollFrame = 0;
let narrationActive = false;

function createProgressDots() {
    pages.forEach(function createDot(page, index) {
        const dot = document.createElement('button');
        dot.className = index === 0 ? 'progress-dot is-current' : 'progress-dot';
        dot.type = 'button';
        dot.dataset.index = String(index);
        dot.setAttribute('aria-label', index === 0 ? 'Go to the cover' : 'Go to page ' + (index + 1));
        dot.setAttribute('aria-current', index === 0 ? 'page' : 'false');
        progressDots.append(dot);
    });
}

function updateNarrationButton(isReading) {
    narrationActive = isReading;
    readButton.setAttribute('aria-pressed', String(isReading));
    readButtonLabel.textContent = isReading ? 'Stop reading' : 'Read this page';
}

function stopNarration() {
    if (!narrationSupported) {
        return;
    }

    window.speechSynthesis.cancel();
    updateNarrationButton(false);
}

function updateReaderState(index) {
    currentPageIndex = Math.max(0, Math.min(index, pages.length - 1));

    pages.forEach(function updatePageClass(page, pageIndex) {
        page.classList.toggle('is-current', pageIndex === currentPageIndex);
    });

    Array.from(progressDots.children).forEach(function updateDot(dot, dotIndex) {
        const isCurrent = dotIndex === currentPageIndex;
        dot.classList.toggle('is-current', isCurrent);
        dot.setAttribute('aria-current', isCurrent ? 'page' : 'false');
    });

    previousButton.disabled = currentPageIndex === 0;
    nextButton.disabled = currentPageIndex === pages.length - 1;
    statusText.textContent = currentPageIndex === 0
        ? 'Cover · 1 of ' + pages.length
        : 'Page ' + (currentPageIndex + 1) + ' of ' + pages.length;
}

function goToPage(index) {
    const safeIndex = Math.max(0, Math.min(index, pages.length - 1));
    stopNarration();
    pages[safeIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    updateReaderState(safeIndex);
}

function handlePreviousClick() {
    goToPage(currentPageIndex - 1);
}

function handleNextClick() {
    goToPage(currentPageIndex + 1);
}

function handleBeginClick() {
    goToPage(1);
}

function handleAgainClick() {
    goToPage(0);
}

function handleBrandClick(event) {
    event.preventDefault();
    goToPage(0);
}

function handleProgressClick(event) {
    const dot = event.target.closest('.progress-dot');

    if (!dot) {
        return;
    }

    goToPage(Number(dot.dataset.index));
}

function handleKeydown(event) {
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

    if (pageWidth === 0) {
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
    const passages = Array.from(page.querySelectorAll('[data-narrate]'));

    return passages.map(function collectPassage(passage) {
        return passage.textContent.trim();
    }).join(' ');
}

function handleNarrationEnd() {
    updateNarrationButton(false);
}

function handleReadClick() {
    if (!narrationSupported) {
        return;
    }

    if (narrationActive) {
        stopNarration();
        return;
    }

    const utterance = new SpeechSynthesisUtterance(collectNarration(pages[currentPageIndex]));
    utterance.rate = 0.88;
    utterance.pitch = 1.03;
    utterance.addEventListener('end', handleNarrationEnd);
    utterance.addEventListener('error', handleNarrationEnd);
    updateNarrationButton(true);
    window.speechSynthesis.speak(utterance);
}

function handleResize() {
    pages[currentPageIndex].scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'start' });
}

createProgressDots();
updateReaderState(0);

if (!narrationSupported) {
    readButton.hidden = true;
}

previousButton.addEventListener('click', handlePreviousClick);
nextButton.addEventListener('click', handleNextClick);
beginButton.addEventListener('click', handleBeginClick);
againButton.addEventListener('click', handleAgainClick);
brandLink.addEventListener('click', handleBrandClick);
readButton.addEventListener('click', handleReadClick);
progressDots.addEventListener('click', handleProgressClick);
storyTrack.addEventListener('scroll', handleTrackScroll, { passive: true });
window.addEventListener('keydown', handleKeydown);
window.addEventListener('resize', handleResize);
window.addEventListener('pagehide', stopNarration);
