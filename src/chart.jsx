import React from 'react'
import {
  LineChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { b2str, fmt, TITIK, AREA_TITIK_M2, FRUIN_BINS } from './util.jsx'

const QCOLORS = ['#1a73e8', '#e67e22', '#46a171'] // gate_in, peron, gate_out

/* Tooltip kustom: di titik "Now" hanya tampil Actual (titik jangkar visual di-exclude
   supaya tidak terbaca seolah "prediksi persis benar"). Band ditampilkan sebagai range.
   Titik terbit (jangkar) ghost1 & ghost2 juga di-exclude dari tooltip di bucket terbitnya. */
function ChartTooltip({ active, payload, label, nowStr, bucket }) {
  if (!active || !payload || !payload.length) return null
  const g1AnchorStr = bucket != null && bucket >= 1 ? b2str(bucket - 1) : null
  const g2AnchorStr = bucket != null && bucket >= 2 ? b2str(bucket - 2) : null
  const items = payload
    .filter((p) => p.value != null)
    .filter((p) => {
      if (label === nowStr && (p.dataKey === 'forecast' || p.dataKey === 'forecastOut' || p.dataKey === 'band' || String(p.dataKey).startsWith('ghost'))) {
        return false
      }
      if (g1AnchorStr && label === g1AnchorStr && p.dataKey === 'ghost1') return false
      if (g2AnchorStr && label === g2AnchorStr && p.dataKey === 'ghost2') return false
      return true
    })
  if (!items.length) return null
  return (
    <div className="ctip">
      <div className="ctip-label">{label}{label === nowStr ? ' · Now' : ''}</div>
      {items.map((p) => (
        <div key={p.dataKey} className="ctip-row">
          <span style={{ color: p.color || p.stroke }}>{p.name}</span>
          <b>{Array.isArray(p.value) ? `${fmt(p.value[0])}–${fmt(p.value[1])}` : fmt(p.value)}</b>
        </div>
      ))}
    </div>
  )
}

/* Grafik dua mode:
   - mode 'arus': aktual tap-in & tap-out s/d now + forecast yang DITERBITKAN di now (t+1..t+hSteps)
     + pita range conformal (lower 25% / upper 90%) + opsi ghost vintage sebelumnya.
   - mode 'queue': antrean 3 titik (gate-in/peron/gate-out) vs ambang Fruin. */
export default function StockChart({
  rows, bucket, height = 225, typical = null, compare = null, compareName = 'Bandingkan',
  hSteps = 4, mode = 'arus', ghost = false, showTapIn = true, showTapOut = true,
}) {
  const isArus = mode === 'arus' || mode === 'demand'
  const showIn = isArus && showTapIn
  const showOut = isArus && showTapOut
  const right = Math.max(Math.min(bucket + hSteps, 75), 8)
  const chartData = []
  for (let b = 0; b <= right; b++) {
    const r = rows[b]
    const pt = { t: b2str(b) }
    if (isArus) {
      pt.actual = r && b <= bucket && r[2] != null ? r[2] : null
      pt.actualOut = showOut && r && b <= bucket && r[26] != null ? r[26] : null
      pt.forecast = null
      pt.forecastOut = null
      pt.band = null
      pt.ghost1 = null
      pt.ghost2 = null
      pt.typical = typical ? Math.round(typical[b]) : null
      pt.compare = compare && b <= bucket ? compare[b] : null
    } else {
      for (let k = 0; k < 3; k++) {
        const col = TITIK[k].col
        pt[`q${k}`] = r && b <= bucket ? r[col] : null
        pt[`q${k}f`] = r && b >= bucket ? r[col] : null
      }
    }
    chartData.push(pt)
  }

  const issue = rows[bucket]
  if (isArus && issue) {
    for (let ahead = 1; ahead <= Math.min(hSteps, 4); ahead++) {
      const tb = bucket + ahead
      if (tb <= right && chartData[tb]) {
        const v = issue[2 + ahead]
        if (v != null) {
          chartData[tb].forecast = v
          const lo = issue[18 + ahead - 1]
          const up = issue[22 + ahead - 1]
          if (lo != null && up != null) chartData[tb].band = [Math.round(lo), Math.round(up)]
        }
        if (showOut) {
          const vOut = issue[26 + ahead]
          if (vOut != null) {
            chartData[tb].forecastOut = vOut
          }
        }
      }
    }
    if (ghost) {
      for (const v of [1, 2]) {
        const gIssue = rows[bucket - v]
        if (!gIssue) continue
        const key = `ghost${v}`
        chartData[bucket - v][key] = gIssue[2]
        for (let ahead = 1; ahead <= 4; ahead++) {
          const tb = bucket - v + ahead
          if (tb <= right && chartData[tb] && gIssue[2 + ahead] != null) {
            chartData[tb][key] = gIssue[2 + ahead]
          }
        }
      }
    }
  }
  if (isArus && chartData[bucket]) {
    if (chartData[bucket].actual != null) {
      chartData[bucket].forecast = chartData[bucket].actual // jangkar visual — di-exclude dari tooltip
    }
    if (showOut && chartData[bucket].actualOut != null) {
      chartData[bucket].forecastOut = chartData[bucket].actualOut
    }
  }

  const w = right + 1
  const step = w > 48 ? 12 : w > 24 ? 8 : w > 12 ? 4 : 2
  const ticks = []
  for (let b = 0; b <= right; b += step) ticks.push(b2str(b))

  const yMax = mode === 'queue'
    ? (m) => Math.max(3500, Math.ceil(m / 500) * 500)
    : (m) => Math.max(1500, Math.ceil(m / 500) * 500)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef1f7" />
        <XAxis dataKey="t" ticks={ticks} tick={{ fontSize: 10.5, fill: '#9aa3b5' }} tickLine={false} axisLine={{ stroke: '#e6e9f0' }} />
        <YAxis width={46} tick={{ fontSize: 10.5, fill: '#9aa3b5' }} tickLine={false} axisLine={false}
          tickFormatter={(v) => fmt(v)} domain={[0, yMax]} />
        <Tooltip content={<ChartTooltip nowStr={b2str(bucket)} bucket={bucket} />} />
        <ReferenceLine x={b2str(bucket)} stroke="#5a6377" strokeDasharray="4 4"
          label={{ value: 'Now', position: 'insideTopRight', fontSize: 10, fill: '#5a6377' }} />
        {mode === 'queue' && FRUIN_BINS.map((f, i) => (
          <ReferenceLine key={f} y={f * AREA_TITIK_M2} stroke={['#b26a00', '#d93025', '#a50e0e'][i]}
            strokeDasharray="2 6" strokeOpacity={0.55}
            label={{ value: ['SEDANG', 'TINGGI', 'KRITIS'][i], position: 'insideTopLeft', fontSize: 9, fill: ['#b26a00', '#d93025', '#a50e0e'][i] }} />
        ))}
        {isArus && typical && (
          <Line type="monotone" dataKey="typical" stroke="#b7bfcb" strokeWidth={1.5} strokeDasharray="8 4" dot={false} name="Typical (rata-rata historis)" isAnimationActive={false} />
        )}
        {isArus && compare && (
          <Line type="monotone" dataKey="compare" stroke="#188038" strokeWidth={1.5} strokeDasharray="5 4" dot={false} name={compareName} isAnimationActive={false} />
        )}
        {showIn && ghost && [1, 2].map((v) => (
          <Line key={v} type="monotone" dataKey={`ghost${v}`} stroke="#c3cbd8" strokeWidth={1.4}
            strokeDasharray="3 5" dot={{ r: 2, fill: '#c3cbd8' }} connectNulls
            name={`Forecast diterbitkan ${v * 15} mnt lalu`} isAnimationActive={false} />
        ))}
        {showIn && (
          <Area type="monotone" dataKey="band" stroke="none" fill="#1a73e8" fillOpacity={0.12}
            name="Range (lower–upper)" connectNulls isAnimationActive={false} />
        )}
        {showIn && (
          <Line type="monotone" dataKey="actual" stroke="#1a73e8" strokeWidth={2} dot={false} name={showOut ? "Aktual tap-in (masuk)" : "Actual"} isAnimationActive={false} />
        )}
        {showIn && (
          <Line type="monotone" dataKey="forecast" stroke="#1a73e8" strokeWidth={2} strokeDasharray="6 4"
            dot={{ r: 3, fill: '#1a73e8' }} connectNulls name={showOut ? "Forecast tap-in (masuk)" : "Forecast"} isAnimationActive={false} />
        )}
        {showOut && (
          <Line type="monotone" dataKey="actualOut" stroke="#46a171" strokeWidth={2} dot={false} connectNulls name="Aktual tap-out (keluar)" isAnimationActive={false} />
        )}
        {showOut && (
          <Line type="monotone" dataKey="forecastOut" stroke="#46a171" strokeWidth={2} strokeDasharray="6 4"
            dot={{ r: 3, fill: '#46a171' }} connectNulls name="Forecast tap-out (keluar)" isAnimationActive={false} />
        )}
        {mode === 'queue' && TITIK.map((tk, k) => (
          <React.Fragment key={tk.id}>
            <Line type="monotone" dataKey={`q${k}`} stroke={QCOLORS[k]} strokeWidth={2} dot={false}
              name={`${tk.label} (aktual s/d Now)`} isAnimationActive={false} />
            <Line type="monotone" dataKey={`q${k}f`} stroke={QCOLORS[k]} strokeWidth={1.8} strokeDasharray="6 4"
              dot={false} connectNulls name={`${tk.label} (prediksi)`} isAnimationActive={false} />
          </React.Fragment>
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
