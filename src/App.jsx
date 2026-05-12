import { useState, useEffect, useRef } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import './App.css'

const API     = '/api/status'
const CMD     = '/api/command'
const POLL_MS = 3000

function usePoll(url, ms) {
  const [data, setData]           = useState(null)
  const [error, setError]         = useState(null)
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

/* Flashes the value element whenever it changes */
function useFlash(value) {
  const ref     = useRef(null)
  const prevRef = useRef(value)
  useEffect(() => {
    if (prevRef.current !== value && ref.current) {
      ref.current.classList.remove('flash')
      void ref.current.offsetWidth          // reflow to restart animation
      ref.current.classList.add('flash')
    }
    prevRef.current = value
  }, [value])
  return ref
}

function StatusBadge({ status }) {
  const map = {
    running:     { color: '#22c55e', label: 'RUNNING',     pulse: true  },
    completed:   { color: '#6366f1', label: 'COMPLETE',    pulse: false },
    starting:    { color: '#f59e0b', label: 'STARTING',    pulse: true  },
    stopping:    { color: '#ef4444', label: 'STOPPING',    pulse: true  },
    restarting:  { color: '#00d4ff', label: 'RESTARTING',  pulse: true  },
    stopped:     { color: '#6b7280', label: 'STOPPED',     pulse: false },
    not_started: { color: '#6b7280', label: 'IDLE',        pulse: false },
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
  const ref = useFlash(value)
  return (
    <div className="stat-card" style={{ '--accent': accent || '#00d4ff' }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value" ref={ref}>{value ?? '—'}</div>
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

function ProgressBar({ pct }) {
  return (
    <div className="progress-wrap">
      <div className="progress-label">
        <span>Overall Progress</span>
        <span>{pct}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

const CHART_COLORS = {
  loss:      '#f43f5e',
  f1:        '#22c55e',
  precision: '#00d4ff',
  recall:    '#f59e0b',
  accuracy:  '#a78bfa',
}

const TOOLTIP_STYLE = {
  background: '#0f0f1a',
  border: '1px solid #272740',
  borderRadius: 10,
  color: '#e2e8f0',
  fontSize: 12,
}

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
    if (!data?.start_time || !data.current_step) return null
    const elapsed   = (Date.now() - new Date(data.start_time)) / 1000
    const rate      = data.current_step / elapsed
    const remaining = (data.total_steps || 0) - data.current_step
    const secs      = remaining / rate
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

      {/* ── Header ── */}
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
            <span className="last-update">
              {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          {data?.status === 'running' && (
            <button
              className="cmd-btn stop-btn"
              onClick={() => handleCommand('stop')}
              disabled={!!cmdPending}
            >
              {cmdPending === 'stop' ? 'Stopping…' : '⏹ Stop'}
            </button>
          )}
          {(data?.status === 'stopped' || data?.status === 'completed') && (
            <button
              className="cmd-btn restart-btn"
              onClick={() => handleCommand('restart')}
              disabled={!!cmdPending}
            >
              {cmdPending === 'restart' ? 'Restarting…' : '▶ Restart'}
            </button>
          )}
        </div>

        {data?.status === 'running' && (
          <ProgressBar pct={epochPct} />
        )}
      </header>

      {/* ── Error ── */}
      {error && (
        <div className="error-bar">
          ⚠ Cannot reach API server — is api_server.py running? ({error})
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className="cards-row">
        <StatCard
          label="Epoch"
          value={data ? `${Math.floor(data.current_epoch || 0)} / ${data.total_epochs || 50}` : null}
          sub={`${epochPct}% complete`}
          accent="#6366f1"
        />
        <StatCard
          label="Step"
          value={data ? `${data.current_step || 0} / ${data.total_steps || 0}` : null}
          sub="batch size 2"
          accent="#00d4ff"
        />
        <StatCard
          label="Loss"
          value={data?.training_loss ?? null}
          sub={data?.learning_rate ? `LR ${data.learning_rate.toExponential(1)}` : ''}
          accent="#f43f5e"
        />
        <StatCard
          label="ETA"
          value={eta ?? (data?.status === 'completed' ? 'Done' : null)}
          sub={data?.status === 'running' ? 'estimated' : ''}
          accent="#22c55e"
        />
      </div>

      {/* ── Charts Row 1 ── */}
      <div className="charts-row">
        <div className="chart-card">
          <h2 className="chart-title">Training Loss</h2>
          {data?.loss_history?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.loss_history} margin={{ top: 5, right: 16, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2c" />
                <XAxis dataKey="step" stroke="#334155" tick={{ fontSize: 10, fill: '#475569' }} />
                <YAxis stroke="#334155" tick={{ fontSize: 10, fill: '#475569' }} domain={['auto', 'auto']} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="loss" stroke={CHART_COLORS.loss}
                  strokeWidth={2.5} dot={false} name="Loss"
                  activeDot={{ r: 5, strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">Waiting for training data…</div>
          )}
        </div>

        <div className="chart-card">
          <h2 className="chart-title">Eval Metrics per Epoch</h2>
          {data?.epoch_metrics?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.epoch_metrics} margin={{ top: 5, right: 16, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2c" />
                <XAxis dataKey="epoch" stroke="#334155" tick={{ fontSize: 10, fill: '#475569' }} />
                <YAxis stroke="#334155" tick={{ fontSize: 10, fill: '#475569' }} domain={[0, 1]} />
                <Tooltip contentStyle={TOOLTIP_STYLE}
                  formatter={(v) => v?.toFixed ? v.toFixed(4) : v} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Line type="monotone" dataKey="f1"        stroke={CHART_COLORS.f1}        strokeWidth={2} dot={{ r: 2.5 }} name="F1" />
                <Line type="monotone" dataKey="precision" stroke={CHART_COLORS.precision} strokeWidth={2} dot={{ r: 2.5 }} name="Precision" />
                <Line type="monotone" dataKey="recall"    stroke={CHART_COLORS.recall}    strokeWidth={2} dot={{ r: 2.5 }} name="Recall" />
                <Line type="monotone" dataKey="accuracy"  stroke={CHART_COLORS.accuracy}  strokeWidth={2} dot={{ r: 2.5 }} name="Accuracy" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">Waiting for eval results…</div>
          )}
        </div>
      </div>

      {/* ── Charts Row 2 ── */}
      <div className="charts-row">
        <div className="chart-card">
          <h2 className="chart-title">GPU — RTX 4070</h2>
          {gpu ? (
            <div className="gpu-panel">
              <GpuBar label="VRAM"  value={gpu.memory_used_mb}      max={gpu.memory_total_mb} color="#6366f1" />
              <GpuBar label="Util%" value={gpu.utilization_percent}  max={100}                color="#00d4ff" />
              <div className="gpu-temp-row">
                <span className="gpu-bar-label">Temp</span>
                <span className="gpu-temp-val" style={{
                  color: gpu.temperature_c > 80 ? '#ef4444'
                       : gpu.temperature_c > 65 ? '#f59e0b'
                       : '#22c55e'
                }}>
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

        <div className="chart-card">
          <h2 className="chart-title">Loss History (Last 30 Steps)</h2>
          {data?.loss_history?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.loss_history.slice(-30)} margin={{ top: 5, right: 16, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2c" />
                <XAxis dataKey="step" stroke="#334155" tick={{ fontSize: 9, fill: '#475569' }} />
                <YAxis stroke="#334155" tick={{ fontSize: 10, fill: '#475569' }} domain={['auto', 'auto']} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="loss" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Loss"
                  maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">Waiting for training data…</div>
          )}
        </div>
      </div>

      {/* ── Epoch Table ── */}
      {data?.epoch_metrics?.length > 0 && (
        <div className="chart-card table-card">
          <h2 className="chart-title">Epoch Results</h2>
          <div className="table-wrap">
            <table className="metrics-table">
              <thead>
                <tr>
                  <th>Epoch</th>
                  <th style={{ color: CHART_COLORS.f1 }}>F1</th>
                  <th style={{ color: CHART_COLORS.precision }}>Precision</th>
                  <th style={{ color: CHART_COLORS.recall }}>Recall</th>
                  <th style={{ color: CHART_COLORS.accuracy }}>Accuracy</th>
                  <th>Loss</th>
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
                    <td style={{ color: CHART_COLORS.loss }}>{m.loss?.toFixed(4) ?? '—'}</td>
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
