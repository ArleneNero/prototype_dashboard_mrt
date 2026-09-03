import React, { useState } from 'react'
import StockChart from './chart.jsx'
import { analyzeAI } from './llm.js'
import {
  RISKS, Badge, StationLine, b2str, fmt, short, whyOf, rowAt,
  TITIK, densTitik, lvlFromDens, waitTitik, eventsOn, dailyRain, rainAt, HOTSPOTS,
  rainText, RAIN_TIP, NOWCAST_TIP, ARUS_TIP, QUEUE_TIP, LAJU_GATE_BUCKET,
} from './util.jsx'

/* ================= AI Box (analyzer on-demand, BUKAN chatbot) ================= */
export function AiBox({ konteks, grounding, buttonLabel }) {
  const [state, setState] = useState({ status: 'idle', text: '' })
  const run = async () => {
    setState({ status: 'loading', text: '' })
    try {
      const text = await analyzeAI(konteks, grounding)
      setState({ status: 'done', text })
    } catch (e) {
      setState({ status: 'error', text: String(e) })
    }
  }
  return (
    <div className="ai-wrap">
      <button className="ai-btn" onClick={run} disabled={state.status === 'loading'}>
        {state.status === 'loading' ? '⏳ Menganalisis…' : buttonLabel}
      </button>
      {state.status === 'loading' && (
        <div className="ai-box" aria-busy="true">
          <div className="sk" style={{ height: 12, margin: '3px 0' }} />
          <div className="sk" style={{ height: 12, margin: '3px 0', width: '94%' }} />
          <div className="sk" style={{ height: 12, margin: '3px 0', width: '71%' }} />
        </div>
      )}
      {state.status === 'done' && <div className="ai-box">{state.text}</div>}
      {state.status === 'error' && (
        <div className="ai-box err">Analyzer gagal dipanggil ({state.text}). Dashboard tetap berfungsi tanpa AI.</div>
      )}
    </div>
  )
}

/* ================= KPI ================= */
function Delta({ now, prev, at }) {
  if (now === prev) return <div className="kpi-delta flat">— same as {at}</div>
  const up = now > prev
  return <div className={`kpi-delta ${up ? 'up' : 'down'}`}>{up ? '↑' : '↓'} {Math.abs(now - prev)} from {at}</div>
}

function Kpi({ icon, cls, label, num, small, children, onGo }) {
  return (
    <div className="card kpi clickable" onClick={onGo} title="Klik untuk lihat detail di Risk Monitor">
      <div className={`kpi-ic ${cls}`}>{icon}</div>
      <div>
        <div className="kpi-label">{label}</div>
        <div className="kpi-num">{num} <small>{small}</small></div>
        {children}
      </div>
      <span className="kpi-go">→</span>
    </div>
  )
}

function KpiCards({ counts, countsPrev, at, onDrill }) {
  const high = counts[2] + counts[3]
  const highPrev = countsPrev[2] + countsPrev[3]
  const status = counts[3] > 0
    ? { label: 'Critical', sub: 'Immediate action required at some stations' }
    : high > 0
      ? { label: 'Elevated', sub: `Crowd build-up detected at ${high} station${high > 1 ? 's' : ''}` }
      : counts[1] > 0
        ? { label: 'Watch', sub: 'Moderate crowding, keep monitoring' }
        : { label: 'Normal', sub: 'MRT operations running normally' }
  return (
    <div className="kpis">
      <Kpi icon="⚠" cls="red" label="High Risk Stations" num={high} small="of 13 stations" onGo={() => onDrill('high')}>
        <Delta now={high} prev={highPrev} at={at} />
      </Kpi>
      <Kpi icon="●" cls="amber" label="Medium Risk Stations" num={counts[1]} small="of 13 stations" onGo={() => onDrill('medium')}>
        <Delta now={counts[1]} prev={countsPrev[1]} at={at} />
      </Kpi>
      <Kpi icon="●" cls="green" label="Low Risk Stations" num={counts[0]} small="of 13 stations" onGo={() => onDrill('low')}>
        <Delta now={counts[0]} prev={countsPrev[0]} at={at} />
      </Kpi>
      <Kpi icon="🛡" cls="blue" label="Network Status" num={status.label} small="" onGo={() => onDrill(null)}>
        <div className="kpi-sub">{status.sub}</div>
      </Kpi>
    </div>
  )
}

/* ================= konteks tanggal (event + hujan) ================= */
function ContextBar({ events, dateStr, nowRain, rainTotal, settings }) {
  const evs = eventsOn(events, dateStr)
  return (
    <div className="ctxbar card">
      <span className="ctx-item" data-tip="Event terverifikasi di sekitar koridor MRT hari ini — sumber kenaikan demand">
        📅 {evs.length === 0 ? 'Tidak ada event terjadwal' : `${evs.length} event hari ini:`}
      </span>
      {evs.map((e) => (
        <span key={e.name} className="ctx-badge" data-tip={e.basis}>
          {e.name} · {e.start}–{e.end} · ~{fmt(e.attendance)} · {short(e.station)}
        </span>
      ))}
      <span className="ctx-item" style={{ marginLeft: 'auto' }} data-tip={RAIN_TIP}>
        {settings && !settings.rainLabel
          ? (nowRain > 0
              ? `🌧 ${nowRain.toFixed(1).replace('.', ',')} mm/jam · total ${rainTotal.toFixed(1).replace('.', ',')} mm`
              : rainTotal > 0
                ? `☀ 0,0 mm/jam · total ${rainTotal.toFixed(1).replace('.', ',')} mm`
                : '☀ Kering')
          : rainText(nowRain, rainTotal)}
      </span>
    </div>
  )
}

/* ================= AI Analyzer jaringan (akses cepat dari Overview) ================= */
function AiNetworkCard({ counts, riskNow, events, dateStr, nowRain, rainTotal, horizonStr, horizonMin }) {
  const top = [...riskNow].sort((a, b) => b.score - a.score).slice(0, 3)
  const evs = eventsOn(events, dateStr)
  const grounding = [
    `Tanggal: ${dateStr}`,
    `Horizon pantauan: ${horizonStr} (${horizonMin} menit ke depan)`,
    `Status 13 stasiun: Critical=${counts[3]}, High=${counts[2]}, Medium=${counts[1]}, Low=${counts[0]}`,
    `3 stasiun dengan kepadatan antrean tertinggi: ${top.map((r) => `${short(r.st)} (level ${RISKS[r.lvl].label}, kepadatan ${r.score} org/m2, demand forecast ${fmt(r.demand)} pax/15mnt, hotspot ${r.hotspot || '-'})`).join('; ')}`,
    `Event hari ini: ${evs.length ? evs.map((e) => `${e.name} (${e.start}–${e.end}, ~${fmt(e.attendance)} penonton)`).join('; ') : 'tidak ada'}`,
    `Cuaca jam ini: ${rainText(nowRain, rainTotal)}`,
  ].join('\n')
  return (
    <div className="card ai-netcard">
      <div className="ai-nethead">
        <div>
          <h3>✨ AI Analyzer — Ringkasan Jaringan</h3>
          <div className="csub">Narasi situasi untuk briefing cepat control room. On-demand; digrounding penuh ke angka dashboard (bukan chatbot).</div>
        </div>
        <AiBox konteks="Ringkas situasi jaringan saat ini untuk control room: tingkat risiko, stasiun prioritas, konteks hari ini, dan apa yang perlu disiapkan."
          grounding={grounding} buttonLabel="✨ Analisis jaringan" />
      </div>
    </div>
  )
}

/* ================= network map ================= */
function NetworkMap({ data, riskNow, sel, setSel, horizonStr, horizonMin }) {
  const selInfo = riskNow.find((r) => r.st === sel)
  const totalDemand = riskNow.reduce((sum, r) => sum + r.demand, 0)
  const busiest = [...riskNow].sort((a, b) => b.demand - a.demand)[0]
  const gateLoad = Math.round((selInfo.demand / LAJU_GATE_BUCKET) * 100)

  return (
    <div className="card network-card">
      <div className="maphead">
        <div>
          <h3>Network Risk Map</h3>
          <div className="csub">Forecasted risk level at {horizonStr} ({horizonMin} min ahead)</div>
        </div>
        <div className="legend">
          <span><i style={{ background: '#a50e0e' }} />Critical</span>
          <span><i style={{ background: '#d93025' }} />High</span>
          <span><i style={{ background: '#e8710a' }} />Medium</span>
          <span><i style={{ background: '#188038' }} />Low</span>
        </div>
      </div>
      <StationLine data={data} riskNow={riskNow} sel={sel} onSelect={setSel} />

      {/* Opsi A: Detail Operasional Stasiun Terpilih */}
      <div className="net-st-box">
        <div className="net-st-header">
          <div className="stname">
            <i style={{ background: RISKS[selInfo.lvl].color }} />
            <span>{sel}</span>
          </div>
          <Badge lvl={selInfo.lvl} />
        </div>
        <div className="net-st-grid">
          <div className="net-stat-item">
            <div className="lb">Forecasted Demand</div>
            <div className="vl">{fmt(selInfo.demand)} <small>pax</small></div>
          </div>
          <div className="net-stat-item">
            <div className="lb">Kepadatan (Density)</div>
            <div className="vl">{selInfo.score.toFixed(2)} <small>pax/m²</small></div>
          </div>
          <div className="net-stat-item">
            <div className="lb">Titik Hotspot</div>
            <div className="vl" style={{ color: selInfo.hotspot ? '#d93025' : '#188038' }}>
              {selInfo.hotspot ? `📍 ${selInfo.hotspot}` : '✓ Normal'}
            </div>
          </div>
          <div className="net-stat-item">
            <div className="lb">Beban Kapasitas Gate</div>
            <div className="vl">{gateLoad}%</div>
          </div>
        </div>
      </div>

      {/* Opsi B: Mini Ringkasan Jaringan */}
      <div className="net-summary-strip">
        <div className="net-sum-item">
          <span className="lbl">Total Demand Jaringan:</span>
          <span className="val">{fmt(totalDemand)} pax</span>
        </div>
        <div className="net-sum-item">
          <span className="lbl">Stasiun Terpadat ({horizonStr}):</span>
          <span className="val">🔥 {short(busiest.st)} ({fmt(busiest.demand)} pax)</span>
        </div>
      </div>
    </div>
  )
}

/* ================= next-N table ================= */
function NextN({ riskNow, horizonStr, horizonMin }) {
  const [showAll, setShowAll] = useState(false)
  const sorted = [...riskNow].sort((a, b) => b.demand - a.demand)
  const list = showAll ? sorted : sorted.slice(0, 5)
  return (
    <div className="card">
      <h3>Next {horizonMin} Min Risk Prediction</h3>
      <table className="tbl">
        <thead>
          <tr><th>Station</th><th>Forecasted Demand ({horizonStr})</th><th>Risk Level</th><th>Density (pax/m²)</th><th>Hotspot</th></tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.st}>
              <td>{short(r.st)}</td>
              <td className="num">{fmt(r.demand)}</td>
              <td><Badge lvl={r.lvl} /></td>
              <td className="num">{r.score.toFixed(2)}</td>
              <td style={{ color: '#6b7280' }}>{r.hotspot || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="footnote" style={{ marginTop: 6 }}>* Density 0,00 = tidak ada antrean; demand terlayani penuh dalam bucket 15 menit yang sama.</div>
      <span className="linkmore" onClick={() => setShowAll(!showAll)}>
        {showAll ? 'Show top 5 only →' : 'View all stations →'}
      </span>
    </div>
  )
}

/* ================= chart card ================= */
function ChartCard({ data, rows, sel, bucket, hb, hSteps, dateIdx, horizonStr }) {
  const [mode, setMode] = useState('arus')
  const [ghost, setGhost] = useState(false)
  const [showTapIn, setShowTapIn] = useState(true)
  const [showTapOut, setShowTapOut] = useState(true)

  const toggleTapIn = () => {
    if (showTapIn && !showTapOut) return
    setShowTapIn(!showTapIn)
  }
  const toggleTapOut = () => {
    if (showTapOut && !showTapIn) return
    setShowTapOut(!showTapOut)
  }

  // Metrik berpasangan benar: prediksi t+15 yang diterbitkan 15 mnt sebelumnya vs aktual bucket ini
  let mae = 0, rmse = 0, mape = 0, w10 = 0, n = 0
  for (let b = 1; b <= bucket; b++) {
    const r = rows[b]
    const prev = rows[b - 1]
    if (!r || !prev || r[2] == null || prev[3] == null || r[2] <= 0) continue
    const e = Math.abs(r[2] - prev[3])
    mae += e; rmse += e * e; mape += e / r[2]; w10 += e / r[2] <= 0.1 ? 1 : 0; n++
  }
  n = n || 1
  const targetRow = rowAt(data, sel, dateIdx, hb)
  const lvl = targetRow ? targetRow[8] : 0
  const hotspot = targetRow ? HOTSPOTS[targetRow[13]] : null
  const issue = rows[bucket]
  const mid = issue && issue[2 + hSteps] != null ? issue[2 + hSteps] : null
  const lo = issue ? issue[18 + hSteps - 1] : null
  const up = issue ? issue[22 + hSteps - 1] : null
  return (
    <div className="card">
      <div className="charthead">
        <div>
          <h3>
            Forecast vs Actual — Arus Penumpang ({short(sel)}) <small className="u2">pax/15 mnt</small>{' '}
            <span className="info" data-tip={ARUS_TIP}>ⓘ</span>
          </h3>
          <div className="csub" style={{ marginTop: 4, color: '#6b7280', fontSize: '11.5px' }}>
            Tap-in = orang masuk stasiun (memenuhi gate masuk & peron) · Tap-out = orang keluar (memenuhi gate keluar). Lonjakan event: tap-out dulu saat datang, tap-in saat pulang.
          </div>
        </div>
        <div className="chartbadges">
          <Badge lvl={lvl} />
          {hotspot && <span className="hotbadge">📍 {hotspot}</span>}
        </div>
      </div>
      <div className="charttools">
        <div className="chips">
          {[['arus', 'Arus penumpang'], ['queue', 'Antrean per titik']].map(([v, lbl]) => (
            <button key={v} className={`chip ${mode === v ? 'active' : ''}`} onClick={() => setMode(v)}>{lbl}</button>
          ))}
        </div>
        {mode === 'arus' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label className="ghostsel">
              <input type="checkbox" checked={showTapIn} onChange={toggleTapIn} />
              {' '}Tap-in (masuk)
            </label>
            <label className="ghostsel">
              <input type="checkbox" checked={showTapOut} onChange={toggleTapOut} />
              {' '}Tap-out (keluar)
            </label>
            <label className="ghostsel">
              <input type="checkbox" checked={ghost} onChange={(e) => setGhost(e.target.checked)} />
              {' '}Ghost forecast sebelumnya
            </label>
          </div>
        )}
      </div>
      <div className="chartleg">
        {mode === 'arus' ? (
          <>
            <span
              className="it"
              onClick={toggleTapIn}
              style={{
                cursor: 'pointer',
                opacity: showTapIn ? 1 : 0.4,
                textDecoration: showTapIn ? 'none' : 'line-through',
                userSelect: 'none',
              }}
            >
              <span className="ln" style={{ borderTopColor: '#1a73e8' }} /> Aktual tap-in (masuk)
            </span>
            <span
              className="it"
              onClick={toggleTapOut}
              style={{
                cursor: 'pointer',
                opacity: showTapOut ? 1 : 0.4,
                textDecoration: showTapOut ? 'none' : 'line-through',
                userSelect: 'none',
              }}
            >
              <span className="ln" style={{ borderTopColor: '#46a171' }} /> Aktual tap-out (keluar)
            </span>
            <span
              className="it"
              onClick={toggleTapIn}
              style={{
                cursor: 'pointer',
                opacity: showTapIn ? 1 : 0.4,
                textDecoration: showTapIn ? 'none' : 'line-through',
                userSelect: 'none',
              }}
            >
              <span className="ln dash" style={{ borderTopColor: '#1a73e8' }} /> Forecast tap-in (masuk)
            </span>
            <span
              className="it"
              onClick={toggleTapOut}
              style={{
                cursor: 'pointer',
                opacity: showTapOut ? 1 : 0.4,
                textDecoration: showTapOut ? 'none' : 'line-through',
                userSelect: 'none',
              }}
            >
              <span className="ln dash" style={{ borderTopColor: '#46a171' }} /> Forecast tap-out (keluar)
            </span>
            {showTapIn && (
              <span className="it"><span className="ln band" /> Range conformal (lower 25% – upper 90%)</span>
            )}
            {ghost && (
              <span
                className="it"
                data-tip="Garis abu-abu = forecast yang diterbitkan 15 & 30 menit sebelum Now, untuk membandingkan konsistensi prediksi."
              >
                <span className="ln ghost" /> Vintage 15/30 mnt lalu
              </span>
            )}
          </>
        ) : (
          <>
            <span className="it"><span className="ln" style={{ background: '#1a73e8' }} /> Gate-in</span>
            <span className="it"><span className="ln" style={{ background: '#e67e22' }} /> Peron</span>
            <span className="it" data-tip={NOWCAST_TIP}><span className="ln" style={{ background: '#46a171' }} /> Gate-out <span className="nowcast">nowcast</span></span>
            <span className="it"><span className="ln dot" /> Ambang Fruin (antrean, org)</span>
          </>
        )}
      </div>
      <StockChart rows={rows} bucket={bucket} height={235} hSteps={hSteps} mode={mode} ghost={ghost} showTapIn={showTapIn} showTapOut={showTapOut} />
      {mode === 'arus' && mid != null && lo != null && up != null && (
        <div className="rangestrip">
          Perkiraan {horizonStr}: <b>{fmt(lo)} – {fmt(up)} penumpang</b>
          <span className="mid"> (estimasi tengah {fmt(mid)}) · siapkan untuk skenario atas</span>
        </div>
      )}
      {mode === 'arus' ? (
        <div className="metrics">
          <div className="metric"><div className="v">{fmt(mae / n)}</div><div className="l">MAE</div></div>
          <div className="metric"><div className="v">{fmt(Math.sqrt(rmse / n))}</div><div className="l">RMSE</div></div>
          <div className="metric"><div className="v">{(mape / n * 100).toFixed(1)}%</div><div className="l">MAPE</div></div>
          <div className="metric"><div className="v">{(w10 / n * 100).toFixed(0)}%</div><div className="l">Accuracy (within 10%)</div></div>
        </div>
      ) : (
        <div className="footnote">Setelah garis Now = antrean prediksi (lapisan peringatan conformal). Ambang Fruin: 664 / 1.232 / 2.856 orang.</div>
      )}
      {mode === 'arus' && (
        <div className="footnote">* Horizon t+15 (prediksi yang diterbitkan 15 mnt sebelumnya vs aktual), data s/d {b2str(bucket)}.</div>
      )}
    </div>
  )
}

/* ================= panel titik antrean ================= */
function TitikAntrean({ data, sel, dateIdx, hb, horizonStr }) {
  const row = rowAt(data, sel, dateIdx, hb)
  const hotspotIdx = row ? row[13] : -1
  return (
    <div className="card">
      <h3>
        Titik Antrean <span style={{ fontWeight: 500, color: '#6b7280' }}>({short(sel)}, {horizonStr})</span>{' '}
        <span className="info" data-tip={QUEUE_TIP}>ⓘ</span>
      </h3>
      <div className="csub" style={{ marginBottom: 8, color: '#6b7280', fontSize: '11.5px' }}>
        Antrean = orang yang belum terlayani dalam 15 menit. 0 berarti lancar, bukan sepi. Baru terisi saat demand melewati kapasitas gate/peron.
      </div>
      {TITIK.map((tk, k) => {
        const q = row ? row[tk.col] : 0
        const dens = densTitik(row, k)
        const lvl = lvlFromDens(dens)
        const wait = waitTitik(row, k)
        const isHot = k === hotspotIdx && lvl > 0
        const served = row ? (k === 2 ? (row[26] != null ? row[26] : 0) : (row[2] != null ? row[2] : 0)) : 0
        return (
          <div key={tk.id} className={`titik-row ${isHot ? 'hot' : ''}`}>
            <div className="titik-head">
              <span className="titik-name">
                {isHot ? '★ ' : ''}{tk.label}
                {tk.id === 'gate_out' && <span className="nowcast" data-tip={NOWCAST_TIP}>nowcast</span>}
              </span>
              <Badge lvl={lvl} />
            </div>
            <div className="titik-nums">
              <div><div className="v">{fmt(q)}</div><div className="l">antrean (org)</div></div>
              <div><div className="v">{dens.toFixed(2)}</div><div className="l">org/m²</div></div>
              <div><div className="v">{wait > 0.5 ? `±${Math.round(wait)}` : '0'}</div><div className="l">tunggu (mnt)</div></div>
            </div>
            <div className="titik-served" style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px', paddingTop: '4px', borderTop: '1px dashed #e5e7eb' }}>
              terlayani <b>{fmt(served)}</b> org/15 mnt
            </div>
          </div>
        )
      })}
      <div className="footnote" style={{ marginTop: 8 }}>
        ★ = hotspot (titik terburuk). Tunggu = antrean ÷ laju layanan × 15 mnt (Hukum Little).
      </div>
    </div>
  )
}

/* ================= why panel ================= */
const WHY_ICONS = [
  'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.5-6 8-6s8 2 8 6',
  'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 3',
  'M7 3h10a2 2 0 0 1 2 2v8a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V5a2 2 0 0 1 2-2zM5 10h14M8 21l2-4m6 4-2-4',
  'M7 15a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 7.5 4.5 4.5 0 0 1 17.5 15zM8 18l-1 2.5M12.5 18l-1 2.5M17 18l-1 2.5',
  'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1 1-1zM8 3v4m8-4v4M4 10h16',
]
const WHY_LABELS = ['Historical Demand (vs avg)', 'Peak Hour Effect', 'Train Service (Headway)', 'Rainfall', 'Event Impact']

export function WhyBars({ values }) {
  const items = WHY_LABELS.map((label, i) => ({ label, v: values ? values[i] : 0 }))
  return (
    <>
      {items.map((it, i) => (
        <div className="why-item" key={it.label}>
          <div className="why-ic"><svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={WHY_ICONS[i]} /></svg></div>
          <div className="why-body">
            <div className="why-top">
              <span>{it.label}</span>
              <span className="v">{it.v > 0 ? `+${it.v}` : it.v}%</span>
            </div>
            <div className="why-track">
              <div className="why-fill" style={{
                width: `${Math.min(100, (Math.abs(it.v) / 45) * 100)}%`,
                background: Math.abs(it.v) >= 18 ? '#d93025' : '#e8710a',
              }} />
            </div>
          </div>
        </div>
      ))}
    </>
  )
}

function WhyPanel({ data, sel, dateIdx, bucket, hb, horizonStr, horizonMin, goWhy, events, dateStr }) {
  const values = whyOf(data, sel, dateIdx, bucket, hb)
  const row = rowAt(data, sel, dateIdx, hb)
  const lvl = row ? row[8] : 0
  const hotspot = row ? HOTSPOTS[row[13]] : null
  const evs = eventsOn(events, dateStr)
  const evTxt = evs.length
    ? evs.map((e) => `${e.name} (${e.start}–${e.end}, ~${fmt(e.attendance)} penonton)`).join('; ')
    : 'tidak ada event terjadwal'
  const grounding = [
    `Stasiun: ${sel}`, `Tanggal: ${dateStr}`, `Jam horizon: ${horizonStr} (${horizonMin} menit ke depan)`,
    `Level risiko: ${RISKS[lvl].label.toUpperCase()}`, `Hotspot (titik terburuk): ${hotspot || '-'}`,
    `Kepadatan antrean: ${row ? row[9] : 0} org/m2`,
    `Kontribusi faktor (persen): historis vs rata-rata=${values ? values[0] : 0}%, jam sibuk=${values ? values[1] : 0}%, layanan kereta=${values ? values[2] : 0}%, hujan=${values ? values[3] : 0}%, event=${values ? values[4] : 0}%`,
    `Curah hujan pada bucket horizon: ${row ? row[14] : 0} mm`,
    `Event hari ini: ${evTxt}`,
  ].join('\n')
  return (
    <div className="card">
      <h3>Why is Risk High? <span style={{ fontWeight: 500, color: '#6b7280' }}>({short(sel)}, {horizonStr})</span></h3>
      <WhyBars values={values} />
      <div className="whyactions">
        <span className="linkmore" onClick={goWhy}>See full explanation →</span>
        <AiBox konteks="Jelaskan mengapa level risiko demikian untuk operator stasiun, berdasarkan faktor kontribusi."
          grounding={grounding} buttonLabel="🔍 Analisis AI" />
      </div>
    </div>
  )
}

/* ================= response panel ================= */
const RESP = {
  high: [
    ['⚙️', 'Increase station monitoring', 'Prepare additional staff for crowd monitoring'],
    ['📣', 'Strengthen passenger information', 'Use announcement & digital signage'],
    ['🚪', 'Review access conditions', 'Check escalator, gate, and platform flow'],
  ],
  medium: [
    ['⚙️', 'Increase station monitoring', 'Prepare additional staff for crowd monitoring'],
    ['📣', 'Strengthen passenger information', 'Use announcement & digital signage'],
  ],
  low: [['✅', 'Maintain regular monitoring', 'No crowd anomaly expected in the next horizon window']],
}

function ResponsePanel({ sel, lvl, goRec }) {
  const list = lvl >= 2 ? RESP.high : lvl === 1 ? RESP.medium : RESP.low
  return (
    <div className="card">
      <h3>Recommended Response <span style={{ fontWeight: 500, color: '#6b7280' }}>({short(sel)})</span></h3>
      {list.map(([ic, t, d]) => (
        <div className="resp-item" key={t}>
          <div className="resp-ic">{ic}</div>
          <div>
            <div className="t">{t}</div>
            <div className="d">{d}</div>
          </div>
          <span className="chev">›</span>
        </div>
      ))}
      <span className="linkmore" onClick={goRec}>View all recommendations →</span>
    </div>
  )
}

/* ================= what-if ringkas ================= */
function WhatIfMini({ base, cap, horizonStr, goWhatif }) {
  const [rain, setRain] = useState(15)
  const [head, setHead] = useState(5)
  const chg = Math.round(rain * 0.7) + Math.round((5 - head) * 5.5)
  const demand = Math.round(base * (1 + chg / 100))
  const lvl = cap > 0 ? (demand / cap < 0.45 ? 0 : demand / cap < 0.65 ? 1 : demand / cap < 0.8 ? 2 : 3) : 0
  return (
    <div className="card">
      <h3>What-if Simulator</h3>
      <div className="wi-controls">
        <div>
          <label data-tip={RAIN_TIP}>Rainfall (curah hujan)</label>
          <select value={rain} onChange={(e) => setRain(Number(e.target.value))}>
            <option value={0}>☀ Kering · 0 mm</option><option value={5}>🌧 Hujan ringan · 5 mm</option>
            <option value={15}>🌧 Hujan sedang · 15 mm</option><option value={30}>⛈ Hujan lebat · 30 mm</option>
          </select>
        </div>
        <div>
          <label>Headway</label>
          <select value={head} onChange={(e) => setHead(Number(e.target.value))}>
            <option value={3}>3 min</option><option value={5}>5 min</option><option value={7}>7 min</option>
          </select>
        </div>
      </div>
      <div className="wi-result">
        <div>
          <div className="lb">Forecasted Demand ({horizonStr})</div>
          <div className="v">{fmt(demand)}</div>
        </div>
        <div className={`wi-chg ${chg >= 0 ? 'up' : 'down'}`}>{chg >= 0 ? '+' : ''}{chg}% {chg >= 0 ? '↑' : '↓'}</div>
        <Badge lvl={lvl} />
      </div>
      <span className="linkmore" onClick={goWhatif}>Run full scenario →</span>
    </div>
  )
}

/* ================= overview ================= */
export default function Overview(props) {
  const {
    data, dateIdx, bucket, hb, hSteps, horizonMin, horizonStr, counts, countsPrev, prevAt,
    riskNow, sel, setSel, rowOf, onDrill, goTab, events, settings,
  } = props
  const selInfo = riskNow.find((r) => r.st === sel)
  const srows = data.rows[sel].slice(dateIdx * 76, dateIdx * 76 + 76)
  const issueRow = rowOf(sel, dateIdx, bucket)
  const baseWhatif = issueRow && issueRow[2 + hSteps] != null ? issueRow[2 + hSteps] : 0
  const dateStr = data.dates[dateIdx]
  return (
    <div className="content">
      <KpiCards counts={counts} countsPrev={countsPrev} at={prevAt} onDrill={onDrill} />
      <ContextBar events={events} dateStr={dateStr} nowRain={rainAt(data, dateIdx, bucket)} rainTotal={dailyRain(data, dateIdx)} settings={settings} />
      <AiNetworkCard counts={counts} riskNow={riskNow} events={events} dateStr={dateStr}
        nowRain={rainAt(data, dateIdx, bucket)} rainTotal={dailyRain(data, dateIdx)} horizonStr={horizonStr} horizonMin={horizonMin} />
      <div className="row2">
        <NetworkMap data={data} riskNow={riskNow} sel={sel} setSel={setSel} horizonStr={horizonStr} horizonMin={horizonMin} />
        <NextN riskNow={riskNow} horizonStr={horizonStr} horizonMin={horizonMin} />
      </div>
      <div className="row3">
        <ChartCard data={data} rows={srows} sel={sel} bucket={bucket} hb={hb} hSteps={hSteps}
          dateIdx={dateIdx} horizonStr={horizonStr} />
        <TitikAntrean data={data} sel={sel} dateIdx={dateIdx} hb={hb} horizonStr={horizonStr} />
      </div>
      <div className="row4">
        <WhyPanel data={data} sel={sel} dateIdx={dateIdx} bucket={bucket} hb={hb}
          horizonStr={horizonStr} horizonMin={horizonMin} goWhy={() => goTab('Why (Explain)')}
          events={events} dateStr={dateStr} />
        <ResponsePanel sel={sel} lvl={selInfo ? selInfo.lvl : 0} goRec={() => goTab('Recommendation')} />
        <WhatIfMini base={baseWhatif} cap={data.cap[sel]} horizonStr={horizonStr} goWhatif={() => goTab('What-if Simulator')} />
      </div>
      <div className="foot">ⓘ Data model asli notebook v18 (XGBoost global berbobot + lapisan skenario event + conformal kondisional, CRS 3 titik). Prediksi diterbitkan per 15 menit untuk 1 jam ke depan.</div>
    </div>
  )
}
