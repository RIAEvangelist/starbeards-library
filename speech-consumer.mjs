export const JUJU_SPEECH_AUTHORITY_REQUIRED = 'ARCANE_AI_MODEL_AUTHORITY_REQUIRED';

const UNAVAILABLE_MESSAGE = 'Read aloud is unavailable until an approved local speech runtime, model, and voice authority is configured.';
const UNAVAILABLE_STATUS = Object.freeze(
    {
        available: false,
        code: JUJU_SPEECH_AUTHORITY_REQUIRED,
        message: UNAVAILABLE_MESSAGE
    }
);
let browserSpeechContractPromise = null;

function loadBrowserSpeechContract() {
    browserSpeechContractPromise ||= import('arcane-os/ai/browser-speech');
    return browserSpeechContractPromise;
}

function createAuthorityRequiredError() {
    const error = new Error(UNAVAILABLE_MESSAGE);

    error.name = 'JuJuSpeechAuthorityError';
    error.code = JUJU_SPEECH_AUTHORITY_REQUIRED;
    return error;
}

export function inspectJuJuSpeechConsumer() {
    return UNAVAILABLE_STATUS;
}

export async function createJuJuKokoroProvider(options = {}) {
    if (
        !options
        || typeof options !== 'object'
        || Array.isArray(options)
        || !options.model
        || !options.runtime
        || !options.store
    ) {
        throw createAuthorityRequiredError();
    }

    const browserSpeechContract = await loadBrowserSpeechContract();

    if (typeof browserSpeechContract.createBrowserKokoroProvider !== 'function') {
        throw new TypeError('The Arcane browser Kokoro provider contract is unavailable.');
    }

    return browserSpeechContract.createBrowserKokoroProvider(options);
}

function applySpeechUnavailableStatus(status) {
    const readButton = document.querySelector('#read-button');
    const readButtonLabel = document.querySelector('#read-button-label');
    const voiceControl = document.querySelector('#voice-control');
    const voiceSelect = document.querySelector('#voice-select');
    const narrationStatus = document.querySelector('#narration-status');

    if (readButton) {
        readButton.disabled = true;
        readButton.setAttribute('aria-pressed', 'false');
        readButton.setAttribute('aria-busy', 'false');
        readButton.setAttribute('aria-label', 'Read aloud unavailable');
        readButton.title = status.message;
    }

    if (readButtonLabel) {
        readButtonLabel.textContent = 'Read aloud unavailable';
    }

    if (voiceControl) {
        voiceControl.setAttribute('aria-disabled', 'true');
    }

    if (voiceSelect) {
        voiceSelect.disabled = true;
    }

    if (narrationStatus) {
        narrationStatus.dataset.speechStatusCode = status.code;
        narrationStatus.textContent = status.message;
    }
}

async function initializeJuJuSpeechConsumer() {
    applySpeechUnavailableStatus(UNAVAILABLE_STATUS);

    try {
        const browserSpeechContract = await loadBrowserSpeechContract();

        if (typeof browserSpeechContract.createBrowserKokoroProvider !== 'function') {
            throw new TypeError('The Arcane browser Kokoro provider contract is unavailable.');
        }
    } catch (error) {
        applySpeechUnavailableStatus(
            Object.freeze(
                {
                    available: false,
                    code: 'ARCANE_AI_SDK_UNAVAILABLE',
                    message: 'Read aloud is unavailable because the Arcane speech consumer could not load.'
                }
            )
        );
    }
}

function startJuJuSpeechConsumer() {
    initializeJuJuSpeechConsumer().catch(
        function handleSpeechConsumerInitializationFailure() {
            applySpeechUnavailableStatus(
                Object.freeze(
                    {
                        available: false,
                        code: 'ARCANE_AI_SDK_UNAVAILABLE',
                        message: 'Read aloud is unavailable because the Arcane speech consumer could not load.'
                    }
                )
            );
        }
    );
}

if (document.readyState === 'complete') {
    startJuJuSpeechConsumer();
} else {
    document.addEventListener(
        'DOMContentLoaded',
        startJuJuSpeechConsumer,
        {
            once: true
        }
    );
}
