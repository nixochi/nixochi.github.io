/**
 * Mouse and touch interaction handlers
 */

/**
 * Get canvas coordinates from mouse/touch event
 */
export function getCanvasCoords(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    return { x, y };
}

/**
 * Find a seed at given coordinates
 */
export function findSeedAt(sites, x, y, threshold = 25) {
    for (let i = 0; i < sites.length; i++) {
        const dx = sites[i].x - x;
        const dy = sites[i].y - y;
        if (dx * dx + dy * dy < threshold * threshold) {
            return i;
        }
    }
    return -1;
}

/**
 * Setup mouse and touch interactions for the canvas
 */
export function setupInteractions(canvas, callbacks) {
    const {
        onDragStart,
        onDragMove,
        onDragEnd,
        onAddSite
    } = callbacks;

    let dragIndex = -1;
    let isDragging = false;

    // Mouse events
    canvas.addEventListener('mousedown', (e) => {
        const { x, y } = getCanvasCoords(canvas, e);
        const W = canvas.width;
        const H = canvas.height;
        if (x < 0 || x >= W || y < 0 || y >= H) return;

        dragIndex = onDragStart(x, y);
        if (dragIndex >= 0) {
            isDragging = false;
            canvas.style.cursor = 'grabbing';
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (dragIndex >= 0) {
            isDragging = true;
            const { x, y } = getCanvasCoords(canvas, e);
            const W = canvas.width;
            const H = canvas.height;
            const clampedX = Math.max(0, Math.min(W - 1, x));
            const clampedY = Math.max(0, Math.min(H - 1, y));
            onDragMove(dragIndex, clampedX, clampedY);
        }
    });

    canvas.addEventListener('mouseup', () => {
        if (dragIndex >= 0) {
            dragIndex = -1;
            canvas.style.cursor = 'crosshair';
            onDragEnd();
        }
    });

    canvas.addEventListener('mouseleave', () => {
        if (dragIndex >= 0) {
            dragIndex = -1;
            canvas.style.cursor = 'crosshair';
            isDragging = false;
            onDragEnd();
        }
    });

    canvas.addEventListener('click', (e) => {
        if (isDragging) {
            isDragging = false;
            return;
        }
        const { x, y } = getCanvasCoords(canvas, e);
        const W = canvas.width;
        const H = canvas.height;
        if (x >= 0 && x < W && y >= 0 && y < H) {
            onAddSite(x, y);
        }
    });

    // Touch events for iOS/mobile support
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent scrolling
        const touch = e.touches[0];
        const { x, y } = getCanvasCoords(canvas, touch);
        const W = canvas.width;
        const H = canvas.height;
        if (x < 0 || x >= W || y < 0 || y >= H) return;

        dragIndex = onDragStart(x, y);
        if (dragIndex >= 0) {
            isDragging = false;
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (dragIndex >= 0) {
            e.preventDefault(); // Prevent scrolling while dragging
            isDragging = true;
            const touch = e.touches[0];
            const { x, y } = getCanvasCoords(canvas, touch);
            const W = canvas.width;
            const H = canvas.height;
            const clampedX = Math.max(0, Math.min(W - 1, x));
            const clampedY = Math.max(0, Math.min(H - 1, y));
            onDragMove(dragIndex, clampedX, clampedY);
        }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        if (dragIndex >= 0) {
            e.preventDefault();
            dragIndex = -1;
            isDragging = false;
            onDragEnd();
        } else if (e.changedTouches.length > 0) {
            // Handle tap to add new point
            const touch = e.changedTouches[0];
            const { x, y } = getCanvasCoords(canvas, touch);
            const W = canvas.width;
            const H = canvas.height;
            if (x >= 0 && x < W && y >= 0 && y < H) {
                onAddSite(x, y);
            }
        }
    }, { passive: false });

    canvas.addEventListener('touchcancel', () => {
        if (dragIndex >= 0) {
            dragIndex = -1;
            isDragging = false;
            onDragEnd();
        }
    });

    console.log('✅ Interactions setup complete');

    return {
        getDragIndex: () => dragIndex,
        getIsDragging: () => isDragging
    };
}
