# Factory Labeling Line Simulator

A 2D top-down web simulator of an automated factory labeling line. Built with React, TypeScript, Vite, Zustand, and HTML5 Canvas.

![3-Panel Layout](https://img.shields.io/badge/Layout-3%20Panel-blue) ![Stack](https://img.shields.io/badge/Stack-React%20%2B%20Vite%20%2B%20Zustand-green) ![Renderer](https://img.shields.io/badge/Renderer-HTML5%20Canvas-orange)

## Overview

Simulates a complete factory labeling line:

- **Conveyor belt** carries boxes from left to right
- **Two printers** (WS51 large, WS52 small) produce labels
- **SCARA robot arm** picks labels and pastes them onto boxes
- **Scanner** checks for labels and routes boxes to pass/reject chutes
- **Live statistics** track throughput, reject rates, and uptime

## Screenshots

The application runs in a 3-panel layout:
- **Left (15%)** — Configuration parameters (label type, belt speed, robot speed, etc.)
- **Center (70%)** — 2D Canvas simulation with real-time animation
- **Right (15%)** — Simulation controls and live statistics

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
git clone https://github.com/abh33k/labelSim.git
cd labelSim
npm install
```

### Development

```bash
npm run dev
```

Opens at `http://localhost:5173`

### Build

```bash
npm run build
```

Outputs to `dist/` directory.

## Architecture

```
src/
├── simulation/
│   └── types.ts              # Data types: SimBox, ScaraState, PrinterStatus, SimulationConfig
├── store/
│   └── simulationStore.ts    # Core simulation logic (Zustand store, tick() runs every frame)
├── scene/
│   └── FactoryCanvas.tsx     # 2D Canvas renderer (800×600 internal)
├── ui/
│   ├── ConfigPanel.tsx       # Left panel — parameter sliders
│   ├── ControlPanel.tsx      # Right panel — Start/Pause/Reset/Speed
│   └── StatsDisplay.tsx      # Right panel — live statistics
└── App.tsx                   # Root layout + animation loop
```

### Key Design Decisions

- **Single Zustand store** — all simulation state lives in one store; the canvas is a pure renderer
- **No 3D** — pure 2D Canvas rendering for simplicity and performance
- **Duplicated constants** — layout geometry constants exist in both `simulationStore.ts` (physics) and `FactoryCanvas.tsx` (rendering). Update both when changing layout.

## Simulation Flow

### SCARA Arm Cycle

```
idle → reaching → picking → waiting → tracking → applying → reaching → ...
```

| Phase | Description | Duration |
|-------|-------------|----------|
| `idle` | Waits for printer to be ready | Variable |
| `reaching` | Extends arm toward label on printer | ~0.45s |
| `picking` | zDown, grab label, trigger next print, zUp | 0.4s |
| `waiting` | Positions over conveyor, waits for box | Variable |
| `tracking` | Swings toward box (extension lags behind swing) | ~1.0s |
| `applying` | Holds position, pastes label | 0.6s |

**Abandon behavior:** If a box moves out of reach, the robot keeps the label and waits for the next box.

### Box Lifecycle

```
spawning → conveying → being_tracked → conveying_to_scanner → sorting → done
```

- Unlabeled boxes auto-reject at the scanner
- Boxes maintain minimum spacing on the belt
- Pass → south chute, Reject → north chute

## Configuration

### Simulation Parameters

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| Label Type | small/large | large | Active printer selection |
| Spawn Interval | 1.0–6.0s | 2.5s | Time between box spawns |
| Belt Speed | 40–200 px/s | 100 | Conveyor belt speed |
| Robot Speed | 10–100% | 100% | Scales all robot motion |
| Fail Rate | 0–50% | 15% | Scanner reject probability |

### Simulation Speed

| Speed | Description |
|-------|-------------|
| 0.5x | Half speed for debugging |
| 1x | Normal speed |
| 2x | Double speed |
| 5x | Fast forward |

## Visual Features

- **Box shadows** — depth effect on conveyor items
- **Arm link shadows** — 3D appearance on robot segments
- **Joint detail** — mechanical inner ring on arm joints
- **LED glow** — active elements emit light
- **Box fade-in** — smooth entry animation
- **Label paste flash** — visual feedback on label application
- **Scanner beam sweep** — animated laser line
- **Conveyor roller rotation** — end rollers spin with belt
- **Floor texture** — concrete noise pattern
- **Belt support brackets** — structural detail under belt
- **Idle arm bob** — subtle breathing motion when waiting

## Tech Stack

| Technology | Purpose |
|------------|---------|
| React 18 | UI framework |
| TypeScript | Type safety |
| Vite | Build tool + dev server |
| Zustand | State management |
| Tailwind CSS | UI styling |
| HTML5 Canvas | 2D rendering |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (port 5173) |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview production build |
| `npx tsc --noEmit` | Typecheck only (fast) |

## Future Plans

- [ ] **Throughput chart** — real-time graph of boxes/min over time
- [ ] **Per-printer utilization** — % time each printer is active
- [ ] **Multiple robot arms** — parallel labeling stations
- [ ] **Buffer zones** — accumulation areas between stations
- [ ] **Preset scenarios** — "high speed", "high reject" configs
- [ ] **Sound effects** — audio cues for label paste, reject, printer ready
- [ ] **Export to CSV** — download simulation data
- [ ] **Event log** — scrollable panel showing label/paste/reject events
- [ ] **Mobile/tablet** — responsive layout for factory floor viewing

## License

MIT

## Author

Abheek — [github.com/abh33k](https://github.com/abh33k)
