import React, { useEffect, useState } from 'react'
import Overview from './Overview.jsx'
import {
  RiskMonitorPage, PredictionPage, WhyPage, WhatIfPage, RecommendationPage, PerformancePage,
  ReportsPage, SettingsPage,
} from './Tabs.jsx'
import { NAV_PATHS, Icon, Transport, riskAt, rowAt, b2str, fmtDate, min2str, B0, dailyRain, rainAt, eventsOn, B_LAST, rainText, RAIN_TIP, sortStations } from './util.jsx'

const NAV = ['Overview', 'Risk Monitor', 'Prediction', 'Why (Explain)', 'What-if Simulator',
  'Recommendation', 'Performance', 'Reports', 'Settings']
const TICKS = [6, 8, 10, 12, 14, 16, 18, 20, 22]

/* ---------- sidebar (v4: bisa dilipat ala Notion) ---------- */
function Sidebar({ page, setPage, meta, collapsed, onToggle }) {
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="brand">
        {!collapsed ? (
          <>
            <div>
              ForeSight
              <small>MRT Crowd Intelligence</small>
            </div>
            <button className="sb-toggle-top" onClick={onToggle} data-tip="Tutup sidebar">
              <Icon d="M11 17l-5-5 5-5M18 17l-5-5 5-5" size={17} />
            </button>
          </>
        ) : (
          <button className="sb-toggle-top" onClick={onToggle} data-tip="Buka sidebar">
            <Icon d="M4 6h16M4 12h16M4 18h16" size={20} />
          </button>
        )}
      </div>
      {NAV.map((n) => (
        <button key={n} className={`navitem ${page === n ? 'active' : ''}`} onClick={() => setPage(n)}
          data-tip={collapsed ? n : undefined}>
          <Icon d={NAV_PATHS[n]} /> <span className="nav-label">{n}</span>
        </button>
      ))}
      <div className="sidebar-sys">
        <div><span className="okdot" /> <b>System Info</b></div>
        <div>All systems operational</div>
        <div>Model Version <b>{meta ? meta.model_version : '—'}</b></div>
        <div>Last Model Run <b>{meta ? meta.generated : '—'}</b></div>
      </div>
    </aside>
  )
}

/* ---------- topbar ---------- */
function TopBar({ data, events, dateIdx, setDateIdx, bucket, setBucket, playing, setPlaying, speed, setSpeed, horizonMin, setHorizonMin, settings }) {
  const dstr = data.dates[dateIdx]
  const pct = (Math.min(bucket, B_LAST) / B_LAST) * 100
  const pctB = Math.min(Math.max(pct, 3.5), 96.5) // bubble tidak terpotong di tepi slider
  const nowRain = rainAt(data, dateIdx, bucket)
  const totalRain = dailyRain(data, dateIdx)
  const dayEvents = eventsOn(events, dstr)
  return (
    <div className="topbar">
      <div className="tb-title">
        <h1>Historical Replay <span className="info">ⓘ</span></h1>
        <div className="sub">Data through {fmtDate(dstr)}, {b2str(bucket)}</div>
      </div>
      <div className="tb-date" data-tip="Pilih tanggal replay">
        <Icon d={'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 3v4m8-4v4M4 10h16'} size={15} />
        <select value={dateIdx} onChange={(e) => setDateIdx(Number(e.target.value))}>
          {data.dates.map((d, i) => <option key={d} value={i}>{fmtDate(d)}</option>)}
        </select>
      </div>
      <div className="tb-clock">
        <span className="t">{b2str(bucket)}</span>
        <Icon d={'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 3'} size={16} />
      </div>
      <button className="tbtn" data-tip="Mundur 15 menit" onClick={() => setBucket(Math.max(bucket - 1, 0))}>
        <Transport kind="prev" />
      </button>
      <button className="tbtn play" data-tip={playing ? 'Jeda replay' : 'Putar replay'} onClick={() => setPlaying(!playing)}>
        <Transport kind={playing ? 'pause' : 'play'} />
      </button>
      <button className="tbtn" data-tip="Maju 15 menit" onClick={() => setBucket(Math.min(bucket + 1, B_LAST))}>
        <Transport kind="next" />
      </button>
      <select className="speedsel" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}
        data-tip="Kecepatan replay">
        <option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option>
      </select>
      <div className="slider-wrap">
        <div className="slider-bubble" style={{ left: `calc(${pctB}% + ${(50 - pctB) * 0.17}px)` }}>{b2str(bucket)}</div>
        <input type="range" className="slider" min={0} max={B_LAST} value={Math.min(bucket, B_LAST)}
          style={{ '--fill': `${pct}%` }}
          onChange={(e) => setBucket(Number(e.target.value))} />
        <div className="ticks">
          {TICKS.map((h) => (
            <span key={h} style={{ left: `${((h * 60 - B0) / (B_LAST * 15)) * 100}%` }}>{min2str(h * 60)}</span>
          ))}
        </div>
      </div>
      <div className="tb-horizon" data-tip="Jendela forecast yang ditampilkan di semua panel — seberapa jauh ke depan risiko diprediksi">
        <span className="hz-label">HORIZON</span>
        {[[30, '30 mnt'], [60, '1 jam']].map(([v, lbl]) => (
          <button key={v} className={`chip ${horizonMin === v ? 'active' : ''}`} onClick={() => setHorizonMin(v)}>{lbl}</button>
        ))}
      </div>
      <div className="tb-ctx" data-tip={dayEvents.map((e) => `${e.name} (${e.start}–${e.end})`).join(' · ') || 'Tidak ada event terjadwal hari ini'}>
        <span className="ctx-pill" data-tip={RAIN_TIP}>
          {settings && !settings.rainLabel
            ? (nowRain > 0
                ? `🌧 ${nowRain.toFixed(1).replace('.', ',')} mm/jam · total ${totalRain.toFixed(1).replace('.', ',')} mm`
                : totalRain > 0
                  ? `☀ 0,0 mm/jam · total ${totalRain.toFixed(1).replace('.', ',')} mm`
                  : '☀ 0,0 mm')
            : rainText(nowRain, totalRain)}
        </span>
        {dayEvents.length > 0 && <span className="ctx-pill ev">📅 {dayEvents.length} event</span>}
      </div>
      <div className="datamode">
        DATA MODE
        <div className="v"><span className="dot" /> Historical Replay</div>
      </div>
    </div>
  )
}

/* ---------- skeleton saat data dimuat (v4) ---------- */
function LoadingSkeleton() {
  return (
    <div className="app">
      <div className="sidebar sk-side">
        <div className="sk sk-brand" />
        {[...Array(9)].map((_, i) => <div key={i} className="sk sk-nav" />)}
      </div>
      <div className="main">
        <div className="sk sk-topbar" />
        <div className="content">
          <div className="kpis">{[...Array(4)].map((_, i) => <div key={i} className="sk sk-kpi" />)}</div>
          <div className="sk sk-panel" style={{ marginTop: 16 }} />
          <div className="sk sk-panel" style={{ marginTop: 16, height: 260 }} />
        </div>
      </div>
    </div>
  )
}

/* ---------- app ---------- */
export default function App() {
  const [data, setData] = useState(null)
  const [events, setEvents] = useState([])
  const [err, setErr] = useState(null)
  const [page, setPage] = useState('Overview')
  const [dateIdx, setDateIdx] = useState(0)
  const [bucket, setBucket] = useState(40) // 15:00
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fs.settings') || '{}').defSpeed || 1 } catch { return 1 }
  })
  const [horizonMin, setHorizonMin] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fs.settings') || '{}').defHorizon || 60 } catch { return 60 }
  })
  const [sel, setSel] = useState('Blok M BCA')
  const [riskFilter, setRiskFilter] = useState(null)

  // v4: sidebar lipat + preferensi tampilan (tersimpan di browser operator)
  const DEFAULTS = { anim: true, tips: true, rainLabel: true, defHorizon: 60, defSpeed: 1 }
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('fs.sidebar') === '1')
  const [settings, setSettings] = useState(() => {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('fs.settings') || '{}') } }
    catch { return { ...DEFAULTS } }
  })
  const setSetting = (k, v) => setSettings((s) => ({ ...s, [k]: v }))
  const resetSettings = () => setSettings({ ...DEFAULTS })
  useEffect(() => { localStorage.setItem('fs.sidebar', collapsed ? '1' : '0') }, [collapsed])
  useEffect(() => { localStorage.setItem('fs.settings', JSON.stringify(settings)) }, [settings])

  useEffect(() => {
    Promise.all([
      fetch('./data/dashboard_data.json').then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      }),
      fetch('./data/events.json').then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([j, ev]) => {
        setEvents(ev || [])
        if (j && j.stations) j.stations = sortStations(j.stations)
        // deep link opsional: ?d=YYYY-MM-DD&b=<bucket>&st=<stasiun> — berguna untuk demo ke juri
        const q = new URLSearchParams(window.location.search)
        const qd = q.get('d')
        const qb = q.get('b')
        const qs = q.get('st')
        const di = qd ? j.dates.indexOf(qd) : j.dates.indexOf('2026-06-27')
        if (di >= 0) setDateIdx(di)
        if (qb != null && !Number.isNaN(Number(qb))) setBucket(Math.max(0, Math.min(B_LAST, Number(qb))))
        if (qs && j.stations.includes(qs)) setSel(qs)
        setData(j)
      })
      .catch((e) => setErr(String(e)))
  }, [])

  useEffect(() => {
    if (!playing) return undefined
    const id = setInterval(() => {
      setBucket((b) => {
        if (b >= B_LAST) {
          setPlaying(false)
          return b
        }
        return b + 1
      })
    }, 700 / speed)
    return () => clearInterval(id)
  }, [playing, speed])

  if (err) return <div className="loading">Gagal memuat data: {err}</div>
  if (!data) return <LoadingSkeleton />

  const hSteps = horizonMin / 15
  const hb = Math.min(bucket + hSteps, B_LAST)   // v4: clamp — data berakhir 22:45
  const horizonStr = b2str(hb)
  const prevBucket = Math.max(bucket - 2, 0)
  const prevAt = b2str(Math.min(prevBucket + hSteps, B_LAST))
  const rowOf = (st, d, b) => rowAt(data, st, d, b)
  const riskNow = riskAt(data, dateIdx, bucket, hb)

  const countsAt = (bk) => {
    const c = [0, 0, 0, 0]
    for (const r of riskAt(data, dateIdx, bk, Math.min(bk + hSteps, B_LAST))) c[r.lvl]++
    return c
  }
  const counts = countsAt(bucket)
  const countsPrev = countsAt(prevBucket)

  const onDrill = (level) => {
    setRiskFilter(level)
    setPage('Risk Monitor')
  }

  const shared = { data, dateIdx, bucket, hb, hSteps, horizonMin, horizonStr, riskNow, sel, setSel, rowOf, events, settings }

  return (
    <div className={`app ${settings.tips ? '' : 'no-tips'} ${settings.anim ? '' : 'no-anim'}`}>
      <Sidebar page={page} setPage={setPage} meta={data.meta} collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)} />
      <div className="main">
        <TopBar data={data} events={events} dateIdx={dateIdx} setDateIdx={setDateIdx} bucket={bucket}
          setBucket={setBucket} playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed}
          horizonMin={horizonMin} setHorizonMin={setHorizonMin} settings={settings} />
        <div key={page} className="pagefade">
        {page === 'Overview' && (
          <Overview {...shared} counts={counts} countsPrev={countsPrev} prevAt={prevAt}
            onDrill={onDrill} goTab={setPage} />
        )}
        {page === 'Risk Monitor' && (
          <RiskMonitorPage {...shared} filter={riskFilter} setFilter={setRiskFilter} goTab={setPage} />
        )}
        {page === 'Prediction' && <PredictionPage data={data} dateIdx={dateIdx} bucket={bucket} sel={sel} setSel={setSel} />}
        {page === 'Why (Explain)' && <WhyPage data={data} dateIdx={dateIdx} bucket={bucket} hb={hb} horizonMin={horizonMin} sel={sel} setSel={setSel} events={events} />}
        {page === 'What-if Simulator' && <WhatIfPage data={data} dateIdx={dateIdx} bucket={bucket} hSteps={hSteps} hb={hb} sel={sel} setSel={setSel} />}
        {page === 'Recommendation' && <RecommendationPage data={data} dateIdx={dateIdx} bucket={bucket} hb={hb} horizonMin={horizonMin} sel={sel} riskNow={riskNow} events={events} />}
        {page === 'Performance' && <PerformancePage data={data} />}
        {page === 'Reports' && (
          <ReportsPage data={data} dateIdx={dateIdx} bucket={bucket} events={events}
            horizonStr={horizonStr} horizonMin={horizonMin} />
        )}
        {page === 'Settings' && (
          <SettingsPage settings={settings} setSetting={setSetting} onReset={resetSettings} />
        )}
        </div>
      </div>
    </div>
  )
}
