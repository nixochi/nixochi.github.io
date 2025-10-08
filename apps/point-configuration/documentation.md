# Complete Architecture Documentation - State/Derived/View/Controller

## Overview of the Architecture

This application uses a clear separation between **State**, **Derived**, **View**, and **Controller** layers.

### The Four Layers

#### 1. **STATE** (Primary State)
The source of truth. These are values that are **manually changed** by controllers in response to user actions.

**Examples:**
- `Configuration` - Points and lines data
- `HistoryState` - Undo/redo action stack
- `InteractionState` - Current interaction (idle, dragging, drawing line)
- `TransformState` - Pan and zoom values
- `UIState` - UI settings (color palette, ray opacity, which stats view)

**Key Properties:**
- Modified by Controllers only
- Never computed - always explicitly set
- Observable - notify observers when changed
- Serializable - can be saved/loaded

#### 2. **DERIVED** (Computed State)
Values that are **automatically computed** from primary state. Never modified directly.

**Examples:**
- `IntersectionsComputer` - Line intersections (computed from Configuration)
- `HighlightsComputer` - Which points/lines to highlight (computed from InteractionState + UIState + SnapPreview)
- `SnapPreviewComputer` - Current snap target (computed from mouse position + Configuration)
- `VisualOverlaysComputer` - Ghost points, preview lines (computed from InteractionState)
- `MatroidComputer` - Matroid properties (computed from Configuration)

**Key Properties:**
- Pure functions that take state references and compute results
- No caching, no dirty flags - just recompute when needed
- Called by Views during render
- Never modify any state

#### 3. **VIEW** (Presentation)
Renders the UI based on state and derived state. Never modifies state directly.

**Examples:**
- `CanvasView` - Renders the canvas
- `StatsView` - Renders the stats panel HTML
- `DebugMenuView` - Renders the debug panel HTML
- `Renderer` - Low-level drawing primitives

**Key Properties:**
- Read from State and Derived
- Never modify state (except through callbacks)
- Triggered by app.js when state changes
- Stateless - all display info comes from State/Derived

#### 4. **CONTROLLER** (Input Handlers)
Handle user input and modify primary state accordingly. Never directly trigger renders.

**Examples:**
- `InteractionController` - Mouse/touch input → modifies InteractionState, Configuration
- `HistoryController` - Undo/redo commands → modifies Configuration via HistoryState
- `OperationsController` - Complex operations (clean, add intersections) → modifies Configuration
- `UIController` - Button clicks, sliders → modifies UIState, InteractionState

**Key Properties:**
- Only layer that modifies State
- Never read from Derived (only from State)
- Never call render directly
- Translate user actions into state changes

---

## Data Flow

```
User Input
    ↓
CONTROLLER modifies STATE
    ↓
STATE notifies observers
    ↓
app.js calls render()
    ↓
VIEW calls DERIVED.compute()
    ↓
DERIVED reads STATE and computes
    ↓
VIEW renders using STATE + DERIVED results
```

### Example: User Clicks Canvas

```
1. User clicks at (100, 200)
   ↓
2. InteractionController.handleMouseDown()
   - Calls transformState.screenToWorld() to get world coords
   - Calls configuration.getPointsAtPosition() to check for existing point
   - If no point found:
     * Calls interactionState.transitionTo('placingPoint', {x, y})
   ↓
3. InteractionState notifies observers
   ↓
4. app.js receives notification, calls render()
   ↓
5. CanvasView.render() is called
   - Calls snapPreviewComputer.compute() → gets snap target
   - Calls highlightsComputer.compute() → gets highlights
   - Calls visualOverlaysComputer.compute() → gets overlays
   - Draws everything using these computed values
```

### Example: User Hovers Over Base in Stats Panel

```
1. User hovers over "{0, 1, 2}" in bases list
   ↓
2. StatsView fires hover callback with [0, 1, 2]
   ↓
3. UIController.onStatsItemHover([0, 1, 2])
   - Calls uiState.setHoveredPointsFromUI([0, 1, 2])
   ↓
4. UIState notifies observers
   ↓
5. app.js receives notification, calls render()
   ↓
6. CanvasView.render() is called
   - Calls highlightsComputer.compute()
     * Reads uiState.hoveredPointsFromUI → [0, 1, 2]
     * Returns {points: Set([0,1,2]), lines: Set(...)}
   - Draws with highlights applied
```

---

## Key Design Principles

### 1. **Single Source of Truth**
Each piece of data has ONE authoritative location:
- Point positions? → `Configuration.points`
- Current mouse position? → `InteractionState.mousePosition`
- Highlighted points? → Computed by `HighlightsComputer` (NOT stored)

### 2. **Unidirectional Data Flow**
Data flows in one direction:
```
STATE → DERIVED → VIEW
  ↑
CONTROLLER
```

Never:
- VIEW → STATE (views don't modify state)
- DERIVED → STATE (derived never modifies state)
- CONTROLLER → DERIVED (controllers don't read derived)

### 3. **No Caching (YAGNI)**
Derived computers always recompute. No dirty flags, no caching.

**Why?** 
- Simpler code
- No cache invalidation bugs
- Fast enough for this app (< 1000 points/lines)
- If we need optimization later, we can add it

### 4. **Observers for Decoupling**
State doesn't know about Views. Views don't know about Controllers.

```
Configuration.notify() 
  → app.js receives event
  → app.js calls render()
  → Views pull from State/Derived
```

### 5. **Pure Functions for Derived**
All Derived computers are pure functions:
```javascript
compute(state1, state2, ...) → result
```

Same inputs = same output. No side effects.

---

## File Organization

```
src/
├── state/           (5 files) - Primary state
├── derived/         (5 files) - Computed state
├── view/            (4 files) - Rendering
├── controller/      (4 files) - Input handling
├── geometry/        (1 file)  - Pure math utilities
└── app.js           (1 file)  - Wiring everything together
```

**Total: ~20 files** vs current ~15 files

**But:** Each file is smaller, more focused, easier to understand and test.

---

## Benefits of This Approach

### ✅ **Clear Separation of Concerns**
Every file has ONE job:
- State files: Hold data
- Derived files: Compute from data
- View files: Display data
- Controller files: Handle input

### ✅ **Easy to Find Things**
- "Where is highlighting logic?" → `derived/HighlightsComputer.js`
- "Where is mouse handling?" → `controller/InteractionController.js`
- "Where is pan/zoom?" → `state/TransformState.js` + `controller/InteractionController.js`

### ✅ **Easy to Test**
```javascript
// Test highlighting without canvas
const config = new Configuration();
config.addPoint(0, 0, [0]);
config.addLine(0, 0, 0);

const interactionState = new InteractionState();
interactionState.setMode('point');

const highlights = new HighlightsComputer(config, interactionState, ...);
const result = highlights.compute();

assert(result.points.has(0));
```

### ✅ **Easy to Change**
Want to change highlighting logic?
- Only edit `derived/HighlightsComputer.js`
- No need to touch controllers, views, or other state

### ✅ **No Hidden Dependencies**
Each file explicitly lists its dependencies in constructor:
```javascript
class HighlightsComputer {
  constructor(configuration, interactionState, uiState, ...) {
    // Clear what this depends on
  }
}
```

### ✅ **Scalable**
Need to add a new feature?
- Add state if needed (e.g., `SelectionState`)
- Add derived computer if needed (e.g., `SelectionBoxComputer`)
- Update relevant controllers
- Update relevant views
- Wire in app.js

---

Now let's document each file in detail...

---

## PRIMARY STATE (state/)

### `state/Configuration.js`
**Purpose:** Points and lines data - the core domain model

**Data Structure:**
- `points`: Array of point objects `{x: number, y: number, onLines: number[]}`
- `lines`: Array of line objects `{x: number, y: number, angle: number}`
- `observers`: Set of callback functions

**Main Functions:**
- `addPoint(x, y, onLines)` - Add a point, notify observers with event `{type: 'pointAdded', index, point}`
- `removePoint(index)` - Remove a point, update all line memberships, notify observers with event `{type: 'pointRemoved', index, point}`
- `addLine(x, y, angle)` - Add a line, notify observers with event `{type: 'lineAdded', index, line}`
- `removeLine(index)` - Remove a line, update all point line memberships, notify observers with event `{type: 'lineRemoved', index, line}`
- `updatePoint(index, updates)` - Modify point properties (x, y, onLines), notify observers with event `{type: 'pointUpdated', index, point}`
- `updatePointPosition(index, x, y)` - Update only position, notify observers
- `updatePointLines(index, onLines)` - Update only line membership, notify observers
- `getPoint(index)` - Get point by index, returns point object or undefined
- `getLine(index)` - Get line by index, returns line object or undefined
- `getAllPoints()` - Get all points array (returns shallow copy to prevent external mutation)
- `getAllLines()` - Get all lines array (returns shallow copy to prevent external mutation)
- `getPointsCount()` - Get number of points
- `getLinesCount()` - Get number of lines
- `getPointsAtPosition(worldX, worldY, threshold)` - Find points near a world position, returns array of indices
- `subscribe(callback)` - Register observer callback `(event) => void`
- `unsubscribe(callback)` - Remove observer callback
- `notify(event)` - Call all observers with event object
- `clear()` - Remove all points and lines, notify observers with event `{type: 'cleared'}`
- `serialize()` - Convert to compact JSON format `{v: 1, p: [[x,y,[lines]], ...], l: [[x,y,angle], ...]}`
- `deserialize(data)` - Load from compact JSON format, returns true if successful

**Event Types:**
- `{type: 'pointAdded', index: number, point: object}`
- `{type: 'pointRemoved', index: number, point: object}`
- `{type: 'pointUpdated', index: number, point: object}`
- `{type: 'lineAdded', index: number, line: object}`
- `{type: 'lineRemoved', index: number, line: object}`
- `{type: 'lineUpdated', index: number, line: object}`
- `{type: 'cleared'}`

**Notes:**
- Points do NOT store intersection references or isIntersection flags in this version
- Those are computed by IntersectionsComputer as needed
- onLines is still stored because it's fundamental to the configuration definition

---

### `state/HistoryState.js`
**Purpose:** Undo/redo action stack (just the data structure, no execution logic)

**Data Structure:**
- `actions`: Array of action objects
- `currentIndex`: Number indicating current position (-1 means empty, 0 means after first action)
- `maxHistorySize`: Number (default 100)
- `observers`: Set of callback functions

**Action Object Structure:**
Each action is an object with:
```javascript
{
  type: string, // 'addPoint' | 'removePoint' | 'addLine' | 'removeLine' | 'movePoint' | 'mergePoint' | 'unmergePoint'
  data: object, // Action-specific data
  timestamp: Date
}
```

**Action Data Formats:**
- `addPoint`: `{index: number, point: {x, y, onLines}}`
- `removePoint`: `{index: number, point: {x, y, onLines}}`
- `addLine`: `{index: number, line: {x, y, angle}, affectedPoints: [{index, oldOnLines, newOnLines}]}`
- `removeLine`: `{index: number, line: {x, y, angle}, affectedPoints: [{index, oldOnLines, newOnLines}]}`
- `movePoint`: `{index: number, oldState: {x, y, onLines}, newState: {x, y, onLines}}`
- `mergePoint`: `{index: number, oldState: {x, y, onLines}, newState: {x, y, onLines}}`
- `unmergePoint`: `{index: number, oldState: {x, y, onLines}, newState: {x, y, onLines}}`

**Main Functions:**
- `push(action)` - Add action to history, truncate forward history if not at end, enforce max size, notify observers
- `getCurrentAction()` - Get action at current index, returns action or null
- `getUndoAction()` - Get action to undo (action at currentIndex), returns action or null
- `getRedoAction()` - Get action to redo (action at currentIndex + 1), returns action or null
- `canUndo()` - Check if undo is available, returns boolean
- `canRedo()` - Check if redo is available, returns boolean
- `moveBackward()` - Decrement currentIndex (call after executing undo), notify observers
- `moveForward()` - Increment currentIndex (call after executing redo), notify observers
- `clear()` - Reset history to empty, notify observers
- `getActions()` - Get all actions (for debugging), returns shallow copy of actions array
- `getCurrentIndex()` - Get current index (for debugging)
- `subscribe(callback)` - Register observer callback `() => void`
- `unsubscribe(callback)` - Remove observer callback
- `notify()` - Call all observers

**Event Flow:**
1. Controller wants to record action: `historyState.push(action)`
2. Controller wants to undo: get action via `getUndoAction()`, execute it, then call `moveBackward()`
3. Controller wants to redo: get action via `getRedoAction()`, execute it, then call `moveForward()`

**Notes:**
- This class only manages the stack - it does NOT execute actions
- HistoryController is responsible for applying actions to Configuration

---

### `state/InteractionState.js`
**Purpose:** Current interaction state (what is the user doing right now?)

**Data Structure:**
- `mode`: String, either 'point' or 'line'
- `state`: Object `{type: string, data: any}`
- `mousePosition`: Object `{worldX: number, worldY: number, screenX: number, screenY: number}` or null
- `mouseDownPosition`: Object `{worldX: number, worldY: number, screenX: number, screenY: number, time: number}` or null
- `observers`: Set of callback functions

**State Types:**
- `'idle'` - No active interaction
- `'placingPoint'` - Mouse down in point mode, about to place point
- `'draggingPoint'` - Dragging an existing point
- `'draggingNewPoint'` - Dragging a newly created point (tap-drag in point mode)
- `'drawingLine'` - Drawing a line (mouse down in line mode)
- `'panning'` - Panning the view (usually middle mouse or drag in empty space)
- `'twoFingerGesture'` - Two-finger pinch/pan (mobile/trackpad)

**State Data by Type:**
- `idle`: `null`
- `placingPoint`: `{startWorldX: number, startWorldY: number, startOffsetX: number, startOffsetY: number}` (for pan detection)
- `draggingPoint`: `{pointIndex: number, originalX: number, originalY: number}`
- `draggingNewPoint`: `{startWorldX: number, startWorldY: number}`
- `drawingLine`: `{startX: number, startY: number, startPointIndices: number[] | null}`
- `panning`: `{startOffsetX: number, startOffsetY: number}`
- `twoFingerGesture`: `{startOffsetX: number, startOffsetY: number, startScale: number, initialDistance: number, initialCenterX: number, initialCenterY: number}`

**Main Functions:**
- `setMode(mode)` - Change mode ('point' | 'line'), reset state to idle, notify observers
- `transitionTo(stateType, data)` - Change interaction state, notify observers
- `setMousePosition(worldX, worldY, screenX, screenY)` - Update current mouse position, notify observers
- `clearMousePosition()` - Set mouse position to null
- `setMouseDownPosition(worldX, worldY, screenX, screenY, time)` - Record where mouse went down
- `clearMouseDownPosition()` - Clear mouse down position
- `getMode()` - Get current mode
- `getState()` - Get current state object `{type, data}`
- `getStateType()` - Get current state type string
- `getStateData()` - Get current state data
- `getMousePosition()` - Get mouse position or null
- `getMouseDownPosition()` - Get mouse down position or null
- `isInState(type)` - Check if in specific state, returns boolean
- `isIdle()` - Check if state is 'idle'
- `reset()` - Reset to idle state, clear mouse positions, notify observers
- `subscribe(callback)` - Register observer callback `() => void`
- `unsubscribe(callback)` - Remove observer callback
- `notify()` - Call all observers

**Notes:**
- This is THE central state for tracking interaction
- Read by: HighlightsComputer, SnapPreviewComputer, VisualOverlaysComputer, InteractionController
- Modified by: InteractionController only

---

### `state/TransformState.js`
**Purpose:** Pan and zoom state for the canvas view

**Data Structure:**
- `offsetX`: Number (screen pixels)
- `offsetY`: Number (screen pixels)
- `scale`: Number (zoom level, 1.0 = 100%)
- `minScale`: Number (minimum zoom, e.g., 0.1)
- `maxScale`: Number (maximum zoom, e.g., 5.0)
- `canvasWidth`: Number (canvas width in pixels)
- `canvasHeight`: Number (canvas height in pixels)
- `observers`: Set of callback functions

**Main Functions:**
- `setPan(offsetX, offsetY)` - Set pan offset, notify observers
- `setZoom(scale)` - Set zoom level (clamped to min/max), notify observers
- `setCanvasSize(width, height)` - Update canvas dimensions (for coordinate conversion)
- `zoomAt(screenX, screenY, scaleFactor)` - Zoom centered on a screen point, adjusts pan to keep point fixed, notify observers
- `pan(deltaX, deltaY)` - Pan by delta amount, notify observers
- `worldToScreen(worldX, worldY)` - Convert world coordinates to screen coordinates, returns `{x, y}`
- `screenToWorld(screenX, screenY)` - Convert screen coordinates to world coordinates, returns `{x, y}`
- `getViewportBounds()` - Get visible world rectangle, returns `{left, right, top, bottom}`
- `getOffsetX()` - Get pan X offset
- `getOffsetY()` - Get pan Y offset
- `getScale()` - Get zoom scale
- `reset()` - Reset to default view (origin centered, scale 1.0), notify observers
- `centerOrigin()` - Set pan so world origin (0, 0) is at canvas center, notify observers
- `subscribe(callback)` - Register observer callback `() => void`
- `unsubscribe(callback)` - Remove observer callback
- `notify()` - Call all observers

**Notes:**
- Modified by: InteractionController (pan/zoom gestures)
- Read by: InteractionController (coordinate conversion), CanvasView, SnapPreviewComputer

---

### `state/UIState.js`
**Purpose:** UI settings and panel state (non-domain state)

**Data Structure:**
- `rayOpacity`: Number (0.0 to 1.0, opacity of ray portions of lines)
- `colorPalette`: String ('monochromatic' | 'rainbow' | 'pastel')
- `currentStatsView`: String ('general' | 'bases' | 'circuits' | 'flats')
- `statsPagination`: Object with shape:
  ```javascript
  {
    bases: {offset: number, batchSize: number},
    circuits: {offset: number, batchSize: number},
    flats: {offset: number, batchSize: number}
  }
  ```
- `optionsPanelVisible`: Boolean
- `debugPanelVisible`: Boolean
- `hoveredPointsFromUI`: Set of point indices (from stats panel hover)
- `observers`: Set of callback functions

**Main Functions:**
- `setRayOpacity(opacity)` - Set ray opacity (0-1), notify observers
- `setColorPalette(palette)` - Set color palette name, notify observers
- `setCurrentStatsView(view)` - Change stats view ('general' | 'bases' | 'circuits' | 'flats'), notify observers
- `loadMoreStats(view)` - Increment pagination offset for a view, notify observers
- `resetPagination(view)` - Reset pagination for a view (or all if view is null), notify observers
- `setOptionsPanelVisible(visible)` - Show/hide options panel, notify observers
- `setDebugPanelVisible(visible)` - Show/hide debug panel, notify observers
- `setHoveredPointsFromUI(pointIndices)` - Set points hovered from stats panel (pass array or Set), notify observers
- `clearHoveredPointsFromUI()` - Clear UI hover, notify observers
- `getRayOpacity()` - Get ray opacity value
- `getColorPalette()` - Get color palette name
- `getCurrentStatsView()` - Get current stats view
- `getStatsPagination(view)` - Get pagination for a view, returns `{offset, batchSize}`
- `isOptionsPanelVisible()` - Check if options panel is visible
- `isDebugPanelVisible()` - Check if debug panel is visible
- `getHoveredPointsFromUI()` - Get hovered points Set
- `subscribe(callback)` - Register observer callback `() => void`
- `unsubscribe(callback)` - Remove observer callback
- `notify()` - Call all observers

**Notes:**
- Modified by: UIController (button clicks, slider changes, panel hovers)
- Read by: CanvasView (rayOpacity, colorPalette), StatsView (currentStatsView, pagination), HighlightsComputer (hoveredPointsFromUI)

---

## DERIVED STATE (derived/)

### `derived/IntersectionsComputer.js`
**Purpose:** Compute all line intersections from configuration

**Data Structure:**
- `configuration`: Reference to Configuration state
- `geometryUtils`: Reference to geometry utility functions (for computeIntersections)

**Main Functions:**
- `compute()` - Calculate all line intersections from current configuration, returns array of intersection objects

**Return Format:**
Array of objects with shape:
```javascript
{
  x: number,           // World X coordinate
  y: number,           // World Y coordinate
  lineIndices: number[] // Array of line indices that intersect here
}
```

**Internal Algorithm:**
1. Get all lines from configuration
2. Get all points from configuration (for updating references)
3. Call `geometryUtils.computeIntersections(lines, points)`
4. Return clustered intersections (points within 0.1 units are same intersection)

**Notes:**
- Pure function - no state, no observers, no caching
- Called by: CanvasView, HighlightsComputer, SnapPreviewComputer, VisualOverlaysComputer
- Uses existing geometry-utils.js logic

---

### `derived/HighlightsComputer.js`
**Purpose:** Compute which points and lines should be highlighted based on current interaction

**Data Structure:**
- `configuration`: Reference to Configuration
- `interactionState`: Reference to InteractionState
- `uiState`: Reference to UIState
- `snapPreviewComputer`: Reference to SnapPreviewComputer
- `intersectionsComputer`: Reference to IntersectionsComputer

**Main Functions:**
- `compute()` - Calculate highlights, returns object with shape `{points: Set<number>, lines: Set<number>}`

**Internal Helper Methods:**
- `highlightFromSnap(snapPreview, intersections)` - Add highlights based on snap target (point, line, or intersection)
- `highlightFromInteractionState(state, intersections)` - Add highlights based on current interaction (dragging, drawing line)
- `highlightFromUIHover()` - Add highlights from stats panel hover

**Computation Logic:**

**1. Start with empty sets:**
```javascript
const highlightedPoints = new Set();
const highlightedLines = new Set();
```

**2. Add highlights from UI hover:**
- If `uiState.hoveredPointsFromUI` is not empty, add those points to highlights

**3. Add highlights based on interaction state:**

For `'idle'` state:
- Get snap preview from snapPreviewComputer
- If snap type is 'line': highlight that line
- If snap type is 'intersection': highlight all lines in that intersection
- If snap type is 'point': highlight that point and all its lines

For `'draggingPoint'` or `'draggingNewPoint'` state:
- Get snap preview
- Apply same highlighting as idle

For `'drawingLine'` state:
- Highlight start point indices (from state data)
- Highlight all lines those points are on
- Get snap preview for endpoint
- If snapping to multipoint: highlight those points and their lines
- If snapping to intersection: highlight intersection lines

For `'placingPoint'` state:
- Get snap preview
- Apply same highlighting as idle

For other states (panning, etc.):
- No highlights

**Return Format:**
```javascript
{
  points: Set([0, 2, 5]),  // Point indices
  lines: Set([1, 3])       // Line indices
}
```

**Notes:**
- Pure function - recomputes every time
- No caching needed (fast enough)
- Called by: CanvasView only

---

### `derived/SnapPreviewComputer.js`
**Purpose:** Compute snap target for current mouse position

**Data Structure:**
- `configuration`: Reference to Configuration
- `interactionState`: Reference to InteractionState
- `intersectionsComputer`: Reference to IntersectionsComputer
- `transformState`: Reference to TransformState
- `snapThresholds`: Object `{intersection: 15, line: 20, point: 15}` (screen pixels)

**Main Functions:**
- `compute()` - Calculate snap target for current mouse position, returns snap object or null

**Internal Helper Methods:**
- `checkPointSnap(worldX, worldY, scale, points)` - Check if near existing point
- `checkIntersectionSnap(worldX, worldY, scale, intersections)` - Check if near intersection
- `checkLineSnap(worldX, worldY, scale, lines)` - Check if near a line

**Computation Logic:**

**1. Check if mouse position exists:**
- If `interactionState.mousePosition` is null, return null

**2. Get current mouse position:**
```javascript
const mousePos = interactionState.getMousePosition();
const worldX = mousePos.worldX;
const worldY = mousePos.worldY;
```

**3. Get current zoom scale:**
```javascript
const scale = transformState.getScale();
```

**4. Convert screen-space thresholds to world-space:**
```javascript
const worldPointThreshold = this.snapThresholds.point / scale;
const worldIntersectionThreshold = this.snapThresholds.intersection / scale;
const worldLineThreshold = this.snapThresholds.line / scale;
```

**5. Check snap priority (highest to lowest):**

**Priority 1: Existing points**
- Loop through all points
- Calculate distance to mouse
- If distance < worldPointThreshold: return `{type: 'point', x: point.x, y: point.y, pointIndex: i}`

**Priority 2: Intersections**
- Get intersections from intersectionsComputer
- Loop through intersections
- Calculate distance to mouse
- If distance < worldIntersectionThreshold: return `{type: 'intersection', x: inter.x, y: inter.y, intersectionIndex: i, lineIndices: inter.lineIndices}`

**Priority 3: Lines**
- Loop through all lines
- Project mouse position onto line (using geometry-utils)
- Calculate perpendicular distance
- If distance < worldLineThreshold: return `{type: 'line', x: projectedX, y: projectedY, lineIndex: i}`

**Priority 4: No snap**
- Return null

**Return Format:**
```javascript
// Point snap:
{type: 'point', x: number, y: number, pointIndex: number}

// Intersection snap:
{type: 'intersection', x: number, y: number, intersectionIndex: number, lineIndices: number[]}

// Line snap:
{type: 'line', x: number, y: number, lineIndex: number}

// No snap:
null
```

**Notes:**
- Pure function - recomputes every time
- Called by: CanvasView, HighlightsComputer, VisualOverlaysComputer
- Only computes if mouse position exists

---

### `derived/VisualOverlaysComputer.js`
**Purpose:** Compute visual overlays (ghost points, preview lines, etc.)

**Data Structure:**
- `interactionState`: Reference to InteractionState
- `configuration`: Reference to Configuration
- `snapPreviewComputer`: Reference to SnapPreviewComputer
- `intersectionsComputer`: Reference to IntersectionsComputer
- `transformState`: Reference to TransformState

**Main Functions:**
- `compute()` - Calculate all visual overlays, returns object with shape:
  ```javascript
  {
    ghostPoint: {x, y, pointIndex} | null,
    previewLine: {startX, startY, endX, endY} | null,
    lineIntersectionPreviews: [{x, y, type, ...}]
  }
  ```

**Internal Helper Methods:**
- `computeGhostForDragging(state, snapPreview)` - Compute ghost point when dragging existing point
- `computeGhostForDraggingNew(state, snapPreview)` - Compute ghost point when dragging new point
- `computePreviewLine(state, mousePos)` - Compute preview line when drawing line
- `findLineEndpointSnap(startX, startY, endX, endY)` - Find snap target for line endpoint
- `shouldShowLinePreview()` - Check if drag distance is sufficient to show line preview

**Computation Logic:**

**1. Initialize result:**
```javascript
const result = {
  ghostPoint: null,
  previewLine: null,
  lineIntersectionPreviews: []
};
```

**2. Get current state:**
```javascript
const state = interactionState.getState();
const stateType = state.type;
```

**3. Compute based on state type:**

**For `'draggingPoint'` state:**
- Get snap preview from snapPreviewComputer
- If snap exists: use snap position for ghost
- If no snap: use current mouse position for ghost
- Ghost includes original point index: `{x, y, pointIndex: state.data.pointIndex}`

**For `'draggingNewPoint'` state:**
- Get snap preview from snapPreviewComputer
- If snap exists: use snap position for ghost
- If no snap: use current mouse position for ghost
- Ghost uses -1 as pointIndex (indicates new point): `{x, y, pointIndex: -1}`

**For `'drawingLine'` state:**
- Check if sufficient drag distance (using shouldShowLinePreview)
- If not enough distance, return empty result
- Get start position from state data
- Get current mouse position
- Call findLineEndpointSnap to get endpoint snap
- If endpoint snap exists:
  - Use snap position as end point
  - Set lineIntersectionPreviews to all intersections found along line
- If no endpoint snap: use mouse position as end point
- Return preview line: `{startX, startY, endX, endY}`

**For all other states:**
- Return empty result

**findLineEndpointSnap Algorithm:**
1. Calculate line angle from start to end
2. Find all points perpendicular to line (within threshold)
3. Find all intersections perpendicular to line (within threshold)
4. Sort by distance to cursor (end point)
5. Return closest as snap target, all others as previews

**shouldShowLinePreview Logic:**
- Get mouse down position and current position
- Calculate screen-space drag distance
- Check if distance > linePreviewThreshold (15px or 2x clickThreshold)
- Return boolean

**Return Format:**
```javascript
{
  ghostPoint: {x: number, y: number, pointIndex: number} | null,
  previewLine: {startX: number, startY: number, endX: number, endY: number} | null,
  lineIntersectionPreviews: [
    {x: number, y: number, type: 'multipoint' | 'intersection', pointIndices?: number[], lineIndices?: number[]},
    ...
  ]
}
```

**Notes:**
- Pure function - recomputes every time
- Called by: CanvasView only
- Depends on SnapPreviewComputer for consistent snap behavior

---

### `derived/MatroidComputer.js`
**Purpose:** Compute matroid properties (rank, bases, circuits, flats)

**Data Structure:**
- `configuration`: Reference to Configuration
- `intersectionsComputer`: Reference to IntersectionsComputer

**Main Functions:**
- `compute()` - Calculate all matroid properties, returns object with shape:
  ```javascript
  {
    rank: number,
    numPoints: number,
    numLines: number,
    bases: number[][],      // Array of bases, each base is array of point indices
    circuits: number[][],   // Array of circuits
    flats: number[][]       // Array of flats
  }
  ```

**Internal Helper Methods:**
- `computeRank(points, lines)` - Calculate matroid rank
- `computeBases(points, lines, rank)` - Generate all bases
- `computeCircuits(points, lines, intersections)` - Generate all circuits
- `computeFlats(points, lines, intersections, rank)` - Generate all flats
- `isIndependent(pointIndices, points, lines)` - Check if set is independent
- `areCollinear(pointIndices, points, lines)` - Check if points are collinear
- `rankOfSubset(pointIndices, points, lines)` - Calculate rank of subset
- `closure(pointIndices, points, lines)` - Compute closure of set
- `areAtSamePosition(i, j, points, intersections)` - Check if two points at same location
- `getPointsOnLine(lineIndex, points)` - Get all points on a line
- `groupPointsByPosition(points, intersections)` - Group points by location (for multipoint detection)

**Computation Logic:**

**1. Get data:**
```javascript
const points = configuration.getAllPoints();
const lines = configuration.getAllLines();
const intersections = intersectionsComputer.compute();
```

**2. Quick return for empty:**
```javascript
if (points.length === 0) {
  return {rank: 0, numPoints: 0, numLines: 0, bases: [], circuits: [], flats: [[]]};
}
```

**3. Compute rank:**
- If 0 points: rank = 0
- If 1 point: rank = 1
- If 2 points: rank = 2 (unless at same position, then rank = 1)
- If 3+ points: check if all collinear (rank = 2), else rank = 3 (max for 2D)

**4. Compute bases:**
- Generate all subsets of size = rank
- Filter to independent sets
- Each independent set of size rank is a base

**5. Compute circuits:**
- Size-2 circuits: pairs of points at same position (multipoints)
- Size-3 circuits: collinear triples (excluding multipoints)
- For each line: generate all triples of points on that line
- Filter out triples with multipoints

**6. Compute flats:**
- Rank 0: empty set []
- Rank 1: each multipoint (group of points at same position)
- Rank 2: for each pair of multipoints, find all points collinear with them
- Rank 3: entire ground set (if rank is 3)

**7. Return result:**
```javascript
{
  rank,
  numPoints: points.length,
  numLines: lines.length,
  bases,
  circuits,
  flats
}
```

**Return Format:**
```javascript
{
  rank: number,
  numPoints: number,
  numLines: number,
  bases: [[0,1,2], [0,1,3], ...],     // Each array is a base
  circuits: [[0,1], [2,3,4], ...],    // Each array is a circuit
  flats: [[], [0], [1], [0,1,2], ...] // Each array is a flat
}
```

**Notes:**
- Pure function - recomputes every time
- This can be slow for large configurations (combinatorial explosion)
- Called by: StatsView only
- Reuses most logic from current matroid.js

---

## VIEW LAYER (view/)

### `view/CanvasView.js`
**Purpose:** Orchestrate canvas rendering - the main render coordinator

**Data Structure:**
- `canvas`: HTMLCanvasElement reference
- `ctx`: 2D rendering context
- `renderer`: Renderer instance (low-level drawing primitives)
- `configuration`: Reference to Configuration state
- `interactionState`: Reference to InteractionState
- `transformState`: Reference to TransformState
- `uiState`: Reference to UIState
- `intersectionsComputer`: Reference to IntersectionsComputer
- `highlightsComputer`: Reference to HighlightsComputer
- `visualOverlaysComputer`: Reference to VisualOverlaysComputer
- `snapPreviewComputer`: Reference to SnapPreviewComputer

**Main Functions:**
- `render()` - Main render function, called by app.js when state changes
- `clear()` - Clear the canvas
- `setupResizeObserver()` - Setup observer for canvas size changes
- `onResize()` - Handle canvas resize

**Render Flow:**

**1. Clear canvas:**
```javascript
this.renderer.clear();
```

**2. Save context and apply transform:**
```javascript
this.ctx.save();
const transform = this.transformState;
this.ctx.translate(transform.getOffsetX(), transform.getOffsetY());
this.ctx.scale(transform.getScale(), transform.getScale());
```

**3. Get viewport bounds:**
```javascript
const viewportBounds = this.transformState.getViewportBounds();
```

**4. Compute derived state:**
```javascript
const intersections = this.intersectionsComputer.compute();
const highlights = this.highlightsComputer.compute();
const overlays = this.visualOverlaysComputer.compute();
const snapPreview = this.snapPreviewComputer.compute();
```

**5. Draw grid:**
```javascript
this.renderer.drawGridDots(viewportBounds, transform.getScale());
```

**6. Draw lines:**
```javascript
const lines = this.configuration.getAllLines();
const points = this.configuration.getAllPoints();
const rayOpacity = this.uiState.getRayOpacity();

this.renderer.drawLines(
  lines,
  viewportBounds,
  highlights.lines,
  intersections,
  points,
  rayOpacity
);
```

**7. Draw preview line (if any):**
```javascript
if (overlays.previewLine) {
  this.renderer.drawPreviewLine(
    overlays.previewLine.startX,
    overlays.previewLine.startY,
    overlays.previewLine.endX,
    overlays.previewLine.endY,
    viewportBounds
  );
}
```

**8. Draw line intersection previews:**
```javascript
overlays.lineIntersectionPreviews.forEach(preview => {
  if (/* is snapped */) {
    this.renderer.drawSnapPreview(preview);
  } else {
    this.renderer.drawIntersectionPreview(preview);
  }
});
```

**9. Draw snap preview (for point mode):**
```javascript
const mode = this.interactionState.getMode();
if (mode === 'point' && snapPreview) {
  this.renderer.drawSnapPreview(snapPreview);
}
```

**10. Draw ghost point (if any):**
```javascript
if (overlays.ghostPoint) {
  this.renderer.drawGhostPoint(overlays.ghostPoint);
}
```

**11. Draw points:**
```javascript
this.renderer.drawPoints(
  points,
  highlights.points,
  overlays.ghostPoint?.pointIndex, // Skip this point (drawn as ghost)
  intersections
);
```

**12. Restore context:**
```javascript
this.ctx.restore();
```

**Notes:**
- This is the ONLY place that calls Derived computers
- Never modifies state
- All rendering delegated to Renderer
- Called by app.js when any observed state changes

---

### `view/StatsView.js`
**Purpose:** Render stats panel HTML

**Data Structure:**
- `element`: DOM element for stats panel content
- `matroidComputer`: Reference to MatroidComputer
- `uiState`: Reference to UIState
- `onItemHoverCallback`: Function `(pointIndices: number[]) => void` - called when user hovers item
- `onItemUnhoverCallback`: Function `() => void` - called when user stops hovering

**Main Functions:**
- `render()` - Main render function, called by app.js when relevant state changes
- `renderGeneral(matroid)` - Render general stats view
- `renderBases(bases, pagination)` - Render bases list with pagination
- `renderCircuits(circuits, pagination)` - Render circuits list with pagination
- `renderFlats(flats, pagination)` - Render flats list with pagination
- `attachHoverListeners()` - Setup hover event listeners on list items
- `calculateLeviCode(matroid, configuration)` - Calculate Levi code string
- `setupScrollListener()` - Setup scroll listener for pagination

**Render Flow:**

**1. Get current view:**
```javascript
const currentView = this.uiState.getCurrentStatsView();
```

**2. Compute matroid:**
```javascript
const matroid = this.matroidComputer.compute();
```

**3. Check if empty:**
```javascript
if (matroid.numPoints === 0) {
  this.element.innerHTML = '<div class="empty-state">add points and lines to see matroid properties</div>';
  return;
}
```

**4. Render based on view:**
- If 'general': call `renderGeneral(matroid)`
- If 'bases': call `renderBases(matroid.bases, pagination)`
- If 'circuits': call `renderCircuits(matroid.circuits, pagination)`
- If 'flats': call `renderFlats(matroid.flats, pagination)`

**5. Attach hover listeners:**
```javascript
this.attachHoverListeners();
```

**6. Setup scroll for pagination:**
```javascript
this.setupScrollListener();
```

**renderGeneral:**
- Calculate Levi code
- Build HTML string with rank, points, lines, bases count, circuits count, flats count
- Set innerHTML

**renderBases/Circuits/Flats:**
- Get pagination from uiState
- Slice array to visible portion
- Build HTML string with list items (each item has `data-points` attribute)
- Add "showing X of Y" text at bottom
- Set innerHTML

**attachHoverListeners:**
- Query all `.matroid-item` elements
- Add mouseenter listener: parse `data-points`, call `onItemHoverCallback`
- Add mouseleave listener: call `onItemUnhoverCallback`
- Add click listener: stop propagation (prevent clearing hover)

**setupScrollListener:**
- Add scroll listener to panel
- When scrolled 80% down: call `uiState.loadMoreStats(currentView)`
- This triggers re-render with more items

**Notes:**
- Pure rendering - no state modification
- All hover logic delegated to callbacks
- Called by app.js when MatroidComputer or UIState changes

---

### `view/DebugMenuView.js`
**Purpose:** Render debug panel HTML and handle debug form interactions

**Data Structure:**
- `element`: DOM element for debug panel
- `configuration`: Reference to Configuration
- `intersectionsComputer`: Reference to IntersectionsComputer
- `isVisible`: Boolean
- `onAddPointCallback`: Function `(x, y, onLines) => void`
- `onAddLineCallback`: Function `(pointIndices) => void`
- `onExportCallback`: Function `() => void`
- `onClearCallback`: Function `() => void`

**Main Functions:**
- `show()` - Display debug panel with animation
- `hide()` - Hide debug panel with animation
- `toggle()` - Toggle visibility
- `render()` - Update panel content (points list, lines list)
- `updatePointsList()` - Refresh points list HTML
- `updateLinesList()` - Refresh lines list HTML
- `setupEventListeners()` - Wire up form submissions and button clicks
- `getAddPointFormData()` - Extract and validate add point form data
- `getAddLineFormData()` - Extract and validate add line form data
- `clearForms()` - Reset all form inputs

**Panel Structure:**
```
Debug Panel:
├── Add Point Form
│   ├── X input
│   ├── Y input
│   ├── Lines input (comma-separated)
│   └── Add button
├── Current Points List (scrollable)
├── Add Line Form
│   ├── Point indices input (comma-separated)
│   └── Add button
├── Current Lines List (scrollable)
└── Actions
    ├── Copy JSON button
    └── Clear All button
```

**Render Flow:**

**1. Update points list:**
```javascript
const points = this.configuration.getAllPoints();
const intersections = this.intersectionsComputer.compute();
```
- Loop through points
- Get actual position (handle intersections)
- Build HTML: "Point 0: (100.0, 200.0) on lines [0, 1]"
- Set innerHTML of points list

**2. Update lines list:**
```javascript
const lines = this.configuration.getAllLines();
const points = this.configuration.getAllPoints();
```
- Loop through lines
- Find which points are on each line
- Build HTML: "Line 0: through points [0, 1, 2]"
- Set innerHTML of lines list

**Form Handling:**

**Add Point:**
1. User fills form and clicks "Add"
2. `getAddPointFormData()` extracts values
3. Validate: x and y must be numbers, onLines must be valid line indices
4. If valid: call `onAddPointCallback(x, y, onLines)`
5. Clear form

**Add Line:**
1. User fills form and clicks "Add"
2. `getAddLineFormData()` extracts values
3. Validate: at least 2 point indices, all must be valid
4. If valid: call `onAddLineCallback(pointIndices)`
5. Clear form

**Export:**
1. User clicks "Copy JSON"
2. Call `onExportCallback()` (controller handles actual export)

**Clear All:**
1. User clicks "Clear All"
2. Confirm dialog
3. If confirmed: call `onClearCallback()`

**Notes:**
- Observes Configuration to auto-update lists
- All modification logic delegated to callbacks
- Controller wires callbacks to actual operations

---

### `view/Renderer.js`
**Purpose:** Low-level canvas drawing primitives (mostly keep as-is)

**Data Structure:**
- `canvas`: HTMLCanvasElement
- `ctx`: 2D rendering context
- `colorPalettes`: Object with palettes:
  ```javascript
  {
    monochromatic: ['#957fef'],
    rainbow: ['#ff0000', '#00ffff', ...],
    pastel: ['#ffb3ba', '#ffdfba', ...]
  }
  ```
- `currentPalette`: String (palette name)
- `gridSize`: Number (default 30)
- `pointRadius`: Number (default 9, or 14 for touch)

**Main Functions:**

**Drawing Functions:**
- `clear()` - Clear entire canvas
- `drawGridDots(bounds, scale)` - Draw background grid dots
  - Parameters: `bounds` is `{left, right, top, bottom}` in world space, `scale` is zoom level
  - Skip if scale < 0.3 (performance)
  - Draw dots at grid intersections within bounds
  
- `drawPoints(points, highlightedPointIndices, skipPointIndex, intersections)` - Draw all point circles
  - Parameters: `points` array, `highlightedPointIndices` Set, `skipPointIndex` number (for ghost), `intersections` array
  - Group points by position (handle multipoints)
  - Draw each unique position as circle
  - Color: highlighted = orange, merged = blue, normal = teal
  - Add highlight ring if highlighted
  - Draw labels (point indices)
  
- `drawLines(lines, bounds, highlightedLineIndices, intersections, points, rayOpacity)` - Draw all lines
  - Parameters: `lines` array, `bounds` object, `highlightedLineIndices` Set, `intersections` array, `points` array, `rayOpacity` number
  - For each line:
    - Get endpoints (clipped to bounds)
    - Find points on line
    - Sort points by parameter t
    - Draw rays (viewport edge to first point, last point to viewport edge) with rayOpacity
    - Draw segments between points with full opacity
  - Color: highlighted = orange, normal = from palette
  
- `drawSnapPreview(snap)` - Draw snap indicator
  - Parameters: `snap` object `{x, y, type, ...}`
  - Draw circle at snap position
  - If type is 'intersection': add small cross mark
  - Color: blue with transparency
  
- `drawIntersectionPreview(intersection)` - Draw subtle intersection hint (non-snapped)
  - Parameters: `intersection` object `{x, y, type, ...}`
  - Draw smaller, more transparent circle
  - If type is 'intersection': add subtle cross mark
  - Color: very light blue
  
- `drawGhostPoint(ghost)` - Draw ghost point preview
  - Parameters: `ghost` object `{x, y, pointIndex}`
  - Draw semi-transparent circle at position
  - Add stroke
  - If pointIndex >= 0: draw label
  - Color: teal with 60% opacity
  
- `drawPreviewLine(startX, startY, endX, endY, bounds)` - Draw dashed line preview
  - Parameters: start/end coordinates, `bounds` object
  - Calculate line endpoints (clipped to bounds)
  - Draw dashed line
  - Color: light purple

**Utility Functions:**
- `setPalette(name)` - Change color palette ('monochromatic' | 'rainbow' | 'pastel')
- `getLineColor(index)` - Get color for line index from current palette (wraps around)
- `getWorldBounds(viewportBounds)` - Add margin to viewport bounds for line drawing safety

**Notes:**
- Mostly unchanged from current implementation
- All drawing happens in world space (caller applies transform first)
- Never modifies any state
- Never calls any other classes

---

## CONTROLLER LAYER (controller/)

### `controller/InteractionController.js`
**Purpose:** Handle all mouse/touch input and translate to state modifications

**Data Structure:**
- `canvas`: HTMLCanvasElement (for event listeners)
- `configuration`: Reference to Configuration state
- `interactionState`: Reference to InteractionState
- `transformState`: Reference to TransformState
- `historyController`: Reference to HistoryController
- `snapPreviewComputer`: Reference to SnapPreviewComputer
- `intersectionsComputer`: Reference to IntersectionsComputer
- `clickThreshold`: Number (distance to distinguish click from drag, default 5px or 8px for touch)

**Main Functions:**

**Setup:**
- `setupEventListeners()` - Attach all mouse/touch/wheel listeners to canvas

**Event Handlers:**
- `handleMouseDown(event)` - Process mousedown or touchstart
- `handleMouseMove(event)` - Process mousemove or touchmove
- `handleMouseUp(event)` - Process mouseup or touchend
- `handleMouseLeave(event)` - Process mouseleave or touchcancel
- `handleWheel(event)` - Process wheel (zoom)
- `handleTouchStart(event)` - Process touchstart (delegates to mouse or two-finger)
- `handleTouchMove(event)` - Process touchmove
- `handleTouchEnd(event)` - Process touchend

**Coordinate Conversion:**
- `getEventCoordinates(event)` - Extract world and screen coordinates from event, returns `{worldX, worldY, screenX, screenY}`

**State-Specific Handlers:**
- `handlePointModeMouseDown(worldX, worldY, screenX, screenY)` - Handle mousedown in point mode
- `handleLineModeMouseDown(worldX, worldY, screenX, screenY)` - Handle mousedown in line mode
- `handleDragMove(worldX, worldY, screenX, screenY)` - Handle movement during drag
- `handleDragEnd(worldX, worldY, screenX, screenY)` - Handle end of drag
- `handlePanStart(screenX, screenY)` - Start panning
- `handlePanMove(screenX, screenY)` - Update pan
- `handleZoom(screenX, screenY, delta)` - Zoom at point
- `handleTwoFingerGesture(touches)` - Handle pinch/pan gesture

**Handler Logic:**

**handleMouseDown in Point Mode:**
1. Get world/screen coordinates
2. Store mouse down position in InteractionState
3. Check if clicking on existing point(s)
4. If yes: transition to 'draggingPoint' state with `{pointIndex, originalX, originalY}`
5. If no: transition to 'draggingNewPoint' state with `{startWorldX, startWorldY}`

**handleMouseDown in Line Mode:**
1. Get world/screen coordinates
2. Store mouse down position
3. Check if clicking on/near existing point(s)
4. If yes: use that point's position as start
5. Transition to 'drawingLine' state with `{startX, startY, startPointIndices}`

**handleMouseMove:**
1. Update InteractionState.mousePosition
2. Based on current state:
   - `placingPoint`: Check if dragging (distance > clickThreshold), if yes transition to 'panning'
   - `draggingPoint` / `draggingNewPoint` / `drawingLine`: Do nothing (CanvasView will show appropriate overlays)
   - `panning`: Update TransformState pan offset
   - `twoFingerGesture`: Update TransformState pan and zoom
   - `idle`: Do nothing (CanvasView will show snap preview)

**handleMouseUp:**
1. Get world/screen coordinates
2. Calculate if this was a click (distance < clickThreshold)
3. Based on current state:
   - `drawingLine`: 
     - If sufficient drag distance: create line via OperationsController or directly
     - Record history
   - `draggingPoint`:
     - If click (no drag): restore original position
     - If drag: apply new position from snap or mouse position
     - Update Configuration
     - Record history
   - `draggingNewPoint`:
     - If click: add point at original position (with snap)
     - If drag: add point at final position (with snap)
     - Record history
   - `placingPoint`: Add point using captured snap
   - `panning` / `twoFingerGesture`: Do nothing
4. Transition back to 'idle'
5. Clear mouse positions

**handleWheel:**
1. Prevent default
2. Get zoom center (canvas center for wheel, mouse position for trackpad)
3. Calculate scale factor from deltaY
4. Call transformState.zoomAt(centerX, centerY, scaleFactor)

**Notes:**
- ONLY controller that modifies InteractionState and TransformState
- Modifies Configuration indirectly (adds/moves points and lines)
- Records all configuration changes via HistoryController
- Never calls render (state changes trigger render via observers)

---

### `controller/HistoryController.js`
**Purpose:** Execute undo/redo operations and record actions

**Data Structure:**
- `historyState`: Reference to HistoryState
- `configuration`: Reference to Configuration
- `intersectionsComputer`: Reference to IntersectionsComputer

**Main Functions:**

**Recording Actions:**
- `recordAddPoint(index, point)` - Record point addition to history
- `recordRemovePoint(index, point)` - Record point removal
- `recordAddLine(index, line, affectedPoints)` - Record line addition
- `recordRemoveLine(index, line, affectedPoints)` - Record line removal
- `recordMovePoint(index, oldState, newState)` - Record point movement
- `recordMergePoint(index, oldState, newState)` - Record point merging (moved to multipoint)
- `recordUnmergePoint(index, oldState, newState)` - Record point unmerging (moved away from multipoint)

**Executing Actions:**
- `undo()` - Execute undo operation, returns true if successful
- `redo()` - Execute redo operation, returns true if successful
- `applyAction(action, direction)` - Apply action in 'forward' or 'reverse' direction
- `canUndo()` - Check if undo available (delegates to HistoryState)
- `canRedo()` - Check if redo available (delegates to HistoryState)

**Action Application Logic:**

**Undo addPoint:**
1. Get action from historyState.getUndoAction()
2. Verify index matches (last point should be this one)
3. Call configuration.removePoint(index)
4. Call historyState.moveBackward()

**Redo addPoint:**
1. Get action from historyState.getRedoAction()
2. Call configuration.addPoint(x, y, onLines) - will add at end
3. Call historyState.moveForward()

**Undo addLine:**
1. Get action
2. Restore affected points to old state (old onLines)
3. Call configuration.removeLine(index)
4. Call historyState.moveBackward()

**Redo addLine:**
1. Get action
2. Call configuration.addLine(x, y, angle)
3. Update affected points to new state (add line to their onLines)
4. Call historyState.moveForward()

**Undo movePoint:**
1. Get action
2. Update point to oldState (x, y, onLines)
3. Call historyState.moveBackward()

**Redo movePoint:**
1. Get action
2. Update point to newState (x, y, onLines)
3. Call historyState.moveForward()

**Recording Flow:**
```
InteractionController adds point
  ↓
Calls historyController.recordAddPoint(index, point)
  ↓
HistoryController creates action object:
  {type: 'addPoint', data: {index, point: {x, y, onLines}}, timestamp: Date.now()}
  ↓
Calls historyState.push(action)
  ↓
HistoryState adds to stack, notifies observers
```

**Notes:**
- Acts as bridge between HistoryState (data) and Configuration (domain)
- All configuration modifications from InteractionController go through this
- Recomputes intersections after undo/redo (calls compute but doesn't store)

---

### `controller/OperationsController.js`
**Purpose:** Complex operations on configuration (clean, add intersections, clear, load examples)

**Data Structure:**
- `configuration`: Reference to Configuration
- `intersectionsComputer`: Reference to IntersectionsComputer
- `transformState`: Reference to TransformState
- `historyController`: Reference to HistoryController

**Main Functions:**
- `removeNonEssentialLines()` - Remove lines with fewer than 3 points
- `addIntersectionPoints()` - Add points at all visible intersections
- `clearAll()` - Remove all points and lines
- `loadExample(exampleName)` - Load configuration from examples.json
- `exportImage(canvas)` - Export canvas as PNG image
- `exportConfiguration()` - Export configuration as JSON string
- `importConfiguration(json)` - Import configuration from JSON string

**removeNonEssentialLines Logic:**
1. Count points on each line
2. Find lines with < 3 points
3. Create index mapping (old index → new index)
4. Remove those lines from configuration
5. Update all points' onLines arrays (remove deleted lines, remap indices)
6. Record history (complex - record all affected points and lines)

**addIntersectionPoints Logic:**
1. Get viewport bounds from transformState
2. Compute all intersections
3. Filter to intersections within viewport
4. For each intersection:
   - Check if point already exists at that location
   - If not: add point with all lines from intersection
   - Record history for each point added

**clearAll Logic:**
1. Show confirmation dialog
2. If confirmed:
   - Record all current state (for potential undo)
   - Call configuration.clear()
   - Record history

**loadExample Logic:**
1. Fetch examples.json
2. Parse JSON
3. Find example by name
4. Call configuration.clear()
5. For each point in example:
   - Add point with specified onLines
6. Compute lines from point data (derive line parameters)
7. Record history

**exportImage Logic:**
1. Get canvas from CanvasView
2. Call canvas.toBlob()
3. Create download link
4. Trigger download with timestamp filename

**exportConfiguration Logic:**
1. Call configuration.serialize()
2. Copy to clipboard
3. Show success message

**importConfiguration Logic:**
1. Parse JSON string
2. Validate format
3. Call configuration.deserialize(data)
4. Record history

**Notes:**
- These are higher-level operations that may modify configuration extensively
- All modifications recorded via HistoryController
- Some operations may be grouped into single history action

---

### `controller/UIController.js`
**Purpose:** Handle UI interactions (buttons, sliders, panels, dropdowns)

**Data Structure:**
- `uiState`: Reference to UIState
- `interactionState`: Reference to InteractionState
- `historyController`: Reference to HistoryController
- `operationsController`: Reference to OperationsController
- `debugMenuView`: Reference to DebugMenuView

**Main Functions:**

**Setup Functions:**
- `setupModeSwitch()` - Wire up point/line mode buttons
- `setupColorPalette()` - Wire up color palette selector
- `setupRayOpacity()` - Wire up ray opacity slider
- `setupHistoryButtons()` - Wire up undo/redo buttons
- `setupStatsPanel()` - Wire up stats dropdown, view selector
- `setupDebugMenu()` - Wire up debug panel toggle
- `setupLibrary()` - Wire up examples modal
- `setupResizeHandle()` - Wire up panel resize handle
- `setupOptionsPanel()` - Wire up options panel toggle

**Event Handlers:**
- `onModeButtonClick(mode)` - Change interaction mode
- `onColorPaletteChange(palette)` - Change color palette
- `onRayOpacityChange(opacity)` - Change ray opacity
- `onUndoClick()` - Trigger undo
- `onRedoClick()` - Trigger redo
- `onStatsViewChange(view)` - Change stats view
- `onStatsItemHover(pointIndices)` - Handle hover from stats panel
- `onStatsItemUnhover()` - Handle unhover
- `onDebugToggle()` - Toggle debug panel
- `onLibraryOpen()` - Open examples modal
- `onExampleSelect(exampleName)` - Load example
- `onCleanClick()` - Trigger clean operation
- `onAddIntersectionsClick()` - Trigger add intersections
- `onClearAllClick()` - Trigger clear all
- `onExportImageClick()` - Trigger image export
- `updateHistoryButtons()` - Enable/disable undo/redo buttons based on history state

**Setup Logic Examples:**

**setupModeSwitch:**
1. Get button elements
2. Add click listeners
3. On click: 
```javascript
   - Call interactionState.setMode(mode)
   - Update button active states
   - Update switch indicator position
```

**setupRayOpacity:**
1. Get slider element
2. Add input listener
3. On input:
   - Parse value (0-1)
   - Call uiState.setRayOpacity(value)
   - Update displayed percentage text

**setupStatsPanel:**
1. Get dropdown trigger and content elements
2. Add click listener to trigger
3. On dropdown item click:
   - Call uiState.setCurrentStatsView(view)
   - Close dropdown
4. Setup scroll listener for pagination:
   - When scrolled 80% down, call uiState.loadMoreStats(currentView)

**setupHistoryButtons:**
1. Get undo/redo button elements
2. Add click listeners
3. On undo click:
   - Call historyController.undo()
   - Call updateHistoryButtons()
4. On redo click:
   - Call historyController.redo()
   - Call updateHistoryButtons()
5. Setup keyboard shortcuts (Ctrl+Z, Ctrl+Y)

**setupLibrary:**
1. Get library button and modal elements
2. Add click listener to open modal
3. Fetch examples.json
4. Populate modal with example cards
5. On example click:
   - Call operationsController.loadExample(name)
   - Close modal

**setupResizeHandle:**
1. Get resize handle element
2. Add mousedown/touchstart listener
3. On drag:
   - Calculate new panel width/height
   - Clamp to min/max
   - Update panel style
4. On drag end:
   - Clean up event listeners

**onStatsItemHover Logic:**
1. Receive array of point indices from StatsView
2. Call uiState.setHoveredPointsFromUI(pointIndices)
3. UIState notifies observers
4. App.js triggers render
5. HighlightsComputer includes these points in highlights

**updateHistoryButtons Logic:**
1. Get undo/redo button elements
2. Set disabled state:
   - undo disabled if !historyController.canUndo()
   - redo disabled if !historyController.canRedo()
3. Set opacity (visual feedback for disabled state)

**Notes:**
- ONLY controller that modifies UIState
- Never directly triggers render (state changes do that)
- All button clicks map to state modifications or controller method calls
- Keyboard shortcuts also handled here

---

## GEOMETRY UTILITIES (geometry/)

### `geometry/geometry-utils.js`
**Purpose:** Pure mathematical functions for geometric calculations (keep mostly as-is)

**Main Functions:**

**Line Intersection:**
- `computeLineIntersection(line1, line2)` - Calculate intersection of two infinite lines
  - Parameters: `line1` and `line2` objects `{x, y, angle}`
  - Returns: `{x, y}` or null if parallel
  - Algorithm: Parametric line intersection, check cross product for parallelism

**Point Projection:**
- `projectPointOntoLine(px, py, line)` - Project point onto infinite line (perpendicular)
  - Parameters: point coordinates and line object
  - Returns: `{x, y}` of projected point
  - Algorithm: Dot product projection

**Line Clipping:**
- `getLineEndpoints(x, y, angle, bounds)` - Calculate where line intersects bounding box
  - Parameters: point on line, angle, bounds `{left, right, top, bottom}`
  - Returns: `{x1, y1, x2, y2}` or null
  - Algorithm: Test intersection with each edge, keep two most extreme

**Intersection Computation:**
- `computeAllIntersections(lines)` - Find all pairwise line intersections
  - Parameters: array of line objects
  - Returns: array of `{x, y, lineIndices: [i, j]}`
  - Algorithm: Nested loop over line pairs

- `computeIntersections(lines, points)` - Cluster intersections by location (multi-intersections)
  - Parameters: lines array, points array (for updating references)
  - Returns: array of `{x, y, lineIndices: [...]}`
  - Algorithm:
    1. Get all pairwise intersections
    2. Cluster by location (threshold 0.1)
    3. Merge line indices for same location
    4. Return clustered intersections

**Point Position:**
- `getPointPosition(point, intersections)` - Get actual position of point (handles intersection refs if needed)
  - Parameters: point object, intersections array
  - Returns: `{x, y}`
  - Note: In new architecture, points don't store intersection refs, so this just returns `{x: point.x, y: point.y}`

**Intersection Finding:**
- `findIntersectionByLines(lineIndices, intersections)` - Find intersection that contains all given lines
  - Parameters: array of line indices, intersections array
  - Returns: intersection index or null
  - Algorithm: Loop through intersections, check if all lineIndices are present

**Notes:**
- Pure functions - no state, no side effects
- All math happens here, no geometric logic elsewhere
- Mostly unchanged from current implementation

---

## APPLICATION WIRING (app.js)

### `app.js`
**Purpose:** Create all instances, wire observers, coordinate rendering

**Data Structure:**
- **State instances:**
  - `configuration`: Configuration instance
  - `historyState`: HistoryState instance
  - `interactionState`: InteractionState instance
  - `transformState`: TransformState instance
  - `uiState`: UIState instance

- **Derived instances:**
  - `intersectionsComputer`: IntersectionsComputer instance
  - `highlightsComputer`: HighlightsComputer instance
  - `snapPreviewComputer`: SnapPreviewComputer instance
  - `visualOverlaysComputer`: VisualOverlaysComputer instance
  - `matroidComputer`: MatroidComputer instance

- **View instances:**
  - `canvasView`: CanvasView instance
  - `statsView`: StatsView instance
  - `debugMenuView`: DebugMenuView instance

- **Controller instances:**
  - `interactionController`: InteractionController instance
  - `historyController`: HistoryController instance
  - `operationsController`: OperationsController instance
  - `uiController`: UIController instance

**Main Functions:**
- `constructor(canvas)` - Initialize entire application
- `setupObservers()` - Wire all state change observers
- `render()` - Trigger view rendering
- `onConfigurationChanged(event)` - Handle configuration changes
- `onInteractionStateChanged()` - Handle interaction state changes
- `onTransformStateChanged()` - Handle transform changes
- `onUIStateChanged()` - Handle UI state changes
- `onHistoryStateChanged()` - Handle history changes
- `loadFromURL()` - Load configuration from URL hash on startup
- `updateURL()` - Update URL with current configuration (debounced)

**Initialization Flow:**

**1. Create all state instances:**
```javascript
this.configuration = new Configuration();
this.historyState = new HistoryState();
this.interactionState = new InteractionState();
this.transformState = new TransformState();
this.uiState = new UIState();
```

**2. Create derived instances (pass state references):**
```javascript
this.intersectionsComputer = new IntersectionsComputer(
  this.configuration
);

this.snapPreviewComputer = new SnapPreviewComputer(
  this.configuration,
  this.interactionState,
  this.intersectionsComputer,
  this.transformState
);

this.highlightsComputer = new HighlightsComputer(
  this.configuration,
  this.interactionState,
  this.uiState,
  this.snapPreviewComputer,
  this.intersectionsComputer
);

this.visualOverlaysComputer = new VisualOverlaysComputer(
  this.interactionState,
  this.configuration,
  this.snapPreviewComputer,
  this.intersectionsComputer,
  this.transformState
);

this.matroidComputer = new MatroidComputer(
  this.configuration,
  this.intersectionsComputer
);
```

**3. Create view instances:**
```javascript
this.canvasView = new CanvasView(
  canvas,
  this.configuration,
  this.interactionState,
  this.transformState,
  this.uiState,
  this.intersectionsComputer,
  this.highlightsComputer,
  this.visualOverlaysComputer,
  this.snapPreviewComputer
);

this.statsView = new StatsView(
  document.getElementById('panelContent'),
  this.matroidComputer,
  this.uiState,
  (pointIndices) => this.uiController.onStatsItemHover(pointIndices),
  () => this.uiController.onStatsItemUnhover()
);

this.debugMenuView = new DebugMenuView(
  document.getElementById('debugPanel'),
  this.configuration,
  this.intersectionsComputer,
  (x, y, onLines) => this.operationsController.addPointManual(x, y, onLines),
  (pointIndices) => this.operationsController.addLineManual(pointIndices),
  () => this.operationsController.exportConfiguration(),
  () => this.operationsController.clearAll()
);
```

**4. Create controller instances:**
```javascript
this.historyController = new HistoryController(
  this.historyState,
  this.configuration,
  this.intersectionsComputer
);

this.operationsController = new OperationsController(
  this.configuration,
  this.intersectionsComputer,
  this.transformState,
  this.historyController
);

this.interactionController = new InteractionController(
  canvas,
  this.configuration,
  this.interactionState,
  this.transformState,
  this.historyController,
  this.snapPreviewComputer,
  this.intersectionsComputer
);

this.uiController = new UIController(
  this.uiState,
  this.interactionState,
  this.historyController,
  this.operationsController,
  this.debugMenuView
);
```

**5. Setup observers:**
```javascript
this.setupObservers();
```

**6. Initialize canvas and load from URL:**
```javascript
this.transformState.centerOrigin();
this.loadFromURL();
this.render();
```

**Observer Setup:**

```javascript
setupObservers() {
  // Configuration changes → re-render
  this.configuration.subscribe((event) => {
    this.onConfigurationChanged(event);
  });

  // Interaction state changes → re-render
  this.interactionState.subscribe(() => {
    this.onInteractionStateChanged();
  });

  // Transform changes → re-render
  this.transformState.subscribe(() => {
    this.onTransformStateChanged();
  });

  // UI state changes → re-render
  this.uiState.subscribe(() => {
    this.onUIStateChanged();
  });

  // History state changes → update UI buttons
  this.historyState.subscribe(() => {
    this.onHistoryStateChanged();
  });
}
```

**Observer Handlers:**

```javascript
onConfigurationChanged(event) {
  // Update URL with new configuration (debounced)
  this.updateURL();
  
  // Re-render canvas and stats
  this.render();
}

onInteractionStateChanged() {
  // Re-render canvas (interaction affects overlays and highlights)
  this.canvasView.render();
}

onTransformStateChanged() {
  // Re-render canvas (transform affects what's visible)
  this.canvasView.render();
}

onUIStateChanged() {
  // Re-render both canvas and stats (UI affects both)
  this.render();
}

onHistoryStateChanged() {
  // Update undo/redo button states
  this.uiController.updateHistoryButtons();
}
```

**Render Method:**

```javascript
render() {
  // Render canvas
  this.canvasView.render();
  
  // Render stats panel
  this.statsView.render();
  
  // Update debug menu (if visible)
  if (this.debugMenuView.isVisible) {
    this.debugMenuView.render();
  }
}
```

**URL Management:**

```javascript
loadFromURL() {
  const hash = window.location.hash.slice(1); // Remove #
  if (hash) {
    const data = this.decodeFromURL(hash);
    if (data) {
      this.configuration.deserialize(data);
      // Clear history after loading
      this.historyState.clear();
    }
  }
}

updateURL() {
  // Debounce to avoid updating too frequently
  clearTimeout(this._urlUpdateTimeout);
  this._urlUpdateTimeout = setTimeout(() => {
    const encoded = this.configuration.serialize();
    const compressedHash = this.compressForURL(encoded);
    window.history.replaceState(null, '', `#${compressedHash}`);
  }, 500);
}
```

**Notes:**
- This is the ONLY place where observers are wired up
- All dependencies are explicitly passed (dependency injection)
- No circular dependencies (careful ordering)
- All rendering goes through this central coordinator

---

## COMPLETE DATA FLOW EXAMPLES

### Example 1: User Clicks to Add Point

```
1. User clicks canvas at (100, 200)
   ↓
2. InteractionController.handleMouseDown()
   - Calls transformState.screenToWorld() → (80, 150) world coords
   - Calls interactionState.setMouseDownPosition(80, 150, 100, 200, timestamp)
   - Calls configuration.getPointsAtPosition(80, 150, threshold)
   - No points found
   - Calls interactionState.transitionTo('draggingNewPoint', {startWorldX: 80, startWorldY: 150})
   ↓
3. InteractionState.transitionTo()
   - Updates state
   - Calls notify()
   ↓
4. InteractionState.notify()
   - Calls all observers (app.js subscribed)
   ↓
5. app.onInteractionStateChanged()
   - Calls canvasView.render()
   ↓
6. CanvasView.render()
   - Calls visualOverlaysComputer.compute()
     → Returns {ghostPoint: {x: 80, y: 150, pointIndex: -1}, ...}
   - Calls snapPreviewComputer.compute()
     → Checks for nearby points/lines/intersections
     → Returns snap object or null
   - Calls highlightsComputer.compute()
     → Returns highlights based on snap
   - Draws everything including ghost point
   ↓
7. User sees ghost point at cursor, snapping if near features

---

8. User moves mouse to (110, 210)
   ↓
9. InteractionController.handleMouseMove()
   - Calls transformState.screenToWorld() → (88, 158)
   - Calls interactionState.setMousePosition(88, 158, 110, 210)
   ↓
10. InteractionState.setMousePosition()
    - Updates mousePosition
    - Calls notify()
    ↓
11. app.onInteractionStateChanged()
    - Calls canvasView.render()
    ↓
12. CanvasView.render()
    - Calls visualOverlaysComputer.compute()
      → Now returns {ghostPoint: {x: 88, y: 158, pointIndex: -1}, ...}
    - Calls snapPreviewComputer.compute()
      → Recalculates snap for new position
    - Draws with updated ghost position

---

13. User releases mouse
    ↓
14. InteractionController.handleMouseUp()
    - Calculates drag distance
    - State is 'draggingNewPoint', not a click (dragged)
    - Gets final position from visualOverlaysComputer
    - Gets snap from snapPreviewComputer
    - If snapped:
      * Adds point at snap position with snap's line membership
    - Else:
      * Adds point at ghost position with no line membership
    - Calls configuration.addPoint(x, y, onLines)
    - Calls historyController.recordAddPoint(index, point)
    - Calls interactionState.transitionTo('idle')
    - Calls interactionState.clearMousePosition()
    ↓
15. Configuration.addPoint()
    - Adds point to points array
    - Calls notify({type: 'pointAdded', index, point})
    ↓
16. app.onConfigurationChanged()
    - Calls updateURL() (debounced)
    - Calls render()
    ↓
17. app.render()
    - Calls canvasView.render()
    - Calls statsView.render()
    ↓
18. Views render with new point visible
```

### Example 2: User Hovers Base in Stats Panel

```
1. User moves mouse over "{0, 1, 2}" in bases list
   ↓
2. StatsView internal hover listener fires
   - Parses data-points attribute → [0, 1, 2]
   - Calls onItemHoverCallback([0, 1, 2])
   ↓
3. Callback reaches UIController.onStatsItemHover([0, 1, 2])
   - Calls uiState.setHoveredPointsFromUI([0, 1, 2])
   ↓
4. UIState.setHoveredPointsFromUI()
   - Converts array to Set
   - Stores in hoveredPointsFromUI
   - Calls notify()
   ↓
5. app.onUIStateChanged()
   - Calls canvasView.render()
   ↓
6. CanvasView.render()
   - Calls highlightsComputer.compute()
     → highlightsComputer reads uiState.getHoveredPointsFromUI()
     → Returns {points: Set([0, 1, 2]), lines: Set([...])}
   - Draws with points 0, 1, 2 highlighted in orange

---

7. User moves mouse away from item
   ↓
8. StatsView internal hover listener (mouseleave) fires
   - Calls onItemUnhoverCallback()
   ↓
9. Callback reaches UIController.onStatsItemUnhover()
   - Calls uiState.clearHoveredPointsFromUI()
   ↓
10. UIState.clearHoveredPointsFromUI()
    - Clears hoveredPointsFromUI Set
    - Calls notify()
    ↓
11. app.onUIStateChanged()
    - Calls canvasView.render()
    ↓
12. CanvasView.render()
    - Calls highlightsComputer.compute()
      → Returns {points: Set([]), lines: Set([])}
    - Draws with no highlights
```

### Example 3: User Presses Ctrl+Z (Undo)

```
1. User presses Ctrl+Z
   ↓
2. UIController keyboard listener fires
   - Calls historyController.undo()
   ↓
3. HistoryController.undo()
   - Calls historyState.getUndoAction()
     → Returns {type: 'addPoint', data: {index: 5, point: {x, y, onLines}}}
   - Applies reverse of action:
     * Calls configuration.removePoint(5)
   - Calls historyState.moveBackward()
   ↓
4. Configuration.removePoint()
   - Removes point from array
   - Updates line memberships
   - Calls notify({type: 'pointRemoved', index: 5})
   ↓
5. app.onConfigurationChanged()
   - Calls updateURL()
   - Calls render()
   ↓
6. HistoryState.moveBackward()
   - Decrements currentIndex
   - Calls notify()
   ↓
7. app.onHistoryStateChanged()
   - Calls uiController.updateHistoryButtons()
   ↓
8. UIController.updateHistoryButtons()
   - Checks historyController.canUndo() → true
   - Checks historyController.canRedo() → true
   - Enables both buttons
   ↓
9. app.render()
   - Calls canvasView.render()
     → Point 5 no longer drawn
   - Calls statsView.render()
     → Matroid recomputed without point 5
```

---

## TESTING APPROACH

With this architecture, each layer is independently testable:

### Testing State:
```javascript
// Test Configuration
const config = new Configuration();
config.addPoint(0, 0, [0]);
assert(config.getPointsCount() === 1);
assert(config.getPoint(0).x === 0);
```

### Testing Derived:
```javascript
// Test HighlightsComputer
const config = new Configuration();
config.addPoint(0, 0, [0]);
const interactionState = new InteractionState();
const uiState = new UIState();
uiState.setHoveredPointsFromUI([0]);

const computer = new HighlightsComputer(config, interactionState, uiState, ...);
const highlights = computer.compute();

assert(highlights.points.has(0));
```

### Testing Controllers:
```javascript
// Test InteractionController
const mockConfig = new Configuration();
const mockInteractionState = new InteractionState();
const controller = new InteractionController(mockCanvas, mockConfig, ...);

controller.handleMouseDown(fakeMouseEvent);
assert(mockInteractionState.getStateType() === 'draggingNewPoint');
```

### Testing Views:
```javascript
// Test StatsView (harder without DOM, but possible with jsdom)
const mockElement = document.createElement('div');
const mockMatroidComputer = {
  compute: () => ({rank: 3, numPoints: 5, bases: [[0,1,2]]})
};
const view = new StatsView(mockElement, mockMatroidComputer, ...);

view.render();
assert(mockElement.innerHTML.includes('rank: 3'));
```

---

## MIGRATION PATH

You don't need to rewrite everything at once. Here's a suggested order:

### Phase 1: State Extraction (1-2 days)
1. Create `state/Configuration.js` - extract from PointLineManager
2. Create `state/InteractionState.js` - extract from StateManager
3. Create `state/TransformState.js` - extract from TransformManager
4. Create `state/UIState.js` - new
5. Create `state/HistoryState.js` - extract from HistoryManager
6. Wire observers in app.js
7. Test that everything still works

### Phase 2: Derived Extraction (1 day)
1. Create `derived/IntersectionsComputer.js` - extract from PointLineManager
2. Create `derived/SnapPreviewComputer.js` - extract from SnapManager
3. Create `derived/HighlightsComputer.js` - **CRITICAL** - consolidate scattered logic
4. Create `derived/VisualOverlaysComputer.js` - extract from StateManager
5. Create `derived/MatroidComputer.js` - wrap existing matroid.js
6. Test highlighting specifically

### Phase 3: View Simplification (1 day)
1. Refactor `CanvasView` - remove state management, just read and render
2. Refactor `StatsView` - just render, delegate hover to callbacks
3. Create `DebugMenuView` - extract from existing debug UI
4. Test rendering

### Phase 4: Controller Cleanup (1 day)
1. Refactor `InteractionController` - only modify state, never read derived
2. Refactor `HistoryController` - separate data from execution
3. Create `OperationsController` - extract complex operations
4. Create `UIController` - extract UI handlers from app.js
5. Test interactions

### Phase 5: Polish (1 day)
1. Add JSDoc comments
2. Add type hints (if using TypeScript or JSDoc types)
3. Test edge cases
4. Update documentation

**Total: ~5-6 days of focused work**

---

## SUMMARY

This architecture gives you:

✅ **Clear separation:** State / Derived / View / Controller  
✅ **Single source of truth:** Each piece of data has ONE authoritative location  
✅ **No scattered logic:** Highlighting is in ONE file, not four  
✅ **Testable:** Each layer can be tested independently  
✅ **Maintainable:** Easy to find and change code  
✅ **Scalable:** Easy to add new features  
✅ **Simple:** No caching, no dirty flags - just recompute when needed  
✅ **Observable:** State changes automatically trigger renders  

The key insight: **Not all state is equal.** Some state is primary (manually set), some is derived (computed from primary). Keeping these separate and using observers to connect them creates a clean, understandable architecture.