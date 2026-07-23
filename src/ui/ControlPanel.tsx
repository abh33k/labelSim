import { useSimStore } from '../store/simulationStore'

export default function ControlPanel() {
  const isRunning = useSimStore((s) => s.isRunning)
  const speed = useSimStore((s) => s.speed)
  const toggleRunning = useSimStore((s) => s.toggleRunning)
  const setSpeed = useSimStore((s) => s.setSpeed)
  const reset = useSimStore((s) => s.reset)

  const speeds = [0.5, 1, 2, 5]

  return (
    <div className="bg-gray-800 rounded-xl p-3 text-white border border-gray-700">
      <h2 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">
        Simulation Control
      </h2>

      <div className="flex gap-2 mb-3">
        <button
          onClick={toggleRunning}
          className={`flex-1 px-4 py-2 rounded-lg font-bold text-sm transition-all ${
            isRunning
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {isRunning ? 'PAUSE' : 'START'}
        </button>

        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg font-bold text-sm bg-gray-600 hover:bg-gray-500 text-white transition-all"
        >
          RESET
        </button>
      </div>

      <div>
        <span className="text-xs text-gray-400">Speed</span>
        <div className="flex gap-1 mt-1">
          {speeds.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`flex-1 px-3 py-1 rounded text-xs font-mono transition-all ${
                speed === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
