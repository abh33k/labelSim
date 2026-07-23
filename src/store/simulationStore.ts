import { create } from 'zustand'
import type {
  SimBox,
  ScaraState,
  PrinterStatus,
  SimulationConfig,
  SimulationStats,
} from '../simulation/types'
import { BOX_SIZE_PX, MIN_GAP } from '../simulation/types'

let nextBoxId = 1

function createBox(labelType: 'small' | 'large'): SimBox {
  const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22']
  return {
    id: nextBoxId++,
    x: 60,
    y: 300,
    size: labelType,
    phase: 'spawning',
    scanResult: 'pending',
    hasLabel: false,
    labelType,
    speed: 0,
    phaseTimer: 0,
    color: colors[Math.floor(Math.random() * colors.length)],
    spawnTime: performance.now(),
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, t)
}

export const BELT_Y = 300
export const ROBOT_X = 250
export const ROBOT_Y = 365
const SCANNER_X = 500
const SORT_X = 620
const SPAWN_X = 60
const PRINT_TIME_LARGE = 1.5
const PRINT_TIME_SMALL = 0.9
const TRACK_ZONE_START = ROBOT_X - 80
const TRACK_ZONE_END = ROBOT_X + 40
export const PRINTER_LARGE_X = 285
export const PRINTER_SMALL_X = 225
export const PRINTER_Y = 225
export const LABEL_OFFSET_Y = 27
export const ARM_LENGTH_1 = 80
export const ARM_LENGTH_2 = 70

export interface SimStore {
  isRunning: boolean
  speed: number
  boxes: SimBox[]
  scara: ScaraState
  printers: PrinterStatus[]
  config: SimulationConfig
  stats: SimulationStats
  spawnTimer: number

  toggleRunning: () => void
  setSpeed: (s: number) => void
  updateConfig: (partial: Partial<SimulationConfig>) => void
  reset: () => void
  tick: (delta: number) => void
}

const initialConfig: SimulationConfig = {
  spawnInterval: 2.5,
  beltSpeed: 100,
  failRate: 0.15,
  labelType: 'large',
  robotSpeed: 1.0,
}

const initialScara: ScaraState = {
  angle: 0.3,
  reach: 0.6,
  zDown: false,
  holdingLabel: false,
  activePrinter: initialConfig.labelType,
  targetBoxId: null,
  trackX: ROBOT_X,
  phaseTimer: 0,
  phase: 'idle',
}

const initialStats: SimulationStats = {
  totalProcessed: 0,
  totalPassed: 0,
  totalRejected: 0,
  startTime: Date.now(),
}

function makePrinters(): PrinterStatus[] {
  return [
    { id: 'large', printing: initialConfig.labelType === 'large', ready: false, timer: 0 },
    { id: 'small', printing: initialConfig.labelType === 'small', ready: false, timer: 0 },
  ]
}

export const useSimStore = create<SimStore>((set, get) => ({
  isRunning: false,
  speed: 1,
  boxes: [],
  scara: { ...initialScara },
  printers: makePrinters(),
  config: { ...initialConfig },
  stats: { ...initialStats },
  spawnTimer: 0,

  toggleRunning: () => set((s) => ({ isRunning: !s.isRunning })),
  setSpeed: (speed) => set({ speed }),
  updateConfig: (partial) =>
    set((s) => {
      const next = { ...s.config, ...partial }
      const updates: Partial<SimStore> = { config: next }
      if (partial.labelType && partial.labelType !== s.config.labelType) {
        // Switch active printer and start it printing
        const printers = s.printers.map((p) => {
          if (p.id === partial.labelType) {
            return { ...p, printing: true, ready: false, timer: 0 }
          }
          return { ...p, printing: false, ready: false, timer: 0 }
        })
        updates.scara = { ...s.scara, activePrinter: partial.labelType }
        updates.printers = printers
      }
      return updates
    }),

  reset: () => {
    nextBoxId = 1
    set({
      boxes: [],
      scara: { ...initialScara },
      printers: makePrinters(),
      stats: { ...initialStats, startTime: Date.now() },
      spawnTimer: 0,
    })
  },

  tick: (rawDelta) => {
    const state = get()
    if (!state.isRunning) return

    const delta = rawDelta * state.speed
    const { config } = state

    let boxes = [...state.boxes]
    let scara = { ...state.scara }
    let printers = state.printers.map((p) => ({ ...p }))
    let stats = { ...state.stats }
    let spawnTimer = state.spawnTimer + delta

    // --- PRINTER LOGIC ---
    printers = printers.map((p) => {
      if (p.printing) {
        const printTime = p.id === 'large' ? PRINT_TIME_LARGE : PRINT_TIME_SMALL
        const t = p.timer + delta
        if (t >= printTime) {
          return { ...p, printing: false, ready: true, timer: 0 }
        }
        return { ...p, timer: t }
      }
      return p
    })

    // --- SPAWN GATE ---
    const canSpawn = !boxes.some((b) => b.x < SPAWN_X + MIN_GAP + BOX_SIZE_PX)
    if (spawnTimer >= config.spawnInterval && canSpawn) {
      spawnTimer = 0
      boxes.push(createBox(config.labelType))
    }

    // --- BOX LOGIC ---
    boxes.sort((a, b) => a.x - b.x)

    const activePrinter = printers.find((p) => p.id === scara.activePrinter)

    boxes = boxes.map((box) => {
      const b = { ...box }

      switch (b.phase) {
        case 'spawning':
          b.phase = 'conveying'
          b.speed = config.beltSpeed
          break

        case 'conveying': {
          // Find the nearest box ahead
          const boxAhead = boxes.find(
            (other) =>
              other.id !== b.id &&
              other.x > b.x &&
              other.phase !== 'done' &&
              other.phase !== 'sorting' &&
              other.phase !== 'conveying_to_scanner'
          )

          // Maintain minimum gap — slow down if too close, never stop
          if (boxAhead) {
            const gap = boxAhead.x - b.x
            if (gap < MIN_GAP + BOX_SIZE_PX) {
              b.speed = Math.max(boxAhead.speed - 20, config.beltSpeed * 0.3)
            } else {
              b.speed = config.beltSpeed
            }
          } else {
            b.speed = config.beltSpeed
          }

          b.x += b.speed * delta

          // Fallback: scan unlabeled boxes that pass the scanner
          if (b.x >= SCANNER_X) {
            b.scanResult = 'reject'
            b.phase = 'sorting'
            b.speed = config.beltSpeed * 0.7
            stats.totalProcessed++
            stats.totalRejected++
            break
          }
          break
        }

        case 'being_tracked':
          // Box keeps moving at belt speed while robot tracks it
          b.x += b.speed * delta
          b.speed = config.beltSpeed
          // Phase transitions to conveying_to_scanner when label is applied
          if (b.hasLabel) {
            b.phase = 'conveying_to_scanner'
            b.speed = config.beltSpeed
          }
          break

        case 'conveying_to_scanner':
          b.x += b.speed * delta
          if (b.x >= SCANNER_X) {
            // Instant scan — no conveyor stop
            if (!b.hasLabel) {
              b.scanResult = 'reject'
            } else {
              b.scanResult = Math.random() > config.failRate ? 'pass' : 'reject'
            }
            b.phase = 'sorting'
            b.speed = config.beltSpeed * 0.7
            b.phaseTimer = 0
            stats.totalProcessed++
            if (b.scanResult === 'pass') stats.totalPassed++
            else stats.totalRejected++
          }
          break

        case 'sorting':
          b.x += b.speed * delta
          b.speed = config.beltSpeed * 0.7
          if (b.scanResult === 'pass') {
            b.y = lerp(b.y, 420, delta * 3)
          } else {
            b.y = lerp(b.y, 180, delta * 3)
          }
          if (b.x >= SORT_X) {
            b.phase = 'done'
          }
          break

        case 'done':
          break
      }

      return b
    })

    boxes = boxes.filter((b) => b.phase !== 'done')

    // --- SCARA ARM LOGIC ---
    const targetBox = boxes.find((b) => b.id === scara.targetBoxId)

    switch (scara.phase) {
      case 'idle': {
        // Subtle breathing motion when idle
        scara.reach = 0.6 + Math.sin(Date.now() * 0.002) * 0.02
        if (activePrinter?.ready) {
          scara.phase = 'reaching'
        }
        break
      }

      case 'reaching': {
        // Compute actual distance to label center
        const px = scara.activePrinter === 'large' ? PRINTER_LARGE_X : PRINTER_SMALL_X
        const py = PRINTER_Y + LABEL_OFFSET_Y
        const lDist = Math.sqrt((px - ROBOT_X) ** 2 + (py - ROBOT_Y) ** 2)
        const labelReach = Math.min(lDist / (ARM_LENGTH_1 + ARM_LENGTH_2), 1)

        scara.reach = lerp(scara.reach, labelReach, delta * 8 * config.robotSpeed)
        scara.zDown = false
        scara.phaseTimer = 0
        if (scara.reach > labelReach - 0.02) {
          scara.reach = labelReach
          scara.phase = 'picking'
        }
        break
      }

      case 'picking': {
        scara.phaseTimer += delta * config.robotSpeed

        // Phase 1: zDown to label (0–0.15s)
        if (scara.phaseTimer < 0.15) {
          scara.zDown = true
        }
        // Phase 2: grab label (0.15–0.25s)
        else if (scara.phaseTimer < 0.25) {
          scara.zDown = true
          if (!scara.holdingLabel) {
            scara.holdingLabel = true
            printers = printers.map((p) =>
              p.id === scara.activePrinter
                ? { ...p, ready: false, printing: true, timer: 0 }
                : p
            )
          }
        }
        // Phase 3: zUp with label (0.25–0.4s)
        else if (scara.phaseTimer < 0.4) {
          scara.zDown = false
        }
        // Done — move to waiting position over conveyor
        else {
          scara.zDown = false
          scara.phaseTimer = 0
          scara.phase = 'waiting'
        }
        break
      }

      case 'waiting': {
        // Arm moves to conveyor center Y while staying at printer X
        const waitX = scara.activePrinter === 'large' ? PRINTER_LARGE_X : PRINTER_SMALL_X
        const waitDx = waitX - ROBOT_X
        const waitDy = BELT_Y - ROBOT_Y
        const waitDist = Math.sqrt(waitDx * waitDx + waitDy * waitDy)
        const waitReach = Math.min(waitDist / (ARM_LENGTH_1 + ARM_LENGTH_2), 1)

        scara.reach = lerp(scara.reach, waitReach, delta * 3 * config.robotSpeed)
        scara.trackX = waitX
        scara.zDown = false

        // Once arm is at waiting position, scan for eligible box
        if (Math.abs(scara.reach - waitReach) < 0.03) {
          const eligible = boxes.find(
            (b) =>
              b.x >= TRACK_ZONE_START &&
              b.phase === 'conveying' &&
              !b.hasLabel
          )
          if (eligible) {
            scara.targetBoxId = eligible.id
            const bi = boxes.findIndex((bx) => bx.id === eligible.id)
            if (bi >= 0) boxes[bi] = { ...boxes[bi], phase: 'being_tracked' }
            scara.phase = 'tracking'
          }
        }
        break
      }

      case 'tracking': {
        if (targetBox && targetBox.phase === 'being_tracked') {
          // Abandon if box moved out of robot's workspace — keep label for next box
          if (targetBox.x > SORT_X - 50) {
            scara.targetBoxId = null
            scara.trackX = ROBOT_X
            scara.phaseTimer = 0
            scara.phase = 'waiting'
            break
          }

          // Smoothly swing arm from printer to box
          scara.trackX = lerp(scara.trackX, targetBox.x, delta * 3 * config.robotSpeed)

          // Extension adjusts slowly behind the swing — no sudden retraction
          const dx = targetBox.x - ROBOT_X
          const dy = BELT_Y - ROBOT_Y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const maxReach = ARM_LENGTH_1 + ARM_LENGTH_2
          const normalizedDist = Math.min(dist / maxReach, 1)

          scara.reach = lerp(scara.reach, normalizedDist, delta * 1.2 * config.robotSpeed)
          scara.zDown = false

          // Transition when arm tip is close to the box horizontally
          if (Math.abs(scara.trackX - targetBox.x) < 8) {
            scara.phaseTimer = 0
            scara.phase = 'applying'
          }
        } else {
          // No target — scan for nearest eligible box
          scara.targetBoxId = null
          const eligible = boxes.find(
            (b) =>
              b.x >= TRACK_ZONE_START &&
              b.phase === 'conveying' &&
              !b.hasLabel
          )
          if (eligible) {
            scara.targetBoxId = eligible.id
            scara.trackX = scara.activePrinter === 'large' ? PRINTER_LARGE_X : PRINTER_SMALL_X
            const bi = boxes.findIndex((bx) => bx.id === eligible.id)
            if (bi >= 0) boxes[bi] = { ...boxes[bi], phase: 'being_tracked' }
          }
          // If no eligible box, stay in tracking and wait
        }
        break
      }

      case 'applying': {
        if (targetBox && targetBox.phase === 'being_tracked') {
          // Abandon if box moved out of robot's workspace — keep label for next box
          if (targetBox.x > SORT_X - 50) {
            scara.targetBoxId = null
            scara.trackX = ROBOT_X
            scara.phaseTimer = 0
            scara.phase = 'waiting'
            break
          }

          scara.trackX = targetBox.x

          const dx = targetBox.x - ROBOT_X
          const dy = BELT_Y - ROBOT_Y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const maxReach = ARM_LENGTH_1 + ARM_LENGTH_2
          const normalizedDist = Math.min(dist / maxReach, 1)

          scara.reach = lerp(scara.reach, normalizedDist, delta * 4 * config.robotSpeed)
          scara.zDown = true

          // Hold position for 0.6s while pressing label
          scara.phaseTimer += delta * config.robotSpeed
          if (scara.phaseTimer >= 0.6) {
            scara.holdingLabel = false

            const bi = boxes.findIndex((bx) => bx.id === targetBox.id)
            if (bi >= 0) {
              boxes[bi] = { ...boxes[bi], hasLabel: true }
            }

            // Go directly to printer for next label — continuous cycle
            scara.targetBoxId = null
            scara.phaseTimer = 0
            scara.phase = 'reaching'
          }
        } else {
          scara.targetBoxId = null
          scara.phase = 'reaching'
        }
        break
      }
    }

    set({ boxes, scara, printers, stats, spawnTimer })
  },
}))
