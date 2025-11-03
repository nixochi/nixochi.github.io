(function() {
    'use strict';

    window.musicState = window.musicState || {
        visualObj: null,
        synthControl: null,
        timingCallbacks: null,
        midiToFace: {},
        charToNote: {},
        currentSongName: 'example.abc',
        isPlaying: false,
        currentAbcText: ''
    };

    const state = window.musicState;

    function buildMidiToFaceMapping(abcString) {
        try {
            const tunes = ABCJS.parseOnly(abcString);

            if (!tunes || tunes.length === 0) {
                console.error('Failed to parse ABC notation');
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
        } catch (e) {
            console.error('Error building MIDI mapping:', e);
            throw e;
        }
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

            if (currentPitches.length > 0) {
                currentPitches.forEach(midiPitch => {
                    if (state.midiToFace.hasOwnProperty(midiPitch)) {
                        const faceIndex = state.midiToFace[midiPitch];
                        window.faceStates[faceIndex] = true;
                    }
                });
            }

            window.updateFaceColors();
        }
    }

    async function loadSong(filename) {
        try {
            stopMusic();

            const response = await fetch(`songs/${filename}`);
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

            state.visualObj = ABCJS.renderAbc("audio", abcText, {
                add_classes: true
            })[0];

            state.currentSongName = filename;

            const playButton = document.getElementById('play-button');
            if (playButton) {
                playButton.textContent = 'Play';
                playButton.disabled = false;
            }
        } catch (error) {
            console.error('Error loading song:', error);
        }
    }

    async function playMusic() {
        try {
            if (!state.visualObj || !state.currentAbcText) {
                console.error('No song loaded');
                return;
            }

            if (state.isPlaying) {
                return;
            }

            if (!ABCJS.synth.supportsAudio()) {
                console.error('Audio not supported in this browser');
                alert('Audio not supported in this browser');
                return;
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

            state.timingCallbacks.start();
            await state.synthControl.start();

            state.isPlaying = true;

            const playButton = document.getElementById('play-button');
            if (playButton) {
                playButton.textContent = 'Pause';
            }
        } catch (error) {
            console.error('Error playing music:', error);
            alert('Error playing music: ' + error.message);
        }
    }

    function stopMusic() {
        if (state.synthControl) {
            try {
                state.synthControl.stop();
            } catch (e) {
                console.error('Error stopping synth:', e);
            }
            state.synthControl = null;
        }
        if (state.timingCallbacks) {
            try {
                state.timingCallbacks.stop();
            } catch (e) {
                console.error('Error stopping timing:', e);
            }
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
            console.error('ABCJS failed to load after 5 seconds');
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
                    stopMusic();
                    loadSong(e.target.value);
                });
            }

            if (playButton) {
                playButton.addEventListener('click', togglePlayPause);
            }

            document.addEventListener('visibilitychange', () => {
                if (document.hidden && state.isPlaying) {
                    stopMusic();
                }
            });

            window.addEventListener('blur', () => {
                if (state.isPlaying) {
                    stopMusic();
                }
            });
            loadSong(state.currentSongName);
        });
    });
})();
