// This file is in charge of handling commands
import { Animator } from './animator.js';
import { PermutahedronRenderer } from './permutahedronRenderer.js';

export class commandHandler{

    constructor(terminal){
        this.term = terminal;
        this.term.animator = null;
        this.term.permutahedronInterval = null;
        this.permutahedronRenderer = new PermutahedronRenderer('glCanvas', terminal.cols, terminal.rows);
        this.permutahedronRenderer.init();
    }
    executeCommand(input){
        const parts = input.trim().split(' ');
        const cmd = parts[0];
        const args = parts.slice(1);

        switch (cmd){
            case 'help':
                this.term.write('Available commands:\r\n');
                this.term.write('  help          - Show this help message\r\n');
                this.term.write('  clear         - Clear the terminal\r\n');
                this.term.write('  date          - Show current date and time\r\n');
                this.term.write('  whoami        - Show current user\r\n');
                this.term.write('  permutahedron - Toggle permutahedron (drag to rotate, ESC to exit)\r\n');
                break;
            case 'clear':
                this.term.clear();
                break;
            case 'date':
                this.term.write(new Date().toString() + '\r\n');
                break;
            case 'whoami':
                const colors = [196, 202, 208, 214, 220, 226, 190, 154, 118, 82, 46, 47,
                        48, 51, 87, 123, 117, 105, 99, 141, 177, 213, 207, 201, 200, 199,
                        198, 197, 9, 10, 11, 13, 14, 166, 172];
                const color = colors[Math.floor(Math.random()* colors.length)];
                this.term.write(`i don't know but not \x1B[38;5;${color}mxochi\x1B[0m\r\n`);
                break;
            case 'permutahedron':
                if (this.term.permutahedronInterval !== null) {
                    // Stop permutahedron display (model keeps animating)
                    clearInterval(this.term.permutahedronInterval);
                    this.term.permutahedronInterval = null;
                    this.term.drawingState = "terminal";
                    this.term.write('\x1B[?25h'); // Show cursor
                    this.term.clear();
                    this.term.write('$ ');
                    window.dispatchEvent(new Event('permutahedron-stop'));
                } else {
                    // Start permutahedron display (model is already animating)
                    this.term.drawingState = "animation";
                    this.term.currentLine = '';
                    this.term.cursorPos = 0;
                    this.term.tempLine = '';
                    this.term.write('\x1B[?25l'); // Hide cursor

                    const renderFrame = () => {
                        // Just sample the current frame from the model
                        const frame = this.permutahedronRenderer.generateFrame();
                        // Move cursor to top-left without clearing (no flicker)
                        this.term.write('\x1B[H' + frame);
                    };

                    // Clear once at start, then render using dynamic FPS from config
                    this.term.clear();
                    const fps = this.permutahedronRenderer.config.fps;
                    this.term.permutahedronInterval = setInterval(renderFrame, 1000 / fps);
                    window.dispatchEvent(new Event('permutahedron-start'));
                }
                break;

            default:
                this.term.write(`Command not found: ${cmd}\r\n`);
                this.term.write('Type "help" for available commands\r\n');
        }
    }
}