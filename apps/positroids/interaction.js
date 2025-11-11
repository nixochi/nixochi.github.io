class GraphRenderer {
    constructor(canvas, graph) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.graph = graph;
        this.highlightedNode = null;
        this.selectedNode = null;
        this.conflictingEdges = [];
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const width = window.innerWidth || document.documentElement.clientWidth;
        const height = window.innerHeight || document.documentElement.clientHeight;

        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        this.ctx.scale(dpr, dpr);
        this.render();
    }

    setHighlightedNode(node) {
        this.highlightedNode = node;
        this.render();
    }

    setSelectedNode(node) {
        this.selectedNode = node;
        this.render();
    }

    setConnectionMode(isConnectionMode, mouseX, mouseY) {
        this.isConnectionMode = isConnectionMode;
        this.connectionMouseX = mouseX;
        this.connectionMouseY = mouseY;
        this.render();
    }

    setConflictingEdges(edges) {
        this.conflictingEdges = edges;
        this.render();
    }

    render() {
        const ctx = this.ctx;

        // Clear canvas with dark background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw edges
        ctx.lineWidth = 2;
        for (let edge of this.graph.edges) {
            const fromNode = this.graph.nodes.find(n => n.id === edge.from);
            const toNode = this.graph.nodes.find(n => n.id === edge.to);
            if (fromNode && toNode) {
                // Check if this edge is conflicting
                const isConflicting = this.conflictingEdges.some(ce =>
                    (ce.from === edge.from && ce.to === edge.to) ||
                    (ce.from === edge.to && ce.to === edge.from)
                );

                ctx.strokeStyle = isConflicting ? '#ff0000' : '#ffffff';
                ctx.beginPath();
                ctx.moveTo(fromNode.x, fromNode.y);
                ctx.lineTo(toNode.x, toNode.y);
                ctx.stroke();
            }
        }

        // Draw temporary edge in connection mode
        if (this.isConnectionMode && this.selectedNode) {
            // Red if there are conflicts, white otherwise
            ctx.strokeStyle = this.conflictingEdges.length > 0 ? '#ff0000' : '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.selectedNode.x, this.selectedNode.y);
            ctx.lineTo(this.connectionMouseX, this.connectionMouseY);
            ctx.stroke();
        }

        // Draw nodes
        for (let node of this.graph.nodes) {
            const isHighlighted = this.highlightedNode && this.highlightedNode.id === node.id;
            const isSelected = this.selectedNode && this.selectedNode.id === node.id;
            const isHighlightedInConnectionMode = isHighlighted && this.isConnectionMode;

            // Outer glow
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius + (isSelected || isHighlighted ? 6 : 3), 0, Math.PI * 2);
            if (isSelected || isHighlightedInConnectionMode) {
                ctx.fillStyle = 'rgba(255, 215, 0, 0.5)';
            } else if (isHighlighted) {
                ctx.fillStyle = 'rgba(74, 158, 255, 0.5)';
            } else {
                ctx.fillStyle = 'rgba(74, 158, 255, 0.3)';
            }
            ctx.fill();

            // Main circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            if (isSelected || isHighlightedInConnectionMode) {
                ctx.fillStyle = '#3a3a2a';
            } else if (isHighlighted) {
                ctx.fillStyle = '#3a3a3a';
            } else {
                ctx.fillStyle = '#2a2a2a';
            }
            ctx.fill();

            // Border
            if (isSelected || isHighlightedInConnectionMode) {
                ctx.strokeStyle = '#ffd700';
            } else if (isHighlighted) {
                ctx.strokeStyle = '#6ab9ff';
            } else {
                ctx.strokeStyle = '#4a9eff';
            }
            ctx.lineWidth = isSelected || isHighlighted ? 3 : 2;

            ctx.stroke();
        }
    }
}

// Initialize
const canvas = document.getElementById('canvas');
const graph = new PlanarGraph();
const renderer = new GraphRenderer(canvas, graph);
const nodeCountEl = document.getElementById('nodeCount');

// State machine
let state = 'idle'; // 'idle', 'connection', or 'dragging'
let selectedNode = null;
let mousePos = { x: 0, y: 0 };
let mouseDownPos = null;
let mouseDownNode = null;
let hasMoved = false;

// Highlight threshold distance (basically node radius + small buffer)
const HIGHLIGHT_THRESHOLD = 20;
const DRAG_THRESHOLD = 5; // Minimum pixels to move before it's considered a drag

// Find nearest node within threshold
function findNearestNode(x, y) {
    let nearestNode = null;
    let minDistance = HIGHLIGHT_THRESHOLD;

    for (let node of graph.nodes) {
        const dx = x - node.x;
        const dy = y - node.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance) {
            minDistance = distance;
            nearestNode = node;
        }
    }

    return nearestNode;
}

// Get coordinates from event
function getCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    let x, y;

    if (e.type.startsWith('touch')) {
        const touch = e.touches[0] || e.changedTouches[0];
        x = touch.clientX - rect.left;
        y = touch.clientY - rect.top;
    } else {
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;
    }

    return { x, y };
}

// Mousemove handler for highlighting
function handleMove(e) {
    const { x, y } = getCoordinates(e);
    mousePos.x = x;
    mousePos.y = y;

    // Check if we're dragging
    if (mouseDownPos && mouseDownNode && !hasMoved) {
        const dx = x - mouseDownPos.x;
        const dy = y - mouseDownPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > DRAG_THRESHOLD) {
            // Started dragging
            hasMoved = true;
            state = 'dragging';
            selectedNode = mouseDownNode;
            renderer.setSelectedNode(mouseDownNode);
        }
    }

    // Handle dragging
    if (state === 'dragging' && selectedNode) {
        graph.updateNodePosition(selectedNode.id, x, y);
        renderer.render();
        return;
    }

    const nearestNode = findNearestNode(x, y);
    renderer.setHighlightedNode(nearestNode);

    // Update temporary edge in connection mode
    if (state === 'connection') {
        renderer.setConnectionMode(true, x, y);

        // Check for intersections if hovering over a node
        if (nearestNode && nearestNode.id !== selectedNode.id) {
            const conflicts = graph.checkIntersections(selectedNode.id, nearestNode.id);
            renderer.setConflictingEdges(conflicts);
        } else {
            renderer.setConflictingEdges([]);
        }
    } else {
        // Clear conflicting edges when not in connection mode
        renderer.setConflictingEdges([]);
    }
}

canvas.addEventListener('mousemove', handleMove);
canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    handleMove(e);
}, { passive: false });

// Mousedown handler
function handleMouseDown(e) {
    e.preventDefault();

    const { x, y } = getCoordinates(e);
    const clickedNode = findNearestNode(x, y);

    mouseDownPos = { x, y };
    mouseDownNode = clickedNode;
    hasMoved = false;
}

// Mouseup handler
function handleMouseUp(e) {
    e.preventDefault();

    const { x, y } = getCoordinates(e);
    const clickedNode = findNearestNode(x, y);

    // If we were dragging, just exit dragging state
    if (state === 'dragging') {
        state = 'idle';
        selectedNode = null;
        renderer.setSelectedNode(null);
        mouseDownPos = null;
        mouseDownNode = null;
        return;
    }

    // If we didn't move, it's a click
    if (!hasMoved) {
        if (state === 'idle') {
            if (mouseDownNode) {
                // Clicked on an existing node - enter connection mode
                state = 'connection';
                selectedNode = mouseDownNode;
                renderer.setSelectedNode(mouseDownNode);
                renderer.setConnectionMode(true, x, y);
            } else {
                // Clicked on empty space - add new node (check minimum separation)
                const violation = graph.checkMinimumSeparation(x, y);
                if (!violation) {
                    graph.addNode(x, y);
                    nodeCountEl.textContent = `Nodes: ${graph.nodes.length}`;
                    renderer.render();
                }
            }
        } else if (state === 'connection') {
            if (clickedNode && clickedNode.id !== selectedNode.id) {
                // Check if creating this edge would cause intersections
                const conflicts = graph.checkIntersections(selectedNode.id, clickedNode.id);

                if (conflicts.length === 0) {
                    // No conflicts - create edge and exit connection mode
                    graph.addEdge(selectedNode.id, clickedNode.id);
                    state = 'idle';
                    selectedNode = null;
                    renderer.setSelectedNode(null);
                    renderer.setConnectionMode(false, 0, 0);
                    renderer.setConflictingEdges([]);
                    renderer.render();
                } else {
                    // Has conflicts - just exit connection mode without creating edge
                    state = 'idle';
                    selectedNode = null;
                    renderer.setSelectedNode(null);
                    renderer.setConnectionMode(false, 0, 0);
                    renderer.setConflictingEdges([]);
                }
            } else {
                // Clicked on same node or empty space - just exit connection mode
                state = 'idle';
                selectedNode = null;
                renderer.setSelectedNode(null);
                renderer.setConnectionMode(false, 0, 0);
                renderer.setConflictingEdges([]);
            }
        }
    }

    mouseDownPos = null;
    mouseDownNode = null;
}

canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mouseup', handleMouseUp);
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleMouseDown(e);
}, { passive: false });
canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    handleMouseUp(e);
}, { passive: false });

// Initial render
renderer.render();
