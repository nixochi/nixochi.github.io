class PlanarGraph {
    constructor() {
        this.nodes = [];
        this.edges = [];
        this.nextNodeId = 0;
        this.minSeparation = 40; // Minimum distance between node centers
    }

    addNode(x, y) {
        const node = {
            id: this.nextNodeId++,
            x: x,
            y: y,
            radius: 15
        };
        this.nodes.push(node);
        return node;
    }

    // Check if a position is too close to any existing nodes
    // Returns the closest node that violates minimum separation, or null if OK
    checkMinimumSeparation(x, y, excludeNodeId = null) {
        for (let node of this.nodes) {
            if (excludeNodeId !== null && node.id === excludeNodeId) {
                continue;
            }

            const dx = x - node.x;
            const dy = y - node.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < this.minSeparation) {
                return node;
            }
        }
        return null;
    }

    // Update node position if it doesn't violate minimum separation or cause intersections
    updateNodePosition(nodeId, x, y) {
        const node = this.getNode(nodeId);
        if (!node) return false;

        // Check if new position violates minimum separation
        const violation = this.checkMinimumSeparation(x, y, nodeId);
        if (violation) {
            return false;
        }

        // Save old position
        const oldX = node.x;
        const oldY = node.y;

        // Temporarily update position
        node.x = x;
        node.y = y;

        // Check if any edges connected to this node would now intersect with other edges
        const connectedEdges = this.getEdges(nodeId);
        for (let connectedEdge of connectedEdges) {
            const edgeFrom = this.getNode(connectedEdge.from);
            const edgeTo = this.getNode(connectedEdge.to);

            if (!edgeFrom || !edgeTo) continue;

            // Check against all other edges
            for (let otherEdge of this.edges) {
                // Skip the same edge
                if (connectedEdge === otherEdge) continue;

                // Skip edges that share a node with this edge
                if (otherEdge.from === connectedEdge.from ||
                    otherEdge.from === connectedEdge.to ||
                    otherEdge.to === connectedEdge.from ||
                    otherEdge.to === connectedEdge.to) {
                    continue;
                }

                const otherFrom = this.getNode(otherEdge.from);
                const otherTo = this.getNode(otherEdge.to);

                if (otherFrom && otherTo) {
                    if (this.segmentsIntersect(edgeFrom, edgeTo, otherFrom, otherTo)) {
                        // Intersection detected - restore old position
                        node.x = oldX;
                        node.y = oldY;
                        return false;
                    }
                }
            }
        }

        // No intersections - keep new position
        return true;
    }

    addEdge(nodeId1, nodeId2) {
        const edge = {
            from: nodeId1,
            to: nodeId2
        };
        this.edges.push(edge);
        return edge;
    }

    hasEdge(nodeId1, nodeId2) {
        return this.edges.some(e =>
            (e.from === nodeId1 && e.to === nodeId2) ||
            (e.from === nodeId2 && e.to === nodeId1)
        );
    }

    // Check if two line segments intersect
    // Returns true if segments (p1,p2) and (p3,p4) intersect
    segmentsIntersect(p1, p2, p3, p4) {
        const ccw = (A, B, C) => {
            return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
        };

        // Check if segments share an endpoint (this is OK in a graph)
        if ((p1.x === p3.x && p1.y === p3.y) ||
            (p1.x === p4.x && p1.y === p4.y) ||
            (p2.x === p3.x && p2.y === p3.y) ||
            (p2.x === p4.x && p2.y === p4.y)) {
            return false;
        }

        return ccw(p1, p3, p4) !== ccw(p2, p3, p4) &&
               ccw(p1, p2, p3) !== ccw(p1, p2, p4);
    }

    // Check if adding an edge would create intersections
    // Returns array of edges that would intersect with the new edge
    checkIntersections(fromNodeId, toNodeId) {
        // Check if edge already exists
        if (this.hasEdge(fromNodeId, toNodeId)) {
            // Return the existing edge as a "conflict"
            const existingEdge = this.edges.find(e =>
                (e.from === fromNodeId && e.to === toNodeId) ||
                (e.from === toNodeId && e.to === fromNodeId)
            );
            return existingEdge ? [existingEdge] : [];
        }

        const fromNode = this.getNode(fromNodeId);
        const toNode = this.getNode(toNodeId);

        if (!fromNode || !toNode) {
            return [];
        }

        const conflictingEdges = [];

        for (let edge of this.edges) {
            const edgeFrom = this.getNode(edge.from);
            const edgeTO = this.getNode(edge.to);

            if (edgeFrom && edgeTO) {
                if (this.segmentsIntersect(fromNode, toNode, edgeFrom, edgeTO)) {
                    conflictingEdges.push(edge);
                }
            }
        }

        return conflictingEdges;
    }

    getNodeAt(x, y) {
        for (let node of this.nodes) {
            const dx = x - node.x;
            const dy = y - node.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= node.radius) {
                return node;
            }
        }
        return null;
    }

    removeNode(nodeId) {
        this.nodes = this.nodes.filter(n => n.id !== nodeId);
        this.edges = this.edges.filter(e => e.from !== nodeId && e.to !== nodeId);
    }

    removeEdge(nodeId1, nodeId2) {
        this.edges = this.edges.filter(e =>
            !(e.from === nodeId1 && e.to === nodeId2) &&
            !(e.from === nodeId2 && e.to === nodeId1)
        );
    }

    getNode(nodeId) {
        return this.nodes.find(n => n.id === nodeId);
    }

    getEdges(nodeId) {
        return this.edges.filter(e => e.from === nodeId || e.to === nodeId);
    }
}
