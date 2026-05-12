import { useState, useEffect } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'
import './App.css'

const API = '/api/status'
const CMD = '/api/command'
const POLL_MS = 3000

function usePoll(url, ms) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)

  useEffect(() => {
    const fetch_ = () =>
      fetch(url, { headers: { 'ngrok-skip-browser-warning': '1' } })
        .then(r => r.json())
        .then(d => { setData(d); setError(null); setLastUpdate(new Date()) })
        .catch(e => setError(e.message))

    fetch_()
    const id = setInterval(fetch_, ms)
    return () => clearInterval(id)
  }, [url, ms])

  return { data, error, lastUpdate }
}

function StatusBadge({ status }) {
  const map = {
    running:     { color: '#22c55e', label: 'RUNNING',   pulse: true },
    completed:   { color: '#6366f1', label: 'COMPLETE',  pulse: false },
    starting:    { color: '#f59e0b', label: 'STARTING',  pulse: true },
    not_started: { color: '#6b7280', label: 'IDLE',      pulse: false },
  }
  const cfg = map[status] || map.not_started
  return (
    <span className="status-badge" style={{ '--c': cfg.color }}>
      <span className={`dot ${cfg.pulse ? 'pulse' : ''}`} />
      {cfg.label}
    </span>
  )
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="stat-card" style={{ '--accent': accent || '#00d4ff' }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value ?? '—'}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

function GpuBar({ label, value, max, color }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="gpu-bar-row">
      <span className="gpu-bar-label">{label}</span>
      <div className="gpu-bar-track">
        <div className="gpu-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="gpu-bar-val">{value ?? '—'}{max ? `/${max}` : ''}</span>
    </div>
  )
}

const CHART_COLORS = { loss: '#f43f5e', f1: '#22c55e', precision: '#00d4ff', recall: '#f59e0b', accuracy: '#a78bfa' }

async function sendCommand(command) {
  await fetch(CMD, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command }),
  })
}

export default function App() {
  const { data, error, lastUpdate } = usePoll(API, POLL_MS)
  const [cmdPending, setCmdPending] = useState(null)

  const handleCommand = async (cmd) => {
    setCmdPending(cmd)
    await sendCommand(cmd)
    setTimeout(() => setCmdPending(null), 3000)
  }

  const eta = (() => {
    if (!data || !data.start_time || !data.current_step || data.current_step === 0) return null
    const elapsed = (Date.now() - new Date(data.start_time)) / 1000
    const rate = data.current_step / elapsed
    const remaining = (data.total_steps || 0) - data.current_step
    const secs = remaining / rate
    if (!isFinite(secs) || secs <= 0) return null
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  })()

  const epochPct = data?.total_steps
    ? Math.round((data.current_step / data.total_steps) * 100)
    : 0

  const gpu = data?.gpu

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="logo">⚡</div>
          <div>
            <h1>LayoutLMv3 Training Monitor</h1>
            <p className="subtitle">microsoft/layoutlmv3-base · Token Classification</p>
          </div>
        </div>
        <div className="header-right">
          {data && <StatusBadge status={data.status} />}
          {lastUpdate && (
            <span className="last-update">Updated {lastUpdate.toLocaleTimeString()}</span>
          )}
          {data?.status === 'running' && (
            <button
              className="cmd-btn stop-btn"
              onClick={() => handleCommand('stop')}
              disabled={!!cmdPending}
            >
              {cmdPending === 'stop' ? 'Stopping...' : '⏹ Stop'}
            </button>
          )}
          {(data?.status === 'stopped' || data?.status === 'completed') && (
            <button
              className="cmd-btn restart-btn"
              onClick={() => handleCommand('restart')}
              disabled={!!cmdPending}
            >
              {cmdPending === 'restart' ? 'Restarting...' : '▶ Restart'}
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="error-bar">
          ⚠ Cannot reach API server — is api_server.py running? ({error})
        </div>
      )}

      {/* Stat Cards */}
      <div className="cards-row">
        <StatCard
          label="Epoch"
          value={data ? `${Math.floor(data.current_epoch || 0)} / ${data.total_epochs || 50}` : '—'}
          sub={`${epochPct}% complete`}
          accent="#6366f1"
        />
        <StatCard
          label="Step"
          value={data ? `${data.current_step || 0} / ${data.total_steps || 0}` : '—'}
          sub={`batch size 2`}
          accent="#00d4ff"
        />
        <StatCard
          label="Loss"
          value={data?.training_loss ?? '—'}
          sub={data?.learning_rate ? `LR ${data.learning_rate.toExponential(1)}` : ''}
          accent="#f43f5e"
        />
        <StatCard
          label="ETA"
          value={eta ?? (data?.status === 'completed' ? 'Done' : '—')}
          sub={data?.status === 'running' ? 'estimated' : ''}
          accent="#22c55e"
        />
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        {/* Loss Chart */}
        <div className="chart-card">
          <h2 className="chart-title">Training Loss</h2>
          {data?.loss_history?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.loss_history} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                <XAxis dataKey="step" stroke="#475569" tick={{ fontSize: 11 }} label={{ value: 'Step', position: 'insideBottom', offset: -2, fill: '#475569', fontSize: 11 }} />
                <YAxis stroke="#475569" tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 8, color: '#e2e8f0', fontSize: 12 }} />
                <Line type="monotone" dataKey="loss" stroke={CHART_COLORS.loss} strokeWidth={2} dot={false} name="Loss" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">Waiting for training data...</div>
          )}
        </div>

        {/* Eval Metrics Chart */}
        <div className="chart-card">
          <h2 className="chart-title">Eval Metrics per Epoch</h2>
          {data?.epoch_metrics?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.epoch_metrics} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                <XAxis dataKey="epoch" stroke="#475569" tick={{ fontSize: 11 }} label={{ value: 'Epoch', position: 'insideBottom', offset: -2, fill: '#475569', fontSize: 11 }} />
                <YAxis stroke="#475569" tick={{ fontSize: 11 }} domain={[0, 1]} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 8, color: '#e2e8f0', fontSize: 12 }} formatter={(v) => v?.toFixed ? v.toFixed(4) : v} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Line type="monotone" dataKey="f1"        stroke={CHART_COLORS.f1}        strokeWidth={2} dot={{ r: 3 }} name="F1" />
                <Line type="monotone" dataKey="precision" stroke={CHART_COLORS.precision} strokeWidth={2} dot={{ r: 3 }} name="Precision" />
                <Line type="monotone" dataKey="recall"    stroke={CHART_COLORS.recall}    strokeWidth={2} dot={{ r: 3 }} name="Recall" />
                <Line type="monotone" dataKey="accuracy"  stroke={CHART_COLORS.accuracy}  strokeWidth={2} dot={{ r: 3 }} name="Accuracy" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">Waiting for eval results...</div>
          )}
        </div>
      </div>

      {/* GPU + Loss Bar Row */}
      <div className="charts-row">
        {/* GPU Panel */}
        <div className="chart-card">
          <h2 className="chart-title">GPU — RTX 4070</h2>
          {gpu ? (
            <div className="gpu-panel">
              <GpuBar label="VRAM"   value={gpu.memory_used_mb}     max={gpu.memory_total_mb}  color="#6366f1" />
              <GpuBar label="Util%"  value={gpu.utilization_percent} max={100}                  color="#00d4ff" />
              <div className="gpu-temp-row">
                <span className="gpu-bar-label">Temp</span>
                <span className="gpu-temp-val" style={{ color: gpu.temperature_c > 80 ? '#ef4444' : gpu.temperature_c > 65 ? '#f59e0b' : '#22c55e' }}>
                  {gpu.temperature_c}°C
                </span>
              </div>
              <div className="gpu-stats-grid">
                <div className="gpu-stat"><span>Used</span><b>{gpu.memory_used_mb} MB</b></div>
                <div className="gpu-stat"><span>Total</span><b>{gpu.memory_total_mb} MB</b></div>
                <div className="gpu-stat"><span>Load</span><b>{gpu.utilization_percent}%</b></div>
                <div className="gpu-stat"><span>Temp</span><b>{gpu.temperature_c}°C</b></div>
              </div>
            </div>
          ) : (
            <div className="chart-empty">GPU data unavailable</div>
          )}
        </div>

        {/* Loss per Epoch Bar */}
        <div className="chart-card">
          <h2 className="chart-title">Loss History (Steps)</h2>
          {data?.loss_history?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.loss_history.slice(-30)} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                <XAxis dataKey="step" stroke="#475569" tick={{ fontSize: 10 }} />
                <YAxis stroke="#475569" tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 8, color: '#e2e8f0', fontSize: 12 }} />
                <Bar dataKey="loss" fill="#f43f5e" radius={[3, 3, 0, 0]} name="Loss" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">Waiting for training data...</div>
          )}
        </div>
      </div>

      {/* Epoch Metrics Table */}
      {data?.epoch_metrics?.length > 0 && (
        <div className="chart-card table-card">
          <h2 className="chart-title">Epoch Results</h2>
          <div className="table-wrap">
            <table className="metrics-table">
              <thead>
                <tr>
                  <th>Epoch</th>
                  <th>F1</th>
                  <th>Precision</th>
                  <th>Recall</th>
                  <th>Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {[...data.epoch_metrics].reverse().map((m, i) => (
                  <tr key={i}>
                    <td>{m.epoch}</td>
                    <td style={{ color: CHART_COLORS.f1 }}>{m.f1?.toFixed(4) ?? '—'}</td>
                    <td style={{ color: CHART_COLORS.precision }}>{m.precision?.toFixed(4) ?? '—'}</td>
                    <td style={{ color: CHART_COLORS.recall }}>{m.recall?.toFixed(4) ?? '—'}</td>
                    <td style={{ color: CHART_COLORS.accuracy }}>{m.accuracy?.toFixed(4) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
