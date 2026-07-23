# Factory Labeling Line Simulator — Full Specification

## Overview

2D top-down web simulator of an automated factory labeling line. A conveyor belt carries boxes from left to right. A SCARA robot arm picks labels from one of two printers and pastes them onto boxes. A scanner near the end checks for labels and routes boxes to pass or reject chutes.

**Stack:** React 18, TypeScript, Vite, Zustand (state), Tailwind CSS (UI), HTML5 Canvas (rendering).

**No 3D, no Three.js.** Pure 2D Canvas.

---

## Layout

3-panel flex layout, `flex h-screen`:

| Panel | Width | Content |
|---|---|---|
| **Left** | 15% (min 180px) | ConfigPanel — always-visible parameter sliders |
| **Middle** | 70% | FactoryCanvas (800×600 internal) + robot status indicator below robot |
| **Right** | 15% (min 180px) | ControlPanel (Start/Pause/Reset/Speed) + StatsDisplay |

Panels have `bg-gray-800` cards with `border border-gray-700`. Background: `bg-gray-900`.

---

## Canvas Coordinate System

Internal canvas: **800×600 pixels**. Scales to fill the middle panel.

### Layout Constants (MUST match between store and canvas)

```
W = 800, H = 600
BELT_Y = 300          // Belt centerline Y
BELT_H = 50           // Belt height
BELT_TOP = 275, BELT_BOT = 325
BELT_LEFT = 80, BELT_RIGHT = 720

ROBOT_X = 250         // Robot base X
ROBOT_Y = 365         // Robot base Y (south of belt)

PRINTER_LARGE_X = 285 // Large label printer X (WS51)
PRINTER_SMALL_X = 225 // Small label printer X (WS52)
PRINTER_Y = 225       // Both printers Y (north of belt)
LABEL_OFFSET_Y = 27   // Label sheet Y offset below printer

SCANNER_X = 500       // Scanner position X
CHUTE_X = 620         // Chute junction X
CHUTE_PASS_Y = 420    // Pass chute Y (south)
CHUTE_REJECT_Y = 180  // Reject chute Y (north)
SORT_X = 620          // End-of-line X for sorting

ARM_LENGTH_1 = 80     // First arm segment (px)
ARM_LENGTH_2 = 70     // Second arm segment (px)
// Total reach = 150px
```

These constants are defined in both `simulationStore.ts` (module-level, exported for App.tsx end effector calc) and `FactoryCanvas.tsx` (local to renderer). They are **duplicated** — no shared config.

---

## Data Types (`src/simulation/types.ts`)

### BoxSize
`'small' | 'large'`

### BoxPhase
`'spawning' | 'conveying' | 'being_tracked' | 'conveying_to_scanner' | 'sorting' | 'done'`

### ScanResult
`'pending' | 'pass' | 'reject'`

### SimBox
```ts
{
  id: number
  x: number           // Center X on canvas
  y: number           // Center Y on canvas
  size: BoxSize
  phase: BoxPhase
  scanResult: ScanResult
  hasLabel: boolean
  labelType: BoxSize
  speed: number       // Current speed (px/s)
  phaseTimer: number
  color: string       // Random from preset palette
}
```

Box dimensions: `BOX_SIZE_PX = 32`. Min gap between boxes: `MIN_GAP = 100`.

### PrinterStatus
```ts
{
  id: 'large' | 'small'
  printing: boolean   // Currently printing a label
  ready: boolean      // Label ready to pick
  timer: number       // Print progress timer
}
```

Print times: Large = 1.5s, Small = 0.9s.

### ScaraState
```ts
{
  angle: number
  reach: number       // 0–1, normalized arm extension
  zDown: boolean      // Gripper pressed down
  holdingLabel: boolean
  activePrinter: 'large' | 'small'
  targetBoxId: number | null
  trackX: number      // Arm tip X during tracking
  phaseTimer: number  // Used in picking (0.4s) and applying (0.6s)
  phase: 'idle' | 'reaching' | 'picking' | 'waiting' | 'tracking' | 'applying'
}
```

### SimulationConfig
```ts
{
  spawnInterval: number  // Seconds between box spawns (default 2.5)
  beltSpeed: number      // Belt speed in px/s (default 100)
  failRate: number       // Scanner reject probability 0–0.5 (default 0.15)
  labelType: BoxSize     // Active label type (default 'large')
  robotSpeed: number     // 0.1–1.0, scales all robot lerp rates (default 1.0)
}
```

### SimulationStats
```ts
{
  totalProcessed: number
  totalPassed: number
  totalRejected: number
  startTime: number
}
```

---

## Simulation Logic (`src/store/simulationStore.ts`)

All state lives in one Zustand store. The `tick(delta)` function runs every frame.

### Tick Order
1. **Printer logic** — advance print timers, mark `ready` when done
2. **Spawn gate** — create box if `spawnTimer >= spawnInterval` and no box is too close to spawn point
3. **Box logic** — update each box based on phase
4. **SCARA arm logic** — state machine based on current phase
5. **Cleanup** — filter out `done` boxes, set state

### Box Phase Transitions

```
spawning → conveying
conveying → being_tracked (when robot picks it up in waiting phase)
conveying → sorting (unlabeled fallback: box passes scanner → auto-reject)
being_tracked → conveying_to_scanner (when label applied)
conveying_to_scanner → sorting (at scanner: pass or reject based on failRate)
sorting → done (at SORT_X)
```

**Key behaviors:**
- Boxes always move continuously — no belt pause logic
- Box spacing: slow down if gap < MIN_GAP + BOX_SIZE_PX, never stop
- Unlabeled boxes that reach the scanner get auto-rejected (fallback in `conveying`)
- Sorting: pass → y lerps to 420 (south chute), reject → y lerps to 180 (north chute)

### SCARA Arm Cycle

```
idle → reaching → picking → waiting → tracking → applying → reaching → ...
```

**Phase details:**

| Phase | Behavior | Duration |
|---|---|---|
| `idle` | Waits for active printer to be ready | Until printer.ready |
| `reaching` | Extends arm toward label center on printer. Lerp rate: `delta * 8 * robotSpeed` | Until reach ≈ labelReach |
| `picking` | zDown (0–0.15s), grab label + trigger next print (0.15–0.25s), zUp (0.25–0.4s). Timer scaled by `robotSpeed` | 0.4s |
| `waiting` | Extends to conveyor center Y at printer X. Scans for eligible box in TRACK_ZONE_START–END | Until box found |
| `tracking` | Swings toward box. trackX lerp: `delta * 3 * robotSpeed`. Reach lerp: `delta * 1.2 * robotSpeed` (slow extension). Transitions when `|trackX - box.x| < 8` | Until close to box |
| `applying` | Locks onto box. zDown=true. Holds for 0.6s timer (scaled by robotSpeed). Sets `hasLabel=true` | 0.6s |

**Abandon behavior:** In `tracking` or `applying`, if `targetBox.x > SORT_X - 50`, the robot **keeps the label** and goes to `waiting` to try the next box.

**Tracker zone:** `TRACK_ZONE_START = ROBOT_X - 80`, `TRACK_ZONE_END = ROBOT_X + 40`. Only boxes in this zone during `waiting` are eligible.

### Lerp Rates (at 100% robotSpeed)

| Target | Rate | Approx Time |
|---|---|---|
| Reaching | `delta * 8` | ~0.45s |
| Tracking (swing) | `delta * 3` | ~1.0s |
| Tracking (extend) | `delta * 1.2` | ~2.5s |
| Applying (extend) | `delta * 4` | ~0.75s |
| Waiting (extend) | `delta * 3` | ~1.0s |

### Printer Switching

When `labelType` changes in config:
1. The selected printer starts printing immediately (`printing=true, ready=false, timer=0`)
2. `scara.activePrinter` switches to the new type

---

## Rendering (`src/scene/FactoryCanvas.tsx`)

### Draw Order (back to front)
1. Factory floor (grid pattern)
2. Conveyor belt (animated stripes)
3. Printers (WS51 large, WS52 small)
4. Label feed path lines (dashed, printers → robot base)
5. Feeder (left side, animated arrow)
6. **Boxes** (before arm — arm renders on top)
7. SCARA arm
8. Scanner
9. Chutes (pass/reject)
10. Dashed connection lines (belt → chutes)
11. Title and labels

### Arm Rendering
- Directional for all active phases (reaching, picking, waiting, tracking, applying)
- Idle: angle-based rendering (reach=0)
- Elbow bend: 8px offset when `useBoxTarget && reach > 0.5`
- Gripper: small circle (4px if holding label, 6px otherwise)
- Z-down indicator: dashed X pattern when zDown=true
- Tracking line: dashed green line from arm tip to tracked box

### Printer Rendering
- 60×35px rounded rect
- Status LED: green (ready), yellow (printing), gray (idle)
- Label sheet below printer when ready (14×10 rect)
- Progress bar during printing (0–100% width)

### Box Rendering
- 32×32 rounded rect with random color
- Inner cream-colored fill
- Label overlay when `hasLabel`: white rect with L/S text
- Pulsing green dashed border when `being_tracked`

### Scanner
- Two posts (top/bottom of belt) with connecting laser line
- Laser pulses red when scanning, dim when idle
- LED indicator above scanner

---

## UI Components

### ConfigPanel (Left Panel)
Always visible, no toggle. Contains:
- **Label Type** — toggle buttons (small/large)
- **Spawn Interval** — slider 1.0–6.0s, step 0.1
- **Belt Speed** — slider 40–200 px/s, step 5
- **Robot Speed** — slider 10–100%, step 5
- **Fail Rate** — slider 0–50%, step 1%

### ControlPanel (Right Panel)
- **Start/Pause** button (green/red)
- **Reset** button
- **Speed** selector: 0.5x, 1x, 2x, 5x

### StatsDisplay (Right Panel)
Live stats:
- Status (RUNNING/STOPPED)
- Uptime (MM:SS)
- On Belt (count)
- Processed / Passed / Rejected
- Throughput (boxes/min)
- Reject Rate (%)

### Robot Status Indicator
Positioned absolutely at `(31.25%, 66%)` in the middle panel (just below the robot base). Shows:
```
STATE:    TRACKING
LABEL:    YES
GRIPPER:  (320, 300)
```

End effector position is computed using the same kinematics as the renderer (directional for active phases, angle-based for idle).

---

## App.tsx Structure

```tsx
<div className="flex h-screen w-screen bg-gray-900">
  <aside className="w-[15%]"> <ConfigPanel /> </aside>
  <main className="w-[70%] relative"> <FactoryCanvas /> + robot status </main>
  <aside className="w-[15%]"> <ControlPanel /> + <StatsDisplay /> </aside>
</div>
```

Animation loop: `requestAnimationFrame` → `tick(delta)` → React re-renders → Canvas redraws via `useSimStore.getState()`.

---

## Dev Server

- Port: 5173 (Vite default)
- `allowedHosts: ['cartouche']` in vite.config.ts
- Typecheck: `npx tsc --noEmit` (~1s)
- Build: `npx vite build` (~1s, outputs to `dist/`)
- No linter, formatter, or tests configured

---

## Conventions

- **No comments** in code unless explicitly asked
- All simulation state in Zustand store; canvas is a dumb renderer
- UI uses Tailwind classes; canvas uses raw Canvas2D API
- `robotSpeed` (0.1–1.0) scales all robot lerp rates AND picking timer
- `noUnusedLocals` and `noUnusedParameters` are OFF in tsconfig
- Constants duplicated between store and renderer — update both when changing layout
