export type BoxSize = 'small' | 'large'

export type BoxPhase =
  | 'spawning'
  | 'conveying'
  | 'being_tracked'
  | 'conveying_to_scanner'
  | 'sorting'
  | 'done'

export type ScanResult = 'pending' | 'pass' | 'reject'

export interface SimBox {
  id: number
  x: number
  y: number
  size: BoxSize
  phase: BoxPhase
  scanResult: ScanResult
  hasLabel: boolean
  labelType: BoxSize
  speed: number
  phaseTimer: number
  color: string
  spawnTime: number
}

export interface PrinterStatus {
  id: 'large' | 'small'
  printing: boolean
  ready: boolean
  timer: number
}

export interface ScaraState {
  angle: number
  reach: number
  zDown: boolean
  holdingLabel: boolean
  activePrinter: 'large' | 'small'
  targetBoxId: number | null
  trackX: number
  phaseTimer: number
  phase: 'idle' | 'reaching' | 'picking' | 'waiting' | 'tracking' | 'applying'
}

export interface SimulationConfig {
  spawnInterval: number
  beltSpeed: number
  failRate: number
  labelType: BoxSize
  robotSpeed: number
}

export interface SimulationStats {
  totalProcessed: number
  totalPassed: number
  totalRejected: number
  startTime: number
}

export const BOX_SIZE_PX = 32
export const MIN_GAP = 100
