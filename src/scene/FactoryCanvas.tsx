import { useRef, useEffect, useCallback } from 'react'
import { useSimStore } from '../store/simulationStore'
import type { SimBox, ScaraState, PrinterStatus } from '../simulation/types'

const W = 800
const H = 600
const BELT_Y = 300
const BELT_H = 50
const BELT_TOP = BELT_Y - BELT_H / 2
const BELT_BOT = BELT_Y + BELT_H / 2
const BELT_LEFT = 80
const BELT_RIGHT = 720

const ROBOT_X = 250
const ROBOT_Y_SOUTH = 365
const PRINTER_Y = 225
const LABEL_OFFSET_Y = 27
const PRINTER_LARGE_X = 285
const PRINTER_SMALL_X = 225

const SCANNER_X = 500
const CHUTE_X = 620
const CHUTE_PASS_Y = 420
const CHUTE_REJECT_Y = 180

const ARM_LENGTH_1 = 80
const ARM_LENGTH_2 = 70

function drawBox(ctx: CanvasRenderingContext2D, box: SimBox, labelType: 'small' | 'large') {
  const s = 32
  const halfS = s / 2

  ctx.save()
  ctx.translate(box.x, box.y)

  // Fade-in effect for newly spawned boxes
  const age = (performance.now() - box.spawnTime) / 1000
  const fadeIn = Math.min(1, age / 0.3)
  ctx.globalAlpha = fadeIn

  ctx.shadowColor = '#00000066'
  ctx.shadowBlur = 4
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 2

  ctx.fillStyle = box.color
  ctx.strokeStyle = '#00000044'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(-halfS, -halfS, s, s, 3)
  ctx.fill()
  ctx.stroke()

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  ctx.fillStyle = '#f5f5dc88'
  ctx.fillRect(-halfS + 3, -halfS + 3, s - 6, s - 6)

  if (box.hasLabel) {
    const lw = labelType === 'large' ? 22 : 14
    const lh = labelType === 'large' ? 10 : 7
    ctx.fillStyle = '#ffffffdd'
    ctx.strokeStyle = '#33333366'
    ctx.lineWidth = 0.8
    ctx.fillRect(-lw / 2, -lh / 2 - 2, lw, lh)
    ctx.strokeRect(-lw / 2, -lh / 2 - 2, lw, lh)

    ctx.fillStyle = '#999999'
    ctx.font = '5px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(labelType === 'large' ? 'L' : 'S', 0, -2)
  }

  if (box.phase === 'being_tracked') {
    const pulse = 0.4 + 0.3 * Math.sin(Date.now() * 0.008)
    ctx.strokeStyle = `rgba(34, 197, 94, ${pulse})`
    ctx.lineWidth = 2
    ctx.setLineDash([4, 3])
    ctx.strokeRect(-halfS - 3, -halfS - 3, s + 6, s + 6)
    ctx.setLineDash([])
  }

  ctx.globalAlpha = 1
  ctx.restore()
}

function drawScaraArm(ctx: CanvasRenderingContext2D, scara: ScaraState) {
  const baseX = ROBOT_X
  const baseY = ROBOT_Y_SOUTH

  ctx.save()

  // Base pedestal
  ctx.fillStyle = '#555566'
  ctx.strokeStyle = '#444455'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(baseX, baseY, 18, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#f59e0b'
  ctx.beginPath()
  ctx.arc(baseX, baseY, 12, 0, Math.PI * 2)
  ctx.fill()

  // Compute arm endpoints
  let j1x: number, j1y: number, endX: number, endY: number

  const useBoxTarget = scara.phase === 'tracking' || scara.phase === 'applying'
  const usePrinterTarget = scara.phase === 'reaching' || scara.phase === 'picking'
  const useWaiting = scara.phase === 'waiting'
  const isDirectional = (useBoxTarget || usePrinterTarget || useWaiting) && scara.reach > 0.01

  if (isDirectional) {
    let tx: number, ty: number
    if (useBoxTarget) {
      tx = scara.trackX
      ty = BELT_Y
    } else if (useWaiting) {
      tx = scara.activePrinter === 'large' ? PRINTER_LARGE_X : PRINTER_SMALL_X
      ty = BELT_Y
    } else {
      tx = scara.activePrinter === 'large' ? PRINTER_LARGE_X : PRINTER_SMALL_X
      ty = PRINTER_Y + LABEL_OFFSET_Y
    }

    const dx = tx - baseX
    const dy = ty - baseY
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist > 0) {
      const nx = dx / dist
      const ny = dy / dist
      const totalLen = (ARM_LENGTH_1 + ARM_LENGTH_2) * scara.reach
      const ratio = ARM_LENGTH_1 / (ARM_LENGTH_1 + ARM_LENGTH_2)

      const elbowBend = useBoxTarget && scara.reach > 0.5 ? 8 : 0
      j1x = baseX + nx * totalLen * ratio - ny * elbowBend
      j1y = baseY + ny * totalLen * ratio + nx * elbowBend

      endX = baseX + nx * totalLen
      endY = baseY + ny * totalLen
    } else {
      j1x = baseX
      j1y = baseY - ARM_LENGTH_1 * scara.reach
      endX = baseX
      endY = baseY - (ARM_LENGTH_1 + ARM_LENGTH_2) * scara.reach
    }
  } else {
    // Angle-based for idle (reach=0)
    const angle = scara.angle
    const reach = scara.reach

    j1x = baseX + Math.sin(angle) * ARM_LENGTH_1 * reach
    j1y = baseY - Math.cos(angle) * ARM_LENGTH_1 * reach

    endX = j1x + Math.sin(angle) * ARM_LENGTH_2 * reach
    endY = j1y - Math.cos(angle) * ARM_LENGTH_2 * reach
  }

  // Draw link 1
  ctx.shadowColor = '#00000055'
  ctx.shadowBlur = 6
  ctx.shadowOffsetY = 2
  ctx.strokeStyle = '#7a8599'
  ctx.lineWidth = 8
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(baseX, baseY)
  ctx.lineTo(j1x, j1y)
  ctx.stroke()

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  // Joint 1
  ctx.fillStyle = '#f59e0b'
  ctx.beginPath()
  ctx.arc(j1x, j1y, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#c5841a'
  ctx.beginPath()
  ctx.arc(j1x, j1y, 2.5, 0, Math.PI * 2)
  ctx.fill()

  // Draw link 2
  ctx.shadowColor = '#00000044'
  ctx.shadowBlur = 4
  ctx.shadowOffsetY = 1
  ctx.strokeStyle = '#6a7589'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(j1x, j1y)
  ctx.lineTo(endX, endY)
  ctx.stroke()

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  // End effector / gripper
  const gripperSize = scara.holdingLabel ? 4 : 6
  ctx.fillStyle = scara.holdingLabel ? '#f5f5dc' : '#444455'
  ctx.beginPath()
  ctx.arc(endX, endY, gripperSize, 0, Math.PI * 2)
  ctx.fill()

  // Label paste flash effect
  if (scara.phase === 'applying' && scara.phaseTimer >= 0.5) {
    const flashAlpha = 1 - ((scara.phaseTimer - 0.5) / 0.1)
    if (flashAlpha > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha * 0.6})`
      ctx.beginPath()
      ctx.arc(endX, endY, 10, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Z-down indicator
  if (scara.zDown) {
    ctx.strokeStyle = '#ff660066'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(endX - 4, endY - 4)
    ctx.lineTo(endX + 4, endY + 4)
    ctx.moveTo(endX + 4, endY - 4)
    ctx.lineTo(endX - 4, endY + 4)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Tracking line (dashed line from arm to tracked box)
  if (useBoxTarget && scara.targetBoxId) {
    ctx.strokeStyle = '#22c55e33'
    ctx.lineWidth = 1
    ctx.setLineDash([2, 4])
    ctx.beginPath()
    ctx.moveTo(endX, endY)
    ctx.lineTo(scara.trackX, BELT_Y)
    ctx.stroke()
    ctx.setLineDash([])
  }

  ctx.restore()
}

function drawPrinter(
  ctx: CanvasRenderingContext2D,
  printer: PrinterStatus,
  x: number,
  y: number,
  label: string,
  isActive: boolean
) {
  const w = 60
  const h = 35

  ctx.save()

  ctx.fillStyle = isActive ? '#d8d8f0' : '#e8e8f0'
  ctx.strokeStyle = isActive ? '#6688cc' : '#999999'
  ctx.lineWidth = isActive ? 2 : 1.5
  ctx.beginPath()
  ctx.roundRect(x - w / 2, y - h / 2, w, h, 4)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#333344'
  ctx.font = 'bold 8px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, x, y - 4)

  const statusColor = printer.ready ? '#22c55e' : printer.printing ? '#fbbf24' : '#666666'
  const statusText = printer.ready ? 'READY' : printer.printing ? 'PRINTING' : 'IDLE'
  ctx.fillStyle = statusColor
  ctx.shadowColor = statusColor
  ctx.shadowBlur = printer.ready || printer.printing ? 6 : 0
  ctx.beginPath()
  ctx.arc(x + w / 2 - 7, y + h / 2 - 7, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  ctx.font = '6px monospace'
  ctx.textAlign = 'right'
  ctx.fillText(statusText, x + w / 2 - 2, y + h / 2 - 2)

  // Label sheet at output when ready (below printer)
  if (printer.ready) {
    const sheetColor = label.includes('WS51') ? '#f0f0e0' : '#e8f0f0'
    ctx.fillStyle = sheetColor
    ctx.strokeStyle = '#aaaaaa'
    ctx.lineWidth = 0.5
    ctx.fillRect(x - 7, y + h / 2 + 4, 14, 10)
    ctx.strokeRect(x - 7, y + h / 2 + 4, 14, 10)
  }

  // Print progress bar
  if (printer.printing) {
    const progress = printer.timer / (printer.id === 'large' ? 1.5 : 0.9)
    ctx.fillStyle = '#fbbf2444'
    ctx.fillRect(x - w / 2, y + h / 2 + 2, w * progress, 3)
    ctx.strokeStyle = '#fbbf2466'
    ctx.lineWidth = 0.5
    ctx.strokeRect(x - w / 2, y + h / 2 + 2, w, 3)
  }

  ctx.restore()
}

function drawScanner(ctx: CanvasRenderingContext2D, isScanning: boolean, time: number) {
  ctx.save()

  ctx.fillStyle = '#444455'
  ctx.fillRect(SCANNER_X - 8, BELT_TOP - 20, 16, 20)
  ctx.fillRect(SCANNER_X - 8, BELT_BOT, 16, 20)

  ctx.fillStyle = '#333344'
  ctx.fillRect(SCANNER_X - 15, BELT_TOP - 22, 30, 6)
  ctx.fillRect(SCANNER_X - 15, BELT_BOT + 16, 30, 6)

  // Animated laser beam sweep
  const laserColor = isScanning ? '#ff3333' : '#660000'
  const alpha = isScanning ? 0.7 : 0.2
  const sweepOffset = isScanning ? Math.sin(time * 3) * 8 : 0
  ctx.strokeStyle = laserColor
  ctx.globalAlpha = alpha
  ctx.lineWidth = isScanning ? 3 : 2
  ctx.beginPath()
  ctx.moveTo(SCANNER_X + sweepOffset, BELT_TOP + 2)
  ctx.lineTo(SCANNER_X - sweepOffset, BELT_BOT - 2)
  ctx.stroke()
  ctx.globalAlpha = 1

  const indicatorColor = isScanning ? '#ef4444' : '#22c55e'
  ctx.fillStyle = indicatorColor
  ctx.shadowColor = indicatorColor
  ctx.shadowBlur = isScanning ? 8 : 3
  ctx.beginPath()
  ctx.arc(SCANNER_X, BELT_TOP - 28, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  ctx.restore()
}

function drawChute(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  label: string,
  angle: number
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)

  ctx.fillStyle = '#666677'
  ctx.strokeStyle = '#555566'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(-40, -12, 80, 24, 3)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#555566'
  ctx.fillRect(-40, -14, 3, 28)
  ctx.fillRect(37, -14, 3, 28)

  ctx.fillStyle = color
  ctx.shadowColor = color
  ctx.shadowBlur = 6
  ctx.beginPath()
  ctx.arc(30, 0, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 8px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, 0, 0)

  ctx.restore()
}

function drawFeeder(ctx: CanvasRenderingContext2D, isRunning: boolean) {
  ctx.save()

  ctx.fillStyle = '#3a3a5c'
  ctx.strokeStyle = '#4a4a6c'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(BELT_LEFT - 40, BELT_TOP - 15, 45, BELT_H + 30, 5)
  ctx.fill()
  ctx.stroke()

  const arrowX = BELT_LEFT - 15 + (isRunning ? Math.sin(Date.now() * 0.004) * 5 : 0)
  ctx.fillStyle = '#fbbf24'
  ctx.beginPath()
  ctx.moveTo(arrowX + 10, BELT_Y)
  ctx.lineTo(arrowX - 5, BELT_Y - 8)
  ctx.lineTo(arrowX - 5, BELT_Y + 8)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#ef4444'
  ctx.shadowColor = '#ef4444'
  ctx.shadowBlur = isRunning ? 6 : 2
  ctx.beginPath()
  ctx.arc(BELT_LEFT - 22, BELT_TOP - 8, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  ctx.restore()
}

function drawFactoryFloor(ctx: CanvasRenderingContext2D) {
  // Base color
  ctx.fillStyle = '#2d2d3d'
  ctx.fillRect(0, 0, W, H)

  // Subtle concrete noise pattern
  ctx.fillStyle = '#33334415'
  for (let x = 0; x < W; x += 4) {
    for (let y = 0; y < H; y += 4) {
      if (((x * 7 + y * 13) % 17) < 5) {
        ctx.fillRect(x, y, 2, 2)
      }
    }
  }

  // Grid lines (subtle)
  ctx.strokeStyle = '#33335518'
  ctx.lineWidth = 1
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }
}

function drawConveyor(ctx: CanvasRenderingContext2D, time: number, isRunning: boolean, speed: number) {
  ctx.save()

  ctx.fillStyle = '#3a3a4a'
  ctx.fillRect(BELT_LEFT, BELT_TOP, BELT_RIGHT - BELT_LEFT, BELT_H)

  const stripeW = 12
  const offset = isRunning ? (time * speed * 0.05) % stripeW : 0
  ctx.fillStyle = '#4a4a5a'
  for (let x = BELT_LEFT + offset; x < BELT_RIGHT; x += stripeW * 2) {
    ctx.fillRect(x, BELT_TOP + 2, stripeW, BELT_H - 4)
  }

  ctx.strokeStyle = '#555566'
  ctx.lineWidth = 2
  ctx.strokeRect(BELT_LEFT, BELT_TOP, BELT_RIGHT - BELT_LEFT, BELT_H)

  ctx.fillStyle = '#666677'
  const rollerAngle = isRunning ? time * speed * 0.1 : 0
  // Left roller
  ctx.save()
  ctx.translate(BELT_LEFT, BELT_Y)
  ctx.rotate(rollerAngle)
  ctx.beginPath()
  ctx.arc(0, 0, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#555566'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(-5, 0)
  ctx.lineTo(5, 0)
  ctx.stroke()
  ctx.restore()
  // Right roller
  ctx.save()
  ctx.translate(BELT_RIGHT, BELT_Y)
  ctx.rotate(rollerAngle)
  ctx.beginPath()
  ctx.arc(0, 0, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#555566'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(-5, 0)
  ctx.lineTo(5, 0)
  ctx.stroke()
  ctx.restore()

  ctx.fillStyle = '#444455'
  for (const x of [-6, -3, 0, 3, 6].map((v) => 300 + v * 50)) {
    if (x > BELT_LEFT && x < BELT_RIGHT) {
      ctx.fillRect(x - 3, BELT_TOP - 4, 6, BELT_H + 8)
      // Support bracket legs
      ctx.fillRect(x - 4, BELT_BOT + 4, 3, 12)
      ctx.fillRect(x + 1, BELT_BOT + 4, 3, 12)
    }
  }

  ctx.restore()
}

function drawTitle(ctx: CanvasRenderingContext2D, labelType: string) {
  ctx.save()
  ctx.fillStyle = '#ffffffaa'
  ctx.font = 'bold 14px monospace'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('FACTORY LABELING LINE - TOP VIEW', 10, 10)

  ctx.fillStyle = '#ffffff99'
  ctx.font = '10px monospace'
  ctx.fillText('INPUT →', 10, BELT_Y - 6)
  ctx.fillText('→ OUTPUT', BELT_RIGHT + 5, BELT_Y - 6)

  ctx.fillStyle = '#ffffff77'
  ctx.font = '9px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('SCARA ARM', ROBOT_X, ROBOT_Y_SOUTH + 30)
  ctx.fillText('SCANNER', SCANNER_X, BELT_BOT + 42)
  ctx.fillText('PASS', CHUTE_X, CHUTE_PASS_Y + 28)
  ctx.fillText('REJECT', CHUTE_X, CHUTE_REJECT_Y - 28)

  ctx.restore()
}

export default function FactoryCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number>(0)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const state = useSimStore.getState()
    const { boxes, scara, printers, isRunning, config, speed } = state

    const time = performance.now() / 1000

    ctx.clearRect(0, 0, W, H)

    drawFactoryFloor(ctx)
    drawConveyor(ctx, time, isRunning, config.beltSpeed * speed)

    // Draw printers side by side
    drawPrinter(ctx, printers[0], PRINTER_LARGE_X, PRINTER_Y, 'WS51 (L)', scara.activePrinter === 'large')
    drawPrinter(ctx, printers[1], PRINTER_SMALL_X, PRINTER_Y, 'WS52 (S)', scara.activePrinter === 'small')

    // Draw lines from printers to robot base (label feed path)
    ctx.strokeStyle = '#ffffff08'
    ctx.lineWidth = 1
    ctx.setLineDash([2, 6])
    ctx.beginPath()
    ctx.moveTo(PRINTER_LARGE_X, PRINTER_Y + 18)
    ctx.lineTo(ROBOT_X, ROBOT_Y_SOUTH - 18)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(PRINTER_SMALL_X, PRINTER_Y + 18)
    ctx.lineTo(ROBOT_X, ROBOT_Y_SOUTH - 18)
    ctx.stroke()
    ctx.setLineDash([])

    drawFeeder(ctx, isRunning)

    for (const box of boxes) {
      drawBox(ctx, box, config.labelType)
    }

    drawScaraArm(ctx, scara)

    const isScanning = boxes.some((b) => b.phase === 'sorting' && Math.abs(b.x - SCANNER_X) < 40)
    drawScanner(ctx, isScanning, time)

    const passAngle = Math.atan2(CHUTE_PASS_Y - BELT_Y, CHUTE_X - BELT_RIGHT)
    const rejectAngle = Math.atan2(CHUTE_REJECT_Y - BELT_Y, CHUTE_X - BELT_RIGHT)
    drawChute(ctx, CHUTE_X + 20, CHUTE_PASS_Y, '#22c55e', 'PASS', passAngle)
    drawChute(ctx, CHUTE_X + 20, CHUTE_REJECT_Y, '#ef4444', 'REJECT', rejectAngle)

    ctx.strokeStyle = '#22c55e33'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(BELT_RIGHT, BELT_Y)
    ctx.lineTo(CHUTE_X - 20, CHUTE_PASS_Y)
    ctx.stroke()

    ctx.strokeStyle = '#ef444433'
    ctx.beginPath()
    ctx.moveTo(BELT_RIGHT, BELT_Y)
    ctx.lineTo(CHUTE_X - 20, CHUTE_REJECT_Y)
    ctx.stroke()
    ctx.setLineDash([])

    drawTitle(ctx, config.labelType)

    frameRef.current = requestAnimationFrame(draw)
  }, [])

  useEffect(() => {
    frameRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frameRef.current)
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        imageRendering: 'auto',
      }}
    />
  )
}
