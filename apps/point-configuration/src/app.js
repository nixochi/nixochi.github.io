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
            const basesHtml = stats.bases.map((base, idx) =>
                `<div class="matroid-item" data-points="${base.join(',')}" style="padding: 8px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.15s ease;">{${base.join(', ')}}</div>`
            ).join('');
            panelContent.innerHTML = basesHtml;
            attachHoverListeners();
        }
    } else if (currentView === 'circuits') {
        if (stats.circuits.length === 0) {
            panelContent.innerHTML = '<div class="empty-state">no circuits yet</div>';
        } else {
            const circuitsHtml = stats.circuits.map((circuit, idx) =>
                `<div class="matroid-item" data-points="${circuit.join(',')}" style="padding: 8px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.15s ease;">{${circuit.join(', ')}}</div>`
            ).join('');
            panelContent.innerHTML = circuitsHtml;
            attachHoverListeners();
        }
    } else if (currentView === 'flats') {
        if (stats.flats.length === 0) {
            panelContent.innerHTML = '<div class="empty-state">no flats yet</div>';
        } else {
            const flatsHtml = stats.flats.map((flat, idx) =>
                `<div class="matroid-item" data-points="${flat.join(',')}" style="padding: 8px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.15s ease;">{${flat.join(', ')}}</div>`
            ).join('');
            panelContent.innerHTML = flatsHtml;
            attachHoverListeners();
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

        updateStatsPanel();

        isDropdownOpen = false;
        dropdownTrigger.classList.remove('open');
        dropdownContent.classList.remove('open');
    });
});

// Wire up state change callback
canvasManager.onStateChange = updateStatsPanel;

// Initial update
updateStatsPanel();

// Mobile panel drag behavior
const statsPanel = document.getElementById('statsPanel');
const panelHeader = document.getElementById('panelHeader');
const dragHandle = document.querySelector('.drag-handle');

let isDragging = false;
let startY = 0;
let currentY = 0;
let panelStartTranslate = 0;

function isMobile() {
    return window.innerWidth <= 768;
}

function handleDragStart(e) {
    if (!isMobile()) return;

    isDragging = true;
    statsPanel.classList.add('dragging');

    const touch = e.type.includes('touch') ? e.touches[0] : e;
    startY = touch.clientY;

    // Get current translate value
    const isCollapsed = statsPanel.classList.contains('collapsed');
    const panelHeight = statsPanel.offsetHeight;
    panelStartTranslate = isCollapsed ? panelHeight - 102 : 0;
}

function handleDragMove(e) {
    if (!isDragging || !isMobile()) return;

    e.preventDefault();

    const touch = e.type.includes('touch') ? e.touches[0] : e;
    currentY = touch.clientY;

    const deltaY = currentY - startY;
    const newTranslate = Math.max(0, Math.min(statsPanel.offsetHeight - 102, panelStartTranslate + deltaY));

    statsPanel.style.transform = `translateY(${newTranslate}px)`;
}

function handleDragEnd(e) {
    if (!isDragging || !isMobile()) return;

    isDragging = false;
    statsPanel.classList.remove('dragging');

    const deltaY = currentY - startY;
    const panelHeight = statsPanel.offsetHeight;
    const currentTranslate = panelStartTranslate + deltaY;

    // Determine final state based on position and direction
    const threshold = (panelHeight - 102) / 2;

    if (currentTranslate > threshold) {
        // Collapse
        statsPanel.classList.add('collapsed');
        statsPanel.classList.remove('expanded');
    } else {
        // Expand
        statsPanel.classList.remove('collapsed');
        statsPanel.classList.add('expanded');
    }

    // Reset inline transform to use CSS classes
    statsPanel.style.transform = '';
}

// Touch events
dragHandle.addEventListener('touchstart', handleDragStart, { passive: false });
document.addEventListener('touchmove', handleDragMove, { passive: false });
document.addEventListener('touchend', handleDragEnd);
document.addEventListener('touchcancel', handleDragEnd);

// Mouse events (for testing on desktop)
dragHandle.addEventListener('mousedown', handleDragStart);
document.addEventListener('mousemove', handleDragMove);
document.addEventListener('mouseup', handleDragEnd);
