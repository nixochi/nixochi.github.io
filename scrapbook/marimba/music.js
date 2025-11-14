(function() {
    'use strict';

    window.musicState = window.musicState || {
        visualObj: null,
        synthControl: null,
        timingCallbacks: null,
        midiToFace: {},
        charToNote: {},
        isPlaying: false,
        currentAbcText: '',
        isLoading: false,
        abortController: null
    };

    const state = window.musicState;

    function buildMidiToFaceMapping(abcString) {
        const tunes = ABCJS.parseOnly(abcString);

        if (!tunes || tunes.length === 0) {
            return {};
        }

        const tune = tunes[0];

        const uniqueMidiPitches = new Set();
        const charToNote = {};

        tune.lines.forEach((line) => {
            if (line.staff) {
                line.staff.forEach((staff) => {
                    staff.voices.forEach((voice) => {
                        voice.forEach((element) => {
                            if (element.el_type === 'note' && element.pitches) {
                                if (typeof element.startChar === 'number') {
                                    charToNote[element.startChar] = element;
                                }

                                element.pitches.forEach(pitch => {
                                    uniqueMidiPitches.add(pitch.pitch);
                                });
                            }
                        });
                    });
                });
            }
        });

        const sortedMidiPitches = Array.from(uniqueMidiPitches).sort((a, b) => a - b);

        const midiToFace = {};

        sortedMidiPitches.forEach((midiPitch, index) => {
            if (index < 14) {
                midiToFace[midiPitch] = index;
            }
        });

        state.charToNote = charToNote;

        return midiToFace;
    }

    function eventCallback(ev) {
        if (!ev) {
            // End of song - turn off all faces
            if (window.faceStates) {
                window.faceStates.fill(false);
                window.updateFaceColors();
            }
            return;
        }

        if (window.faceStates) {
            window.faceStates.fill(false);

            const currentPitches = [];

            if (typeof ev.startChar === 'number' && state.charToNote) {
                const noteElement = state.charToNote[ev.startChar];
                if (noteElement && noteElement.pitches) {
                    noteElement.pitches.forEach(pitch => {
                        if (pitch && typeof pitch.pitch === 'number') {
                            currentPitches.push(pitch.pitch);
                        }
                    });
                }
            }

            currentPitches.forEach(midiPitch => {
                const faceIndex = state.midiToFace[midiPitch];
                if (faceIndex !== undefined) {
                    window.faceStates[faceIndex] = true;
                }
            });

            window.updateFaceColors();
        }
    }

    async function loadSong(filename) {
        if (state.isLoading) {
            state.abortController?.abort();
        }

        state.isLoading = true;
        state.abortController = new AbortController();

        const playButton = document.getElementById('play-button');

        if (playButton) {
            playButton.disabled = true;
            playButton.textContent = 'Loading...';
        }

        try {
            stopMusic();

            const response = await fetch(`songs/${filename}`, {
                signal: state.abortController.signal
            });
            if (!response.ok) {
                throw new Error(`Failed to load song: ${response.statusText}`);
            }
            const abcText = await response.text();
            state.currentAbcText = abcText;

            state.midiToFace = buildMidiToFaceMapping(abcText);

            if (window.faceStates) {
                window.faceStates.fill(false);
                window.updateFaceColors();
            }

            state.visualObj = ABCJS.renderAbc("audio", abcText)[0];

            // Initialize and prime the synth immediately
            if (!ABCJS.synth.supportsAudio()) {
                throw new Error('Audio not supported in this browser');
            }

            state.timingCallbacks = new ABCJS.TimingCallbacks(state.visualObj, {
                eventCallback: eventCallback
            });

            state.synthControl = new ABCJS.synth.CreateSynth();

            await state.synthControl.init({
                visualObj: state.visualObj,
                options: {
                    program: 0, // Piano sound
                    chordsOff: false
                }
            });

            await state.synthControl.prime();

            if (playButton) {
                playButton.textContent = 'Play';
                playButton.disabled = false;
            }
        } catch (error) {
            if (error.name === 'AbortError') return;

            if (playButton) {
                playButton.textContent = 'Load Failed';
                playButton.disabled = true;
            }
            alert(`Failed to load song: ${error.message}`);
        } finally {
            state.isLoading = false;
        }
    }

    async function playMusic() {
        try {
            if (!state.visualObj || !state.currentAbcText || !state.synthControl) {
                return;
            }

            if (state.isPlaying) {
                return;
            }

            state.timingCallbacks.start();
            await state.synthControl.start();

            state.isPlaying = true;

            const playButton = document.getElementById('play-button');
            if (playButton) {
                playButton.textContent = 'Pause';
            }
        } catch (error) {
            alert('Error playing music: ' + error.message);
        }
    }

    function stopMusic() {
        if (state.synthControl) {
            try {
                state.synthControl.stop();
            } catch (e) {}
            state.synthControl = null;
        }
        if (state.timingCallbacks) {
            try {
                state.timingCallbacks.stop();
            } catch (e) {}
            state.timingCallbacks = null;
        }
        state.isPlaying = false;

        if (window.faceStates) {
            window.faceStates.fill(false);
            window.updateFaceColors();
        }

        const playButton = document.getElementById('play-button');
        if (playButton) {
            playButton.textContent = 'Play';
        }
    }

    function togglePlayPause() {
        if (state.isLoading) return;

        if (state.isPlaying) {
            stopMusic();
        } else {
            playMusic();
        }
    }

    function waitForABCJS(callback, attempts = 0) {
        if (typeof ABCJS !== 'undefined') {
            callback();
        } else if (attempts > 50) {
            alert('Failed to load music library. Please refresh the page.');
        } else {
            setTimeout(() => waitForABCJS(callback, attempts + 1), 100);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        waitForABCJS(() => {
            const songSelect = document.getElementById('song-select');
            const playButton = document.getElementById('play-button');

            if (songSelect) {
                songSelect.addEventListener('change', (e) => {
                    loadSong(e.target.value);
                });
            }

            if (playButton) {
                playButton.addEventListener('click', togglePlayPause);
            }

            window.addEventListener('blur', () => {
                if (state.isPlaying) {
                    stopMusic();
                }
            });
            loadSong('example.abc');
        });
    });
})();
