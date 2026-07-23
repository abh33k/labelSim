import { useSimStore } from '../store/simulationStore'

export default function StatsDisplay() {
  const stats = useSimStore((s) => s.stats)
  const boxes = useSimStore((s) => s.boxes)
  const isRunning = useSimStore((s) => s.isRunning)

  const uptime = Math.floor((Date.now() - stats.startTime) / 1000)
  const minutes = Math.floor(uptime / 60)
  const seconds = uptime % 60

  const throughput = stats.totalProcessed > 0
    ? ((stats.totalProcessed / Math.max(uptime, 1)) * 60).toFixed(1)
    : '0.0'

  const rejectRate = stats.totalProcessed > 0
    ? ((stats.totalRejected / stats.totalProcessed) * 100).toFixed(1)
    : '0.0'

  return (
    <div className="bg-gray-800 rounded-xl p-3 text-white border border-gray-700">
      <h2 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">
        Live Statistics
      </h2>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-400">Status</span>
          <span className={`font-mono font-bold ${isRunning ? 'text-green-400' : 'text-yellow-400'}`}>
            {isRunning ? 'RUNNING' : 'STOPPED'}
          </span>
        </div>

        <div className="h-px bg-gray-700" />

        <div className="flex justify-between">
          <span className="text-gray-400">Uptime</span>
          <span className="font-mono text-blue-400">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">On Belt</span>
          <span className="font-mono text-cyan-400">{boxes.length}</span>
        </div>

        <div className="h-px bg-gray-700" />

        <div className="flex justify-between">
          <span className="text-gray-400">Processed</span>
          <span className="font-mono text-white">{stats.totalProcessed}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">Passed</span>
          <span className="font-mono text-green-400">{stats.totalPassed}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">Rejected</span>
          <span className="font-mono text-red-400">{stats.totalRejected}</span>
        </div>

        <div className="h-px bg-gray-700" />

        <div className="flex justify-between">
          <span className="text-gray-400">Throughput</span>
          <span className="font-mono text-purple-400">{throughput} /min</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">Reject Rate</span>
          <span className={`font-mono ${parseFloat(rejectRate) > 10 ? 'text-red-400' : 'text-green-400'}`}>
            {rejectRate}%
          </span>
        </div>
      </div>
    </div>
  )
}
