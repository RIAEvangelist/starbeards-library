import {createBrowserSpeechSynthesisProvider} from 'arcane-os/ai/browser-speech';
import SpeechPlayback from 'arcane-os/speech-playback';

const ARCANE_SDK_VERSION = '0.54.0';

export function createJuJuSpeech({onState, onVoices}) {
    const provider = createBrowserSpeechSynthesisProvider(
        {
            id: 'juju-grand-adventures-web-speech',
            model: {
                id: 'juju-browser-voices',
                name: 'Browser voices'
            }
        }
    );
    const playback = new SpeechPlayback(
        {
            audio: document.createElement('audio'),
            speech: provider,
            speed: 0.95,
            onState
        }
    );
    let unsubscribeVoices = null;
    let disposed = false;

    async function initialize() {
        await provider.load();

        if (disposed) {
            return;
        }

        unsubscribeVoices = provider.subscribeCatalog(
            function updateJuJuVoices(catalog) {
                onVoices(catalog[0].voices);
            }
        );
    }

    function read({passages, voice = null}) {
        return playback.prepare(
            {
                parts: passages.map(
                    function describeJuJuPassage(passage) {
                        return {
                            input: passage.text,
                            pauseAfterMs: passage.pauseMs
                        };
                    }
                ),
                voice: voice || null,
                autoplay: true
            }
        );
    }

    function stop() {
        playback.stop();
    }

    async function dispose() {
        if (disposed) {
            return;
        }

        disposed = true;
        unsubscribeVoices?.();
        playback.destroy();
        await provider.dispose();
    }

    function inspect() {
        return {
            sdkVersion: ARCANE_SDK_VERSION,
            provider: provider.status(),
            playbackState: playback.state,
            voices: provider.catalog()[0].voices
        };
    }

    return {initialize, read, stop, dispose, inspect};
}
