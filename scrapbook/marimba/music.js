// Music playback using abcjs
(function() {
    'use strict';

    // Music state
    window.musicState = window.musicState || {
        visualObj: null,
        synthControl: null,
        timingCallbacks: null,
        midiToFace: {},
        charToNote: {},
        currentSongName: 'example.abc',
        isPlaying: false,
        currentAbcText: '',
        visualOffset: 0, // ms to offset visual from audio (negative = visual ahead, positive = visual behind)
        debug: false // Debug logging disabled by default
    };

    const state = window.musicState;

    // Expose offset adjustment function globally
    window.setVisualOffset = function(ms) {
        state.visualOffset = ms;
        console.log(`Visual offset set to ${ms}ms`);
    };

    // Enable debug mode to see all events
    window.enableDebug = function() {
        state.debug = true;
        console.log('Debug mode enabled - will log all note events');
    };

    window.disableDebug = function() {
        state.debug = false;
        console.log('Debug mode disabled');
    };

    // Build MIDI to Face mapping and character position lookup
    function buildMidiToFaceMapping(abcString) {
        try {
            const tunes = ABCJS.parseOnly(abcString);

            if (!tunes || tunes.length === 0) {
                console.error('Failed to parse ABC notation');
                return {};
            }

            const tune = tunes[0];

            // Collect all unique MIDI pitches and build character position lookup
            const uniqueMidiPitches = new Set();
            const charToNote = {}; // Maps startChar to note element

            tune.lines.forEach((line) => {
                if (line.staff) {
                    line.staff.forEach((staff) => {
                        staff.voices.forEach((voice) => {
                            voice.forEach((element) => {
                                if (element.el_type === 'note' && element.pitches) {
                                    // Store element by its start character position
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

            // Store the character lookup in the state
            state.charToNote = charToNote;

            // Log mapping stats
            console.log(`Song loaded: ${sortedMidiPitches.length} unique notes`);
            console.log('Note to Face mapping:',
                sortedMidiPitches.map((pitch, i) => `Note ${pitch} → Face ${i}`).join(', '));
            console.log(`Character lookup has ${Object.keys(charToNote).length} entries`);

            return midiToFace;
        } catch (e) {
            console.error('Error building MIDI mapping:', e);
            throw e;
        }
    }

    // Event callback for timing
    function eventCallback(ev) {
        if (!ev) {
            // End of song - turn off all faces
            if (window.faceStates) {
                window.faceStates.fill(false);
                window.updateFaceColors();
            }
            return;
        }

        // Apply visual offset if needed
        const updateVisual = () => {
            // Turn off all faces first
            if (window.faceStates) {
                window.faceStates.fill(false);

                // Extract MIDI pitches using character position lookup
                const currentPitches = [];

                // Use startChar to look up the note
                if (typeof ev.startChar === 'number' && state.charToNote) {
                    const noteElement = state.charToNote[ev.startChar];
                    if (noteElement && noteElement.pitches) {
                        noteElement.pitches.forEach(pitch => {
                            if (pitch && typeof pitch.pitch === 'number') {
                                currentPitches.push(pitch.pitch);
                            }
                        });
                    } else if (state.debug) {
                        console.log(`No note found for startChar ${ev.startChar}`, ev);
                    }
                } else if (state.debug) {
                    console.log('Event missing startChar:', ev);
                }

                if (state.debug && currentPitches.length > 0) {
                    console.log(`Playing pitches: ${currentPitches.join(', ')} at ${ev.milliseconds}ms`);
                }

                // Light up corresponding faces
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
        };

        // Apply offset (positive = delay visual, negative = advance visual)
        if (state.visualOffset !== 0) {
            setTimeout(updateVisual, state.visualOffset);
        } else {
            updateVisual();
        }
    }

    // Load song (doesn't auto-play)
    async function loadSong(filename) {
        try {
            // Stop current playback
            stopMusic();

            const response = await fetch(`songs/${filename}`);
            if (!response.ok) {
                throw new Error(`Failed to load song: ${response.statusText}`);
            }
            const abcText = await response.text();
            state.currentAbcText = abcText;

            // Build MIDI to face mapping
            state.midiToFace = buildMidiToFaceMapping(abcText);

            // Turn off all faces
            if (window.faceStates) {
                window.faceStates.fill(false);
                window.updateFaceColors();
            }

            // Render ABC to create visualObj
            state.visualObj = ABCJS.renderAbc("audio", abcText, {
                add_classes: true
            })[0];

            state.currentSongName = filename;

            // Update button
            const playButton = document.getElementById('play-button');
            if (playButton) {
                playButton.textContent = 'Play';
                playButton.disabled = false;
            }
        } catch (error) {
            console.error('Error loading song:', error);
        }
    }

    // Play the current song
    async function playMusic() {
        try {
            if (!state.visualObj || !state.currentAbcText) {
                console.error('No song loaded');
                return;
            }

            if (state.isPlaying) {
                return;
            }

            // Check audio support
            if (!ABCJS.synth.supportsAudio()) {
                console.error('Audio not supported in this browser');
                alert('Audio not supported in this browser');
                return;
            }

            // Create timing callbacks
            state.timingCallbacks = new ABCJS.TimingCallbacks(state.visualObj, {
                eventCallback: eventCallback
            });

            // Create synth
            state.synthControl = new ABCJS.synth.CreateSynth();

            await state.synthControl.init({
                visualObj: state.visualObj,
                options: {
                    program: 0, // Piano sound
                    chordsOff: false
                }
            });

            await state.synthControl.prime();

            // Start playback
            state.timingCallbacks.start();
            await state.synthControl.start();

            state.isPlaying = true;

            // Update button
            const playButton = document.getElementById('play-button');
            if (playButton) {
                playButton.textContent = 'Pause';
            }
        } catch (error) {
            console.error('Error playing music:', error);
            alert('Error playing music: ' + error.message);
        }
    }

    // Stop music
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

        // Turn off all faces
        if (window.faceStates) {
            window.faceStates.fill(false);
            window.updateFaceColors();
        }

        // Update button
        const playButton = document.getElementById('play-button');
        if (playButton) {
            playButton.textContent = 'Play';
        }
    }

    // Toggle play/pause
    function togglePlayPause() {
        if (state.isPlaying) {
            stopMusic();
        } else {
            playMusic();
        }
    }

    // Wait for ABCJS to be available
    function waitForABCJS(callback, attempts = 0) {
        if (typeof ABCJS !== 'undefined') {
            callback();
        } else if (attempts > 50) {  // 5 seconds timeout
            console.error('ABCJS failed to load after 5 seconds');
            alert('Failed to load music library. Please refresh the page.');
        } else {
            setTimeout(() => waitForABCJS(callback, attempts + 1), 100);
        }
    }

    // Setup controls
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

            // Pause when window loses focus
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

            // Load default song (but don't play yet)
            loadSong(state.currentSongName);
        });
    });
})();
