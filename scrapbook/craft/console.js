export function setupDebugConsole() {
  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    #debug-console {
      position: fixed;
      bottom: 10px;
      right: 10px;
      width: 400px;
      max-height: 300px;
      background: rgba(0, 0, 0, 0.85);
      color: #0f0;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      padding: 10px;
      overflow-y: auto;
      border: 1px solid #333;
      border-radius: 5px;
      z-index: 10000;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    }
    #debug-console .log {
      color: #0f0;
      margin: 2px 0;
    }
    #debug-console .error {
      color: #f00;
      margin: 2px 0;
      font-weight: bold;
    }
    #debug-console .warn {
      color: #ff0;
      margin: 2px 0;
    }
    #debug-console .clear-btn {
      position: absolute;
      top: 5px;
      right: 50px;
      background: #333;
      color: #fff;
      border: none;
      padding: 2px 8px;
      cursor: pointer;
      font-size: 10px;
      border-radius: 3px;
    }
    #debug-console .clear-btn:hover {
      background: #555;
    }
    #debug-console .copy-btn {
      position: absolute;
      top: 5px;
      right: 5px;
      background: #333;
      color: #fff;
      border: none;
      padding: 2px 8px;
      cursor: pointer;
      font-size: 10px;
      border-radius: 3px;
    }
    #debug-console .copy-btn:hover {
      background: #555;
    }
  `;
  document.head.appendChild(style);

  // Add HTML
  const consoleDiv = document.createElement('div');
  consoleDiv.id = 'debug-console';
  consoleDiv.innerHTML = `
    <button class="clear-btn" onclick="document.getElementById('debug-log').innerHTML = ''">Clear</button>
    <button class="copy-btn" onclick="copyDebugLog()">Copy</button>
    <div id="debug-log"></div>
  `;
  document.body.appendChild(consoleDiv);

  // Setup console capture
  const debugLog = document.getElementById('debug-log');
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  function addToDebug(message, type = 'log') {
    const entry = document.createElement('div');
    entry.className = type;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    debugLog.appendChild(entry);
    debugLog.scrollTop = debugLog.scrollHeight;
  }

  window.copyDebugLog = function() {
    const text = debugLog.innerText;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.querySelector('.copy-btn');
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = original; }, 1000);
    });
  };

  console.log = function(...args) {
    originalLog.apply(console, args);
    addToDebug(args.join(' '), 'log');
  };

  console.error = function(...args) {
    originalError.apply(console, args);
    addToDebug(args.join(' '), 'error');
  };

  console.warn = function(...args) {
    originalWarn.apply(console, args);
    addToDebug(args.join(' '), 'warn');
  };

  // Capture uncaught errors
  window.addEventListener('error', (e) => {
    addToDebug(`ERROR: ${e.message} at ${e.filename}:${e.lineno}`, 'error');
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (e) => {
    addToDebug(`PROMISE REJECTION: ${e.reason}`, 'error');
  });
}
