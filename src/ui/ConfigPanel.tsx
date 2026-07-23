import { useSimStore } from '../store/simulationStore'
import type { BoxSize } from '../simulation/types'

export default function ConfigPanel() {
  const config = useSimStore((s) => s.config)
  const updateConfig = useSimStore((s) => s.updateConfig)

  return (
    <div className="bg-gray-800 rounded-xl p-3 text-white border border-gray-700">
      <h2 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">
        Parameters
      </h2>

      <div className="space-y-3">
        <div>
          <span className="text-xs text-gray-400 block mb-1">Label Type</span>
          <div className="flex gap-1">
            {(['small', 'large'] as BoxSize[]).map((t) => (
              <button
                key={t}
                onClick={() => updateConfig({ labelType: t })}
                className={`flex-1 px-3 py-1.5 rounded text-xs font-bold uppercase transition-all ${
                  config.labelType === t
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Spawn Interval</span>
            <span className="font-mono text-blue-400">{config.spawnInterval.toFixed(1)}s</span>
          </div>
          <input
            type="range"
            min="1.0"
            max="6"
            step="0.1"
            value={config.spawnInterval}
            onChange={(e) => updateConfig({ spawnInterval: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Belt Speed</span>
            <span className="font-mono text-green-400">{config.beltSpeed.toFixed(0)} u/s</span>
          </div>
          <input
            type="range"
            min="40"
            max="200"
            step="5"
            value={config.beltSpeed}
            onChange={(e) => updateConfig({ beltSpeed: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Robot Speed</span>
            <span className="font-mono text-yellow-400">{(config.robotSpeed * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            step="5"
            value={config.robotSpeed * 100}
            onChange={(e) => updateConfig({ robotSpeed: parseFloat(e.target.value) / 100 })}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Fail Rate</span>
            <span className="font-mono text-red-400">{(config.failRate * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="0.5"
            step="0.01"
            value={config.failRate}
            onChange={(e) => updateConfig({ failRate: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500"
          />
        </div>
      </div>
    </div>
  )
}
