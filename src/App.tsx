import { useSimStore, BELT_Y, ROBOT_X, ROBOT_Y, PRINTER_LARGE_X, PRINTER_SMALL_X, PRINTER_Y, LABEL_OFFSET_Y, ARM_LENGTH_1, ARM_LENGTH_2 } from './store/simulationStore'
import FactoryCanvas from './scene/FactoryCanvas'
import ControlPanel from './ui/ControlPanel'
import StatsDisplay from './ui/StatsDisplay'
import ConfigPanel from './ui/ConfigPanel'
import { useEffect, useMemo } from 'react'
import type { ScaraState } from './simulation/types'

function computeEndEffector(scara: ScaraState): { x: number; y: number } {
  const baseX = ROBOT_X
  const baseY = ROBOT_Y

  const useBoxTarget = scara.phase === 'tracking' || scara.phase === 'applying'
  const usePrinterTarget = scara.phase === 'reaching' || scara.phase === 'picking'
  const isDirectional = (useBoxTarget || usePrinterTarget) && scara.reach > 0.01

  if (isDirectional) {
    let tx: number, ty: number
    if (useBoxTarget) {
      tx = scara.trackX
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
      return { x: Math.round(baseX + nx * totalLen), y: Math.round(baseY + ny * totalLen) }
    }
  }

  const angle = scara.angle
  const reach = scara.reach
  const j1x = baseX + Math.sin(angle) * ARM_LENGTH_1 * reach
  const j1y = baseY - Math.cos(angle) * ARM_LENGTH_1 * reach
  return {
    x: Math.round(j1x + Math.sin(angle) * ARM_LENGTH_2 * reach),
    y: Math.round(j1y - Math.cos(angle) * ARM_LENGTH_2 * reach),
  }
}

export default function App() {
  const tick = useSimStore((s) => s.tick)
  const isRunning = useSimStore((s) => s.isRunning)
  const scara = useSimStore((s) => s.scara)

  const endEff = useMemo(() => computeEndEffector(scara), [scara])

  useEffect(() => {
    let lastTime = performance.now()
    let raf: number

    function loop(now: number) {
      const delta = Math.min((now - lastTime) / 1000, 0.05)
      lastTime = now
      tick(delta)
      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [tick])

  return (
    <div className="flex h-screen w-screen bg-gray-900 text-white overflow-hidden">
      {/* Left Panel — Config */}
      <aside className="w-[15%] min-w-[180px] border-r border-gray-700 overflow-y-auto p-3">
        <ConfigPanel />
      </aside>

      {/* Middle Panel — Animation */}
      <main className="w-[70%] flex items-center justify-center relative">
        <div style={{ maxWidth: '100%', maxHeight: '100%', aspectRatio: '800 / 600' }}>
          <FactoryCanvas />
        </div>
        <div
          style={{
            position: 'absolute',
            left: '31.25%',
            top: '66%',
            transform: 'translateX(-50%)',
          }}
          className="bg-gray-900/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-gray-700"
        >
          <div className="text-xs font-mono text-gray-400 space-y-0.5">
            <div>
              STATE: <span className="text-amber-400 font-bold uppercase">{scara.phase}</span>
            </div>
            <div>
              LABEL: <span className={scara.holdingLabel ? 'text-green-400' : 'text-gray-500'}>{scara.holdingLabel ? 'YES' : 'NO'}</span>
            </div>
            <div>
              GRIPPER: <span className="text-cyan-400">({endEff.x}, {endEff.y})</span>
            </div>
          </div>
        </div>
      </main>

      {/* Right Panel — Controls + Stats */}
      <aside className="w-[15%] min-w-[180px] border-l border-gray-700 overflow-y-auto p-3 flex flex-col gap-3">
        <ControlPanel />
        <StatsDisplay />
      </aside>
    </div>
  )
}
