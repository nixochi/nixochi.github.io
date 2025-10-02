import { CanvasManager } from './core/canvas-manager.js';

// Initialize canvas
const canvas = document.getElementById('canvas');
const canvasManager = new CanvasManager(canvas);

// Mode switch
const pointBtn = document.getElementById('pointBtn');
const lineBtn = document.getElementById('lineBtn');
const switchIndicator = document.getElementById('switchIndicator');

function updateSwitchIndicator(activeBtn) {
    const btnRect = activeBtn.getBoundingClientRect();
    const switchRect = activeBtn.parentElement.getBoundingClientRect();
    const offset = btnRect.left - switchRect.left - 2;
    switchIndicator.style.width = `${btnRect.width}px`;
    switchIndicator.style.transform = `translateX(${offset}px)`;
}

// Initialize indicator position
updateSwitchIndicator(pointBtn);

pointBtn.addEventListener('click', () => {
    canvasManager.setMode('point');
    pointBtn.classList.add('active');
    lineBtn.classList.remove('active');
    updateSwitchIndicator(pointBtn);
});

lineBtn.addEventListener('click', () => {
    canvasManager.setMode('line');
    lineBtn.classList.add('active');
    pointBtn.classList.remove('active');
    updateSwitchIndicator(lineBtn);
});

// Options panel toggle
const optionsBtn = document.getElementById('optionsBtn');
const optionsPanel = document.getElementById('optionsPanel');
let isPanelVisible = false;

optionsBtn.addEventListener('click', () => {
    isPanelVisible = !isPanelVisible;
    if (isPanelVisible) {
        optionsPanel.style.display = 'block';
        // Force reflow before adding class for smooth animation
        optionsPanel.offsetHeight;
        optionsPanel.classList.add('expanded');
        optionsBtn.textContent = 'close';
    } else {
        optionsPanel.classList.remove('expanded');
        // Wait for animation to complete before hiding
        setTimeout(() => {
            if (!isPanelVisible) { // Check again in case user clicked during animation
                optionsPanel.style.display = 'none';
            }
        }, 300); // Match CSS transition duration
        optionsBtn.textContent = 'options';
    }
});

// Undo/Redo buttons
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');

function updateHistoryButtons() {
    undoBtn.disabled = !canvasManager.canUndo();
    redoBtn.disabled = !canvasManager.canRedo();
    undoBtn.style.opacity = canvasManager.canUndo() ? '1' : '0.5';
    redoBtn.style.opacity = canvasManager.canRedo() ? '1' : '0.5';
    undoBtn.style.cursor = canvasManager.canUndo() ? 'pointer' : 'not-allowed';
    redoBtn.style.cursor = canvasManager.canRedo() ? 'pointer' : 'not-allowed';
}

undoBtn.addEventListener('click', () => {
    canvasManager.undo();
    updateHistoryButtons();
});

redoBtn.addEventListener('click', () => {
    canvasManager.redo();
    updateHistoryButtons();
});

// Keyboard shortcuts for undo/redo
document.addEventListener('keydown', (e) => {
    // Check if Ctrl (Windows/Linux) or Cmd (Mac) is pressed
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifierKey = isMac ? e.metaKey : e.ctrlKey;

    if (modifierKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        canvasManager.undo();
        updateHistoryButtons();
    } else if (modifierKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        canvasManager.redo();
        updateHistoryButtons();
    }
});

// Ray opacity slider
const rayOpacitySlider = document.getElementById('rayOpacitySlider');
const rayOpacityValue = document.getElementById('rayOpacityValue');

rayOpacitySlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    const percentage = Math.round(value * 100);
    rayOpacityValue.textContent = `${percentage}%`;
    canvasManager.setRayOpacity(value);
});

// Clean button
const cleanBtn = document.getElementById('cleanBtn');
cleanBtn.addEventListener('click', () => {
    canvasManager.removeNonEssentialLines();
});

// Add intersections button
const addIntersectionsBtn = document.getElementById('addIntersectionsBtn');
addIntersectionsBtn.addEventListener('click', () => {
    canvasManager.addIntersectionPoints();
});

// Stats panel
let currentView = 'general';

// Pagination state
let paginationState = {
    bases: { offset: 0, batchSize: 50 },
    circuits: { offset: 0, batchSize: 50 },
    flats: { offset: 0, batchSize: 50 }
};

function resetPagination(view = null) {
    if (view) {
        paginationState[view].offset = 0;
    } else {
        // Reset all
        paginationState.bases.offset = 0;
        paginationState.circuits.offset = 0;
        paginationState.flats.offset = 0;
    }
}

function loadMoreItems() {
    const stats = canvasManager.getMatroidStats();
    if (!stats) return;

    const view = currentView;
    if (view === 'bases' || view === 'circuits' || view === 'flats') {
        const totalItems = stats[view].length;
        const currentLimit = paginationState[view].offset + paginationState[view].batchSize;

        // Only load more if there are more items to show
        if (currentLimit < totalItems) {
            paginationState[view].offset += paginationState[view].batchSize;
            updateStatsPanel();
        }
    }
}

function setupScrollListener() {
    const panelContent = document.getElementById('panelContent');

    // Remove existing listener to avoid duplicates
    panelContent.removeEventListener('scroll', handlePanelScroll);

    // Add new listener
    panelContent.addEventListener('scroll', handlePanelScroll);
}

function handlePanelScroll() {
    const panelContent = document.getElementById('panelContent');
    const scrollPercentage = (panelContent.scrollTop + panelContent.clientHeight) / panelContent.scrollHeight;

    // Load more when scrolled 80% down
    if (scrollPercentage > 0.8) {
        loadMoreItems();
    }
}

function updateStatsPanel() {
    const stats = canvasManager.getMatroidStats();
    const panelContent = document.getElementById('panelContent');

    if (!stats) {
        panelContent.innerHTML = '<div class="empty-state">add points and lines to see matroid properties</div>';
        return;
    }

    if (currentView === 'general') {
        panelContent.innerHTML = `
            <div style="font-size: 13px; line-height: 1.6;">
                <div><strong>rank:</strong> ${stats.rank}</div>
                <div><strong>points:</strong> ${stats.numPoints}</div>
                <div><strong>lines:</strong> ${stats.numLines}</div>
                <div><strong>bases:</strong> ${stats.bases.length}</div>
                <div><strong>circuits:</strong> ${stats.circuits.length}</div>
                <div><strong>flats:</strong> ${stats.flats.length}</div>
            </div>
        `;
    } else if (currentView === 'bases') {
        if (stats.bases.length === 0) {
            panelContent.innerHTML = '<div class="empty-state">no bases yet</div>';
        } else {
            const limit = paginationState.bases.offset + paginationState.bases.batchSize;
            const visibleBases = stats.bases.slice(0, limit);
            const basesHtml = visibleBases.map((base) =>
                `<div class="matroid-item" data-points="${base.join(',')}" style="padding: 8px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.15s ease;">{${base.join(', ')}}</div>`
            ).join('');
            const countHtml = `<div style="padding: 8px; color: var(--fg-secondary); font-size: 12px;">showing ${visibleBases.length} of ${stats.bases.length}</div>`;
            panelContent.innerHTML = basesHtml + countHtml;
            attachHoverListeners();
            setupScrollListener();
        }
    } else if (currentView === 'circuits') {
        if (stats.circuits.length === 0) {
            panelContent.innerHTML = '<div class="empty-state">no circuits yet</div>';
        } else {
            const limit = paginationState.circuits.offset + paginationState.circuits.batchSize;
            const visibleCircuits = stats.circuits.slice(0, limit);
            const circuitsHtml = visibleCircuits.map((circuit) =>
                `<div class="matroid-item" data-points="${circuit.join(',')}" style="padding: 8px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.15s ease;">{${circuit.join(', ')}}</div>`
            ).join('');
            const countHtml = `<div style="padding: 8px; color: var(--fg-secondary); font-size: 12px;">showing ${visibleCircuits.length} of ${stats.circuits.length}</div>`;
            panelContent.innerHTML = circuitsHtml + countHtml;
            attachHoverListeners();
            setupScrollListener();
        }
    } else if (currentView === 'flats') {
        if (stats.flats.length === 0) {
            panelContent.innerHTML = '<div class="empty-state">no flats yet</div>';
        } else {
            const limit = paginationState.flats.offset + paginationState.flats.batchSize;
            const visibleFlats = stats.flats.slice(0, limit);
            const flatsHtml = visibleFlats.map((flat) =>
                `<div class="matroid-item" data-points="${flat.join(',')}" style="padding: 8px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.15s ease;">{${flat.join(', ')}}</div>`
            ).join('');
            const countHtml = `<div style="padding: 8px; color: var(--fg-secondary); font-size: 12px;">showing ${visibleFlats.length} of ${stats.flats.length}</div>`;
            panelContent.innerHTML = flatsHtml + countHtml;
            attachHoverListeners();
            setupScrollListener();
        }
    }
}

function attachHoverListeners() {
    const items = document.querySelectorAll('.matroid-item');

    items.forEach(item => {
        item.addEventListener('mouseenter', () => {
            const pointsStr = item.getAttribute('data-points');
            if (pointsStr) {
                const points = pointsStr.split(',').map(Number).filter(n => !isNaN(n));
                canvasManager.setHoveredPoints(points);
            }
            item.style.background = 'color-mix(in srgb, var(--bg-secondary) 90%, var(--fg-primary) 10%)';
        });

        item.addEventListener('mouseleave', () => {
            canvasManager.clearHoveredPoints();
            item.style.background = 'transparent';
        });

        // Clear highlighting on touch/click outside
        item.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });
}

// Clear highlighting when clicking anywhere outside matroid items
document.addEventListener('click', () => {
    canvasManager.clearHoveredPoints();
    // Also clear background from all items
    document.querySelectorAll('.matroid-item').forEach(item => {
        item.style.background = 'transparent';
    });
});

// Clear matroid item backgrounds when touching canvas (preventDefault blocks click event)
canvas.addEventListener('touchstart', () => {
    document.querySelectorAll('.matroid-item').forEach(item => {
        item.style.background = 'transparent';
    });
});

canvas.addEventListener('mousedown', () => {
    document.querySelectorAll('.matroid-item').forEach(item => {
        item.style.background = 'transparent';
    });
});

// Stats dropdown
const dropdownTrigger = document.getElementById('dropdownTrigger');
const dropdownContent = document.getElementById('dropdownContent');
const dropdownLabel = document.getElementById('dropdownLabel');
const dropdownItems = dropdownContent.querySelectorAll('.dropdown-item');
let isDropdownOpen = false;

dropdownTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    isDropdownOpen = !isDropdownOpen;

    if (isDropdownOpen) {
        dropdownTrigger.classList.add('open');
        dropdownContent.classList.add('open');
    } else {
        dropdownTrigger.classList.remove('open');
        dropdownContent.classList.remove('open');
    }
});

document.addEventListener('click', (e) => {
    if (!dropdownTrigger.contains(e.target) && !dropdownContent.contains(e.target)) {
        isDropdownOpen = false;
        dropdownTrigger.classList.remove('open');
        dropdownContent.classList.remove('open');
    }
});

dropdownItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.stopPropagation();
        const value = item.getAttribute('data-value');

        dropdownItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        dropdownLabel.textContent = value;
        currentView = value;

        // Reset pagination when switching views
        resetPagination(value);
        updateStatsPanel();

        isDropdownOpen = false;
        dropdownTrigger.classList.remove('open');
        dropdownContent.classList.remove('open');
    });
});

// Wire up state change callback
canvasManager.onStateChange = () => {
    resetPagination(); // Reset all pagination when configuration changes
    updateStatsPanel();
    updateHistoryButtons();
};

// Initial update
updateStatsPanel();
updateHistoryButtons();

// Panel resize behavior
const statsPanel = document.getElementById('statsPanel');
const resizeHandle = document.getElementById('resizeHandle');

let isResizing = false;
let startPos = 0;
let startSize = 0;

function isMobile() {
    return window.innerWidth <= 768;
}

function handleResizeStart(e) {
    isResizing = true;
    document.body.classList.add('resizing');

    const touch = e.type.includes('touch') ? e.touches[0] : e;

    if (isMobile()) {
        startPos = touch.clientY;
        startSize = statsPanel.offsetHeight;
    } else {
        startPos = touch.clientX;
        startSize = statsPanel.offsetWidth;
    }

    e.preventDefault();
}

function handleResizeMove(e) {
    if (!isResizing) return;

    e.preventDefault();

    const touch = e.type.includes('touch') ? e.touches[0] : e;

    if (isMobile()) {
        const currentY = touch.clientY;
        const deltaY = startPos - currentY; // Inverted because dragging up increases height

        const newHeight = startSize + deltaY;
        const minHeight = 150;
        // Use visualViewport for iOS compatibility, fallback to window.innerHeight
        const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        const maxHeight = viewportHeight * 0.8;
        const clampedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

        statsPanel.style.height = `${clampedHeight}px`;
    } else {
        const currentX = touch.clientX;
        const deltaX = startPos - currentX; // Inverted because dragging left increases width

        const newWidth = startSize + deltaX;
        const minWidth = 250;
        const maxWidth = window.innerWidth * 0.6;
        const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

        statsPanel.style.width = `${clampedWidth}px`;
    }
}

function handleResizeEnd(e) {
    if (!isResizing) return;

    isResizing = false;
    document.body.classList.remove('resizing');
}

// Touch events
resizeHandle.addEventListener('touchstart', handleResizeStart, { passive: false });
document.addEventListener('touchmove', handleResizeMove, { passive: false });
document.addEventListener('touchend', handleResizeEnd);
document.addEventListener('touchcancel', handleResizeEnd);

// Mouse events
resizeHandle.addEventListener('mousedown', handleResizeStart);
document.addEventListener('mousemove', handleResizeMove);
document.addEventListener('mouseup', handleResizeEnd);

// Examples modal
const examplesBtn = document.getElementById('examplesBtn');
const examplesModal = document.getElementById('examplesModal');
const closeModal = document.getElementById('closeModal');
const examplesGrid = document.getElementById('examplesGrid');

function openExamplesModal() {
    examplesModal.classList.add('active');
    document.body.classList.add('modal-open');
}

function closeExamplesModal() {
    examplesModal.classList.remove('active');
    document.body.classList.remove('modal-open');
}

examplesBtn.addEventListener('click', () => {
    openExamplesModal();
    loadExamples();
});

closeModal.addEventListener('click', closeExamplesModal);

examplesModal.addEventListener('click', (e) => {
    if (e.target === examplesModal) {
        closeExamplesModal();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && examplesModal.classList.contains('active')) {
        closeExamplesModal();
    }
});

async function loadExamples() {
    try {
        const response = await fetch('src/examples/examples.json');
        if (!response.ok) throw new Error('Failed to load examples');

        const examples = await response.json();

        examplesGrid.innerHTML = '';
        Object.keys(examples).forEach(key => {
            const example = examples[key];
            const card = document.createElement('div');
            card.className = 'example-card';
            card.dataset.example = key;

            card.innerHTML = `<div class="example-name">${example.name}</div>`;

            card.addEventListener('click', async () => {
                await canvasManager.loadConfiguration(key);
                closeExamplesModal();
            });

            examplesGrid.appendChild(card);
        });
    } catch (e) {
        console.error('Failed to load examples:', e);
        examplesGrid.innerHTML = '<div style="color: var(--fg-secondary); text-align: center;">Failed to load examples</div>';
    }
}
