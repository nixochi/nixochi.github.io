
export class interactionStateMachine{

    constructor(term, commandExecutor){
        this.term = term;
        this.commandExecutor = commandExecutor;
    }

    // Redraw the current line with cursor at correct position
    redrawLine() {
        this.term.write('\r\x1B[K$ ' + this.term.currentLine);
        const moveBack = this.term.currentLine.length - this.term.cursorPos;
        if (moveBack > 0) {
            this.term.write('\x1B[' + moveBack + 'D');
        }
    }

    // Exit animation mode
    exitAnimation() {
        // Stop the animator if it's running
        if (this.term.animator) {
            this.term.animator.stop();
            this.term.animator = null;
        }
        // Stop the permutahedron display if it's running
        // (The model keeps animating in the background)
        if (this.term.permutahedronInterval) {
            clearInterval(this.term.permutahedronInterval);
            this.term.permutahedronInterval = null;
            // Hide controls panel
            const controlsPanel = document.getElementById('permutahedron-controls');
            if (controlsPanel) controlsPanel.style.display = 'none';
            // Dispatch stop event for cursor management
            window.dispatchEvent(new Event('permutahedron-stop'));
        }
        this.term.reset();
        this.term.currentLine = '';
        this.term.cursorPos = 0;
        // Show cursor again
        this.term.write('\x1B[?25h');
        this.term.write('$ ');
        this.term.drawingState = "terminal";
    }

    handleInteraction(data){
        if (this.term.drawingState == "animation"){
            // If permutahedron is running and arrow keys are pressed, rotate instead of exit
            if (this.term.permutahedronInterval) {
                if (data === '\x1B[A') { // Up arrow
                    this.commandExecutor.permutahedronRenderer.rotateUp();
                    return;
                }
                else if (data === '\x1B[B') { // Down arrow
                    this.commandExecutor.permutahedronRenderer.rotateDown();
                    return;
                }
                else if (data === '\x1B[C') { // Right arrow
                    this.commandExecutor.permutahedronRenderer.rotateRight();
                    return;
                }
                else if (data === '\x1B[D') { // Left arrow
                    this.commandExecutor.permutahedronRenderer.rotateLeft();
                    return;
                }

                // Any other key exits animation mode
                this.exitAnimation();
                return;
            } else {
                // For other animations (non-permutahedron), exit on any key
                this.exitAnimation();
                return;
            }
        }

        else if (this.term.drawingState == "terminal"){

            const code = data.charCodeAt(0);

            // Handle Tab for autocomplete
            if (code === 9) { // Tab
                // Prevent default tab behavior (focus navigation)
                // Note: preventDefault is not directly available here, but xterm handles this
                if (this.term.currentLine.length > 0) {
                    const availableCommands = ['help', 'clear', 'date', 'whoami', 'permutahedron'];
                    const matches = availableCommands.filter(cmd => cmd.startsWith(this.term.currentLine));

                    if (matches.length === 1) {
                        // Autocomplete to the single match
                        this.term.currentLine = matches[0];
                        this.term.cursorPos = this.term.currentLine.length;
                        this.redrawLine();
                    } else if (matches.length > 1) {
                        // Multiple matches - show them
                        this.term.write('\r\n');
                        this.term.write(matches.join('  ') + '\r\n');
                        this.term.write('$ ' + this.term.currentLine);
                        this.term.cursorPos = this.term.currentLine.length;
                    }
                }
                return;
            }

            // Handle arrow keys (escape sequences)
            if (data === '\x1B[A') { // Up arrow
                if (this.term.commandHistory.length === 0) return;

                // Save current line if we're starting to browse history
                if (this.term.historyIndex === -1) {
                    this.term.tempLine = this.term.currentLine;
                    this.term.historyIndex = this.term.commandHistory.length;
                }

                // Move back in history
                if (this.term.historyIndex > 0) {
                    this.term.historyIndex--;
                    this.term.currentLine = this.term.commandHistory[this.term.historyIndex];
                    this.term.cursorPos = this.term.currentLine.length;
                    this.redrawLine();
                }
                return;
            }
            else if (data === '\x1B[B') { // Down arrow
                if (this.term.historyIndex === -1) return;

                // Move forward in history
                if (this.term.historyIndex < this.term.commandHistory.length - 1) {
                    this.term.historyIndex++;
                    this.term.currentLine = this.term.commandHistory[this.term.historyIndex];
                    this.term.cursorPos = this.term.currentLine.length;
                    this.redrawLine();
                } else {
                    // Back to the temp line
                    this.term.historyIndex = -1;
                    this.term.currentLine = this.term.tempLine;
                    this.term.cursorPos = this.term.currentLine.length;
                    this.redrawLine();
                }
                return;
            }
            else if (data === '\x1B[C') { // Right arrow
                if (this.term.cursorPos < this.term.currentLine.length) {
                    this.term.cursorPos++;
                    this.term.write('\x1B[C'); // Move cursor right
                }
                return;
            }
            else if (data === '\x1B[D') { // Left arrow
                if (this.term.cursorPos > 0) {
                    this.term.cursorPos--;
                    this.term.write('\x1B[D'); // Move cursor left
                }
                return;
            }

            // Handle Enter (carriage return)
            if (code === 13) {
                this.term.write('\r\n');
                if (this.term.currentLine.trim()) {
                    this.term.commandHistory.push(this.term.currentLine);
                    this.commandExecutor.executeCommand(this.term.currentLine);
                }

                this.term.currentLine = '';
                this.term.cursorPos = 0;
                this.term.historyIndex = -1;
                this.term.tempLine = '';
                if (this.term.drawingState == "terminal"){
                    this.term.write('$ ')
                };
            }
            // Handle Backspace (DEL)
            else if (code === 127) {
                if (this.term.cursorPos > 0) {
                    this.term.currentLine = this.term.currentLine.slice(0, this.term.cursorPos - 1) + this.term.currentLine.slice(this.term.cursorPos);
                    this.term.cursorPos--;
                    this.redrawLine();
                }
            }
            // Regular character input
            else if (code >= 32 || code === 9) { // Printable chars and tab
                // Insert character at cursor position
                this.term.currentLine = this.term.currentLine.slice(0, this.term.cursorPos) + data + this.term.currentLine.slice(this.term.cursorPos);
                this.term.cursorPos++;
                this.redrawLine();
                // Reset history navigation when typing
                this.term.historyIndex = -1;
            }
        }
    }

}