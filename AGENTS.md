# Factory Labeling Line Simulator

2D top-down factory simulator: conveyor belt, two printers, SCARA robot arm, scanner, pass/reject chutes. React + Vite + Zustand + Canvas.

## Commands

| Command | Purpose |
|---|---|
| `npx tsc --noEmit` | Typecheck (fast, ~1s) |
| `npx vite build` | Full build |
| `npm run dev` | Dev server (port 5173) |

No linter, formatter, or tests are configured. The `build` script in package.json runs `tsc -b && vite build`.

Always typecheck + build after editing to catch errors.

## Architecture

Single-package React app. All source in `src/`.

| Path | Role |
|---|---|
| `src/simulation/types.ts` | Data types: `SimBox`, `ScaraState`, `PrinterStatus`, `SimulationConfig` |
| `src/store/simulationStore.ts` | **Core file.** All simulation logic in one Zustand store. `tick()` runs every frame. |
| `src/scene/FactoryCanvas.tsx` | 2D Canvas renderer. Reads store state, draws everything. |
| `src/App.tsx` | 3-panel layout (15/70/15), animation loop, robot status indicator. |
| `src/ui/ConfigPanel.tsx` | Left panel — always-visible parameter sliders. |
| `src/ui/ControlPanel.tsx` | Right panel — Start/Pause/Reset/Speed buttons. |
| `src/ui/StatsDisplay.tsx` | Right panel — live pass/reject/throughput stats. |

## Layout

3-panel flex layout (`flex h-screen`):
- **Left 15%** — `ConfigPanel` (always open, no toggle)
- **Middle 70%** — `FactoryCanvas` + robot status indicator positioned below the robot at `(31.25%, 66%)`
- **Right 15%** — `ControlPanel` + `StatsDisplay`

## Key Constants (in simulationStore.ts)

Layout geometry is defined as module-level constants, NOT in config:
- `BELT_Y=300`, `ROBOT_X=250`, `ROBOT_Y=365`
- `PRINTER_LARGE_X=285`, `PRINTER_SMALL_X=225`, `PRINTER_Y=225`
- `SCANNER_X=500`, `SORT_X=620`
- `ARM_LENGTH_1=80`, `ARM_LENGTH_2=70` (total reach=150px)
- `PRINT_TIME_LARGE=1.5s`, `PRINT_TIME_SMALL=0.9s`
- `LABEL_OFFSET_Y=27` (label sheet position below printer)

When adding visual elements or physics, these constants must match between the store (tick logic) and FactoryCanvas (rendering). There is no shared config — they are duplicated.

## Simulation Flow

SCARA arm cycle: `idle → reaching → picking → waiting → tracking → applying → reaching → ...`

- `waiting`: arm holds at conveyor center Y, waits for box to enter tracking zone
- `tracking`: swings toward box, extension lags behind swing (realistic motion)
- `applying`: holds for 0.6s timer, pastes label, then goes to `reaching`
- Abandon: if box moves past `SORT_X - 50`, robot keeps label and goes to `waiting`

Boxes: `spawning → conveying → being_tracked → conveying_to_scanner → sorting → done`

Unlabeled boxes auto-reject at scanner (fallback in `conveying` phase).

No belt pause logic — boxes always move continuously.

## Conventions

- No comments in code — keep it that way unless asked
- All simulation state lives in the Zustand store; canvas is purely a dumb renderer
- UI uses Tailwind classes; canvas rendering uses raw Canvas2D API
- `robotSpeed` config (0.1–1.0) scales all robot lerp rates AND picking timer
- Dev server `allowedHosts: ['cartouche']` in vite.config.ts
- `noUnusedLocals` and `noUnusedParameters` are OFF in tsconfig
