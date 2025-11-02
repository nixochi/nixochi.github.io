// Debug console for capturing logs and errors
let debugLogs = [];
const originalLog = console.log;
const originalError = console.error;

function formatTimestamp() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${h}:${m}:${s}.${ms}`;
}

function addDebugEntry(type, args) {
    const timestamp = formatTimestamp();
    const message = Array.from(args).map(arg => {
        if (typeof arg === 'object') {
            try {
                return JSON.stringify(arg, null, 2);
            } catch (e) {
                return String(arg);
            }
        }
        return String(arg);
    }).join(' ');

    debugLogs.push({ timestamp, type, message });

    const debugOutput = document.getElementById('debug-output');
    if (debugOutput) {
        const entry = document.createElement('div');
        entry.className = `debug-entry ${type}`;

        const timestampSpan = document.createElement('span');
        timestampSpan.className = 'timestamp';
        timestampSpan.textContent = timestamp;

        const messageSpan = document.createElement('span');
        messageSpan.textContent = message;

        entry.appendChild(timestampSpan);
        entry.appendChild(messageSpan);
        debugOutput.appendChild(entry);

        // Auto-scroll to bottom
        debugOutput.scrollTop = debugOutput.scrollHeight;
    }
}

// Intercept console.log
console.log = function(...args) {
    originalLog.apply(console, args);
    addDebugEntry('log', args);
};

// Intercept console.error
console.error = function(...args) {
    originalError.apply(console, args);
    addDebugEntry('error', args);
};

// Intercept window errors
window.addEventListener('error', (event) => {
    const message = `${event.message} at ${event.filename}:${event.lineno}:${event.colno}`;
    console.error(message);
});

// Intercept unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});

// Setup buttons
document.addEventListener('DOMContentLoaded', () => {
    const copyButton = document.getElementById('copy-logs');
    const clearButton = document.getElementById('clear-logs');

    if (copyButton) {
        copyButton.addEventListener('click', () => {
            const text = debugLogs.map(log =>
                `[${log.timestamp}] ${log.type.toUpperCase()}: ${log.message}`
            ).join('\n');

            navigator.clipboard.writeText(text).then(() => {
                const originalText = copyButton.textContent;
                copyButton.textContent = 'Copied!';
                setTimeout(() => {
                    copyButton.textContent = originalText;
                }, 1000);
            }).catch(err => {
                console.error('Failed to copy logs:', err);
            });
        });
    }

    if (clearButton) {
        clearButton.addEventListener('click', () => {
            debugLogs = [];
            const debugOutput = document.getElementById('debug-output');
            if (debugOutput) {
                debugOutput.innerHTML = '';
            }
        });
    }
});
