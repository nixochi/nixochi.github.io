(function() {
    'use strict';

    window.musicState = window.musicState || {
        visualObj: null,
        synthController: null,
        midiBuffer: null,
        midiToFace: {},
        isPlaying: false,
        currentAbcText: '',
        isLoading: false,
        abortController: null,
        currentNotes: new Set(),
        noteTimeouts: new Map(),
        playbackStartTime: null
    };

    const state = window.musicState;

    function clearAllNotes() {
        // Clear all scheduled timeouts
        state.noteTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        state.noteTimeouts.clear();
        state.currentNotes.clear();
        updateDisplay();
    }

    function updateDisplay() {
        if (!window.faceStates) return;

        // Clear all faces
        window.faceStates.fill(false);

        // Light up currently playing notes
        state.currentNotes.forEach(midiPitch => {
            const faceIndex = state.midiToFace[midiPitch];
            if (faceIndex !== undefined) {
                window.faceStates[faceIndex] = true;
            }
        });

        window.updateFaceColors();
    }

    // CursorControl - the CORRECT way to get note events in ABCJS
    var CursorControl = function() {
        var self = this;

        self.onStart = function() {
            console.log('Playback started');
            state.isPlaying = true;
            // Clear any leftover notes from previous playback
            clearAllNotes();
            // Reset timing
            state.playbackStartTime = Date.now();
            const playButton = document.getElementById('play-button');
            if (playButton) {
                playButton.textContent = 'Pause';
            }
        };

        self.onFinished = function() {
            console.log('Playback finished');
            state.isPlaying = false;
            clearAllNotes();
            const playButton = document.getElementById('play-button');
            if (playButton) {
                playButton.textContent = 'Play';
            }
        };

        self.onBeat = function(beatNumber, totalBeats, totalTime) {
            // Called on each beat
        };

        self.onEvent = function(ev) {
            // Ignore events before playback has started
            if (!state.playbackStartTime) {
                return;
            }

            // DON'T clear currentNotes - let timeouts handle removing notes!

            if (ev.midiPitches && ev.midiPitches.length > 0) {
                ev.midiPitches.forEach(function(midiNote) {
                    const pitch = midiNote.pitch;

                    // Add note to currently playing
                    state.currentNotes.add(pitch);

                    // Clear any existing timeout for this pitch (re-triggered note)
                    if (state.noteTimeouts.has(pitch)) {
                        clearTimeout(state.noteTimeouts.get(pitch));
                    }

                    // Calculate note duration in milliseconds
                    const durationMs = midiNote.duration * ev.millisecondsPerMeasure;

                    // Schedule removing the note when it ends
                    const timeoutId = setTimeout(function() {
                        state.currentNotes.delete(pitch);
                        state.noteTimeouts.delete(pitch);
                        updateDisplay();
                    }, durationMs);

                    state.noteTimeouts.set(pitch, timeoutId);
                });
            }

            updateDisplay();
        };
    };

    async function loadSong(filename) {
        if (state.isLoading) {
            state.abortController?.abort();
        }

        state.isLoading = true;
        state.abortController = new AbortController();

        const playButton = document.getElementById('play-button');

        try {
            stopMusic();

            // Clear ALL state from previous song
            clearAllNotes();
            state.playbackStartTime = null;

            // Set button to Loading AFTER stopMusic (which sets it to Play)
            if (playButton) {
                playButton.disabled = true;
                playButton.textContent = 'Loading';
            }

            const response = await fetch(`songs/${filename}?t=${Date.now()}`, {
                signal: state.abortController.signal,
                cache: 'no-store'
            });
            if (!response.ok) {
                throw new Error(`Failed to load song: ${response.statusText}`);
            }
            const abcText = await response.text();
            state.currentAbcText = abcText;

            if (window.faceStates) {
                window.faceStates.fill(false);
                window.updateFaceColors();
            }

            // Render ABC to hidden div
            state.visualObj = ABCJS.renderAbc("audio", abcText)[0];

            if (!ABCJS.synth.supportsAudio()) {
                throw new Error('Audio not supported in this browser');
            }

            // Create MIDI buffer with sequenceCallback to build note mapping
            console.log('Creating MIDI buffer...');
            state.midiBuffer = new ABCJS.synth.CreateSynth();

            await state.midiBuffer.init({
                visualObj: state.visualObj,
                options: {
                    program: 0, // Piano
                    chordsOff: false,
                    sequenceCallback: function(tracks) {
                        // Extract unique pitches and build midiToFace mapping
                        const uniquePitches = new Set();

                        tracks.forEach(track => {
                            track.forEach(event => {
                                if (event.pitch !== undefined) {
                                    uniquePitches.add(event.pitch);
                                }
                            });
                        });

                        // Build MIDI to face mapping from actual pitches used
                        const sortedPitches = Array.from(uniquePitches).sort((a, b) => a - b);
                        const numFaces = 14;
                        state.midiToFace = {};
                        sortedPitches.forEach((pitch, index) => {
                            state.midiToFace[pitch] = index % numFaces;
                        });

                        console.log(`Mapped ${sortedPitches.length} unique pitches to ${numFaces} faces`);
                    }
                }
            });

            await state.midiBuffer.prime();
            console.log('MIDI buffer ready');

            // Create SynthController with CursorControl
            if (!state.synthController) {
                console.log('Creating SynthController...');
                state.synthController = new ABCJS.synth.SynthController();

                // Load with cursor control but hide the auto-generated controls
                state.synthController.load("#audio-controls", new CursorControl(), {
                    displayLoop: false,
                    displayRestart: false,
                    displayPlay: false,  // We have our own play button
                    displayProgress: false,
                    displayWarp: false
                });
            }

            // Set the tune - tempo should be read from Q: field automatically
            console.log('Setting tune in controller...');
            const tempo = state.visualObj.getBpm();
            console.log('Tempo from Q: field:', tempo);
            await state.synthController.setTune(state.visualObj, true);

            if (playButton) {
                playButton.disabled = false;
                playButton.textContent = 'Play';
            }
        } catch (error) {
            if (error.name === 'AbortError') return;

            if (playButton) {
                playButton.disabled = true;
                playButton.textContent = 'Load Failed';
            }
            console.error('Failed to load song:', error);
        } finally {
            state.isLoading = false;
        }
    }

    async function playMusic() {
        if (!state.synthController || state.isPlaying) {
            return;
        }

        try {
            // SynthController handles play/pause internally
            state.synthController.play();
        } catch (error) {
            console.error('Error playing music:', error);
        }
    }

    function pauseMusic() {
        if (!state.synthController) return;

        try {
            state.synthController.pause();
            state.isPlaying = false;
            state.currentNotes.clear();

            if (window.faceStates) {
                window.faceStates.fill(false);
                window.updateFaceColors();
            }

            const playButton = document.getElementById('play-button');
            if (playButton) {
                playButton.textContent = 'Play';
            }
        } catch (e) {
            console.error('Error pausing:', e);
        }
    }

    function stopMusic() {
        if (state.synthController) {
            try {
                state.synthController.pause();
                state.synthController.seek(0);
            } catch (e) {}
        }

        state.isPlaying = false;
        clearAllNotes();

        const playButton = document.getElementById('play-button');
        if (playButton) {
            playButton.textContent = 'Play';
        }
    }

    function togglePlayPause() {
        if (state.isLoading) return;

        if (state.isPlaying) {
            pauseMusic();
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
        const startOverlay = document.getElementById('start-overlay');

        if (startOverlay) {
            startOverlay.addEventListener('click', () => {
                startOverlay.classList.add('hidden');

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

                    // Clear notes when user switches tabs/windows
                    window.addEventListener('blur', () => {
                        clearAllNotes();
                    });

                    loadSong('cello-suite.abc');
                });
            });
        }
    });
})();
