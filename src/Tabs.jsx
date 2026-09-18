import React, { useMemo, useState } from 'react'
import StockChart from './chart.jsx'
import { WhyBars, AiBox } from './Overview.jsx'
import { MODEL, getOpenRouterKey, setOpenRouterKey, testAIConnection } from './llm.js'
import {
  Badge, StationLine, rowAt, riskOf, b2str, fmt, fmtDate, short, whyOf, typicalOf,
  LAJU_GATE_BUCKET, RISKS, HOTSPOTS, eventsOn, dailyRain, B_LAST, RAIN_TIP, NOWCAST_TIP,
} from './util.jsx'

/* ================= Risk Monitor ================= */
export function RiskMonitorPage({ data, dateIdx, bucket, hb, horizonMin, riskNow, filter, setFilter, sel, setSel, goTab }) {
  const horizonStr = b2str(hb)
  const h = Math.max(hb - bucket, 1)
  const prevBucket = Math.max(bucket - 2, 0)
  const match = (lvl) =>
    filter == null ? true : filter === 'high' ? lvl >= 2 : filter === 'medium' ? lvl === 1 : lvl === 0
  const rows = riskNow
    .map((r) => {
      const pi = rowAt(data, r.st, dateIdx, prevBucket)
      const prevDemand = pi && pi[2 + h] != null ? pi[2 + h] : r.demand
      const diff = r.demand - prevDemand
      const targetRow = rowAt(data, r.st, dateIdx, hb)
      const tapIn = targetRow ? targetRow[2] : null
      const tapOut = targetRow ? targetRow[26] : null
      const qIn = targetRow ? targetRow[10] : 0
      const qPeron = targetRow ? targetRow[11] : 0
      const qOut = targetRow ? targetRow[12] : 0
      const hotspotIdx = targetRow ? targetRow[13] : -1
      return {
        ...r,
        trend: Math.abs(diff) < r.demand * 0.03 + 1 ? 0 : diff > 0 ? 1 : -1,
        tapIn,
        tapOut,
        qIn,
        qPeron,
        qOut,
        hotspotIdx,
      }
    })
    .filter((r) => match(r.lvl))
    .sort((a, b) => b.score - a.score)

  const QUEUE_TIP = "Antrean = orang yang menunggu (stock). 0 berarti semua penumpang terlayani dalam bucket yang sama — bukan berarti tidak ada penumpang."

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <h2>Risk Monitor</h2>
          <div className="sub">Papan monitoring semua stasiun — mengikuti jarum replay (horizon {horizonMin} menit ke depan)</div>
        </div>
        <div className="chips">
          {[[null, 'Semua'], ['high', 'High + Critical'], ['medium', 'Medium'], ['low', 'Low']].map(([v, lbl]) => (
            <button key={lbl} className={`chip ${filter === v ? 'active' : ''}`} onClick={() => setFilter(v)}>{lbl}</button>
          ))}
        </div>
      </div>
      <div className="card">
        <StationLine data={data} riskNow={riskNow} sel={sel} onSelect={setSel} />
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Detail stasiun ({rows.length} stasiun{filter ? ' — hasil filter' : ''})</h3>
        <table className="tbl">
          <thead>
            <tr>
              <th>Station</th>
              <th>Forecasted Demand ({horizonStr})</th>
              <th>Risk Level</th>
              <th>Density (pax/m²)</th>
              <th style={{ borderLeft: '2px solid #e5e7eb' }}>Tap-in (org)</th>
              <th>Tap-out (org)</th>
              <th style={{ borderLeft: '2px solid #e5e7eb' }} data-tip={QUEUE_TIP}>Gate-in (org)</th>
              <th data-tip={QUEUE_TIP}>Peron (org)</th>
              <th data-tip={QUEUE_TIP}>
                Gate-out (org) <span className="nowcast" data-tip={NOWCAST_TIP}>nowcast</span>
              </th>
              <th>Trend vs 30 mnt lalu</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const hasQueue = (r.qIn + r.qPeron + r.qOut) > 0
              const isHotIn = hasQueue && r.hotspotIdx === 0
              const isHotPeron = hasQueue && r.hotspotIdx === 1
              const isHotOut = hasQueue && r.hotspotIdx === 2

              return (
                <tr key={r.st}>
                  <td><b>{short(r.st)}</b></td>
                  <td className="num">{r.demand != null ? fmt(r.demand) : '—'}</td>
                  <td><Badge lvl={r.lvl} /></td>
                  <td className="num">{r.score != null ? r.score.toFixed(2) : '—'}</td>
                  
                  {/* Volume Arus (Flow) */}
                  <td className="num" style={{ borderLeft: '2px solid #e5e7eb' }}>
                    {r.tapIn != null ? fmt(r.tapIn) : '—'}
                  </td>
                  <td className="num">
                    {r.tapOut != null ? fmt(r.tapOut) : '—'}
                  </td>

                  {/* Titik Antrean (Stock) */}
                  <td className="num" style={{
                    borderLeft: '2px solid #e5e7eb',
                    fontWeight: isHotIn ? 700 : 400,
                    color: isHotIn ? '#d93025' : 'inherit',
                  }}>
                    {r.qIn != null ? fmt(r.qIn) : '—'} {isHotIn && '★'}
                  </td>
                  <td className="num" style={{
                    fontWeight: isHotPeron ? 700 : 400,
                    color: isHotPeron ? '#d93025' : 'inherit',
                  }}>
                    {r.qPeron != null ? fmt(r.qPeron) : '—'} {isHotPeron && '★'}
                  </td>
                  <td className="num" style={{
                    fontWeight: isHotOut ? 700 : 400,
                    color: isHotOut ? '#d93025' : 'inherit',
                  }}>
                    {r.qOut != null ? fmt(r.qOut) : '—'} {isHotOut && '★'}
                  </td>

                  <td>{r.trend > 0 ? <span className="t-up">↑ naik</span> : r.trend < 0 ? <span className="t-down">↓ turun</span> : <span className="t-flat">— stabil</span>}</td>
                  <td><span className="linkmore" onClick={() => { setSel(r.st); goTab('Prediction') }}>Lihat prediksi →</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="footnote" style={{ marginTop: 10 }}>
          * Tap-in & Tap-out = volume arus penumpang (flow). Gate-in, Peron, Gate-out = orang yang menunggu antrean (stock); 0 = terlayani penuh.
          ★ = Titik hotspot antrean terburuk (hanya tampil jika antrean &gt; 0).
        </div>
      </div>
    </div>
  )
}

/* ================= Prediction ================= */
export function PredictionPage({ data, dateIdx, bucket, sel, setSel }) {
  const [horizon, setHorizon] = useState(2) // 1..4 bucket
  const [compareSt, setCompareSt] = useState('')
  const rows = data.rows[sel].slice(dateIdx * 76, dateIdx * 76 + 76)

  const typical = useMemo(() => typicalOf(data, sel).typ, [data, sel])

  const compare = useMemo(() => {
    if (!compareSt) return null
    return data.rows[compareSt].slice(dateIdx * 76, dateIdx * 76 + 76).map((r) => (r ? r[2] : null))
  }, [data, compareSt, dateIdx])

  const issue = rows[bucket]
  const demand = issue && issue[2 + horizon] != null ? issue[2 + horizon] : 0
  const lo = issue ? issue[18 + horizon - 1] : null
  const up = issue ? issue[22 + horizon - 1] : null
  const tb = Math.min(bucket + horizon, 75)
  const targetRow = rows[tb]
  const lvl = targetRow ? targetRow[8] : 0
  const horizonMin = horizon * 15

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <h2>Prediction</h2>
          <div className="sub">Detail prediksi per stasiun — sumbu waktu tumbuh mengikuti replay (maks. 60 menit ke depan)</div>
        </div>
        <div className="chips">
          {[[1, '15 min'], [2, '30 min'], [3, '45 min'], [4, '60 min']].map(([v, lbl]) => (
            <button key={v} className={`chip ${horizon === v ? 'active' : ''}`} onClick={() => setHorizon(v)}>{lbl}</button>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="selrow">
          <label>Station</label>
          <select className="stselect" value={sel} onChange={(e) => setSel(e.target.value)}>
            {data.stations.map((st) => <option key={st} value={st}>{st}</option>)}
          </select>
          <label style={{ marginLeft: 14 }}>Compare with</label>
          <select className="stselect" value={compareSt} onChange={(e) => setCompareSt(e.target.value)}>
            <option value="">— none —</option>
            {data.stations.filter((st) => st !== sel).map((st) => <option key={st} value={st}>{st}</option>)}
          </select>
        </div>
        <div className="chartleg">
          <span className="it"><span className="ln" /> Actual</span>
          <span className="it"><span className="ln dash" /> Forecast</span>
          <span className="it"><span className="ln band" /> Range conformal</span>
          <span className="it"><span className="ln typ" /> Typical day</span>
          {compare && <span className="it"><span className="ln cmp" /> {short(compareSt)} (actual)</span>}
        </div>
        <StockChart rows={rows} bucket={bucket} height={330} typical={typical} compare={compare} compareName={short(compareSt || '')} hSteps={4} mode="demand" />
      </div>
      <div className="detailstrip" style={{ marginTop: 16 }}>
        <div className="card ds">
          <div className="lb">Forecast Horizon</div>
          <div className="vl">{b2str(tb)} <small style={{ fontWeight: 500, color: '#6b7280' }}>({horizonMin} min ahead)</small></div>
        </div>
        <div className="card ds">
          <div className="lb">Forecasted Demand</div>
          <div className="vl">{fmt(demand)} passengers</div>
          {lo != null && up != null && (
            <div className="lb" style={{ marginTop: 4 }}>Range: {fmt(lo)} – {fmt(up)}</div>
          )}
        </div>
        <div className="card ds">
          <div className="lb">Risk Level</div>
          <div className="vl"><Badge lvl={lvl} /></div>
        </div>
        <div className="card ds">
          <div className="lb">vs Typical Day</div>
          <div className="vl">{typical[tb] > 0 ? `${demand >= typical[tb] ? '+' : ''}${Math.round((demand - typical[tb]) / typical[tb] * 100)}%` : '—'}</div>
        </div>
      </div>
    </div>
  )
}

/* ================= Why (Explain) ================= */
const FACTOR_INFO = [
  ['Historical Demand', 'Seberapa jauh forecast untuk bucket horizon melampaui rata-rata historis (typical day) pada jam & stasiun yang sama.'],
  ['Peak Hour Effect', 'Posisi jam ini pada profil typical day stasiun — seberapa jauh di atas/bawah rata-rata hariannya.'],
  ['Train Service (Headway)', 'Jumlah kereta per bucket vs rata-rata stasiun; nilai positif = layanan lebih jarang dari biasanya → antrean menumpuk.'],
  ['Rainfall', 'Curah hujan pada bucket horizon (mm), diskalakan ke rentang efek literatur (±3–10%).'],
  ['Event Impact', 'Attendance event terjadwal pada bucket horizon, diskalakan (±12 ribu penonton ≈ +5%).'],
]

export function WhyPage({ data, dateIdx, bucket, hb, horizonMin, sel, setSel, events }) {
  const values = whyOf(data, sel, dateIdx, bucket, hb)
  const row = rowAt(data, sel, dateIdx, hb)
  const lvl = row ? row[8] : 0
  const hotspot = row ? HOTSPOTS[row[13]] : null
  const dateStr = data.dates[dateIdx]
  const evs = eventsOn(events, dateStr)
  const grounding = [
    `Stasiun: ${sel}`, `Tanggal: ${dateStr}`, `Jam horizon: ${b2str(hb)} (${horizonMin} menit ke depan)`,
    `Level risiko: ${RISKS[lvl].label.toUpperCase()}`, `Hotspot: ${hotspot || '-'}`,
    `Kepadatan antrean: ${row ? row[9] : 0} org/m2`,
    `Kontribusi faktor (persen): historis=${values ? values[0] : 0}%, jam sibuk=${values ? values[1] : 0}%, kereta=${values ? values[2] : 0}%, hujan=${values ? values[3] : 0}%, event=${values ? values[4] : 0}%`,
    `Hujan bucket horizon: ${row ? row[14] : 0} mm`,
    `Event hari ini: ${evs.length ? evs.map((e) => `${e.name} (${e.start}–${e.end}, ~${fmt(e.attendance)})`).join('; ') : 'tidak ada'}`,
  ].join('\n')
  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <h2>Why (Explain)</h2>
          <div className="sub">Bedah faktor penyebab risiko untuk stasiun terpilih pada horizon {horizonMin} menit</div>
        </div>
        <select className="stselect" value={sel} onChange={(e) => setSel(e.target.value)}>
          {data.stations.map((st) => <option key={st} value={st}>{st}</option>)}
        </select>
      </div>
      <div className="card">
        <h3>Kontribusi faktor — {short(sel)} @ {b2str(hb)}</h3>
        <WhyBars values={values} />
        <div className="note" style={{ marginTop: 10 }}>
          Indikatif — dihitung dari field asli baris ini (forecast, typical day, kereta, hujan, event).
          Atribusi SHAP resmi per prediksi tersedia di notebook (Why Engine).
        </div>
        <AiBox konteks="Jelaskan secara naratif mengapa risiko demikian dan apa yang harus diperhatikan petugas."
          grounding={grounding} buttonLabel="🔍 Analisis AI (on-demand)" />
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Cara membaca faktor</h3>
        {FACTOR_INFO.map(([t, d]) => (
          <div key={t} className="factor-desc"><b>{t}.</b> {d}</div>
        ))}
      </div>
    </div>
  )
}

/* ================= What-if Simulator ================= */
export function WhatIfPage({ data, dateIdx, bucket, hSteps, hb, sel, setSel }) {
  const [rain, setRain] = useState(15)
  const [head, setHead] = useState(5)
  const [evSize, setEvSize] = useState(0)
  const [gateIn, setGateIn] = useState(6)    // v19: asumsi 6 gate masuk / stasiun
  const [gateOut, setGateOut] = useState(6)  // v19: asumsi 6 gate keluar / stasiun
  const issue = rowAt(data, sel, dateIdx, bucket)
  const base = issue && issue[2 + hSteps] != null ? issue[2 + hSteps] : 0
  // Prediksi tap-out horizon ke-h ada di kolom 26+h (layout baris: 27-30 = pred_out_t+1..4)
  const baseOut = issue && issue[26 + hSteps] != null ? issue[26 + hSteps] : 0
  const chg = Math.round(rain * 0.7) + Math.round((5 - head) * 5.5) + Math.min(40, evSize / 4000)
  const demand = Math.round(base * (1 + chg / 100))
  const demandOut = Math.round(baseOut * (1 + chg / 100))
  // Kapasitas gate per bucket 15 menit: jumlah gate x 20 tap/mnt x 15 mnt.
  // (Fix lama: cap dari data.cap adalah objek {gate_in, gate_out} sehingga badge selalu LOW;
  //  kini kapasitas dihitung dari jumlah gate yang bisa diotak-atik pengguna.)
  const capIn = gateIn * 20 * 15
  const capOut = gateOut * 20 * 15
  const lvlNew = riskOf(demand / capIn)
  const lvlOutNew = riskOf(demandOut / capOut)
  const targetRow = rowAt(data, sel, dateIdx, hb)
  const lvlBase = targetRow ? targetRow[8] : 0
  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <h2>What-if Simulator</h2>
          <div className="sub">Uji skenario pada stasiun & waktu yang sedang diputar di replay</div>
        </div>
        <select className="stselect" value={sel} onChange={(e) => setSel(e.target.value)}>
          {data.stations.map((st) => <option key={st} value={st}>{st}</option>)}
        </select>
      </div>
      <div className="card">
        <h3>Parameter skenario</h3>
        <div className="wi-controls3">
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
          <div>
            <label>Event tambahan di stasiun ini</label>
            <select value={evSize} onChange={(e) => setEvSize(Number(e.target.value))}>
              <option value={0}>— tidak ada —</option><option value={20000}>20.000 orang</option>
              <option value={50000}>50.000 orang</option><option value={100000}>100.000 orang</option>
            </select>
          </div>
          <div>
            <label>Gate masuk (in)</label>
            <select value={gateIn} onChange={(e) => setGateIn(Number(e.target.value))}>
              <option value={2}>2 gate</option><option value={4}>4 gate</option>
              <option value={6}>6 gate — default v19</option><option value={8}>8 gate</option>
            </select>
          </div>
          <div>
            <label>Gate keluar (out)</label>
            <select value={gateOut} onChange={(e) => setGateOut(Number(e.target.value))}>
              <option value={2}>2 gate</option><option value={4}>4 gate</option>
              <option value={6}>6 gate — default v19</option><option value={8}>8 gate</option>
            </select>
          </div>
        </div>
      </div>
      <div className="wi-compare" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="lb">Baseline (prediksi model asli)</div>
          <div className="vl" style={{ fontSize: 24, fontWeight: 800 }}>{fmt(base)}</div>
          <Badge lvl={lvlBase} />
        </div>
        <div className="card">
          <div className="lb">Dengan skenario</div>
          <div className="vl" style={{ fontSize: 24, fontWeight: 800 }}>{fmt(demand)}</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Badge lvl={lvlNew} />
            <span className={`wi-chg ${chg >= 0 ? 'up' : 'down'}`}>{chg >= 0 ? '+' : ''}{chg}%</span>
          </div>
        </div>
        <div className="card">
          <div className="lb">Kapasitas gate (skenario)</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
            <span style={{ fontSize: 12.5 }}>Gate-in: {gateIn} gate = {fmt(capIn)} org/15 mnt · utilisasi {Math.round(demand / capIn * 100)}%</span>
            <Badge lvl={lvlNew} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 12.5 }}>Gate-out: {gateOut} gate = {fmt(capOut)} org/15 mnt · utilisasi {Math.round(demandOut / capOut * 100)}%</span>
            <Badge lvl={lvlOutNew} />
          </div>
          <div className="note" style={{ marginTop: 8 }}>
            Default 6 in / 6 out (asumsi v19, 20 tap/mnt per gate). Kurangi gate-in untuk simulasi gate-flip saat bubaran; tambah gate untuk melihat antrean terurai.
          </div>
        </div>
      </div>
      <div className="note" style={{ marginTop: 16 }}>
        Estimasi cepat sisi client — baseline prediksi model v19. Level gate = utilisasi kapasitas gate per 15 mnt (ambang 45% / 65% / 80%).
        Perhitungan model penuh (re-run XGBoost per skenario) ada di notebook (prediksi_whatif).
      </div>
    </div>
  )
}

/* ================= Recommendation (playbook) ================= */
const PLAYBOOK = [
  ['LOW', 'b-low', 'Kepadatan < ambang aman', [
    ['Pantauan rutin dari control room', 'Petugas monitoring'],
    ['Tidak perlu aksi lapangan', '—'],
  ]],
  ['MEDIUM', 'b-medium', 'Kepadatan mendekati ambang waspada', [
    ['Tambah frekuensi pengamatan CCTV area gate & peron', 'Petugas monitoring'],
    ['Siapkan pengumuman preventif', 'Petugas stasiun'],
  ]],
  ['HIGH', 'b-high', 'Antrean terbentuk di gate atau peron', [
    ['Kerahkan staf tambahan ke titik antrean', 'Kepala stasiun'],
    ['Aktifkan pengumuman & signage alur penumpang', 'Petugas stasiun'],
    ['Cek eskalator, gate, dan alur peron', 'Petugas teknik'],
  ]],
  ['CRITICAL', 'b-critical', 'Kepadatan melebihi ambang aman (Fruin)', [
    ['Metering: buka-tutup gate masuk secara berkala', 'Kepala stasiun'],
    ['Alihkan arus penumpang ke jalur alternatif', 'Petugas keamanan'],
    ['Koordinasi dengan control room untuk penyesuaian headway', 'Control room'],
  ]],
]

export function RecommendationPage({ data, dateIdx, bucket, hb, horizonMin, sel, riskNow, events }) {
  const horizonStr = b2str(hb)
  const dateStr = data ? data.dates[dateIdx] : ''
  const info = riskNow ? riskNow.find((r) => r.st === sel) : null
  const evs = events ? eventsOn(events, dateStr) : []
  const grounding = data && info ? [
    `Tanggal replay: ${dateStr}, jam now: ${b2str(bucket)}, horizon: ${horizonStr} (${horizonMin} mnt)`,
    `Stasiun terpilih: ${sel} — level ${RISKS[info.lvl].label.toUpperCase()}, hotspot ${info.hotspot || '-'}, demand forecast ${fmt(info.demand)} pax, kepadatan ${info.score} org/m2`,
    `Event hari ini: ${evs.length ? evs.map((e) => `${e.name} (${e.start}–${e.end}, ~${fmt(e.attendance)})`).join('; ') : 'tidak ada'}`,
    `Total hujan hari ini: ${dailyRain(data, dateIdx).toFixed(1)} mm`,
    'Playbook: LOW=pantau rutin; MEDIUM=CCTV + pengumuman preventif; HIGH=staf tambahan ke titik antrean + signage; CRITICAL=metering gate + alihkan arus + koordinasi headway.',
  ].join('\n') : ''
  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <h2>Recommendation</h2>
          <div className="sub">Playbook respons per level risiko — selaras bab mitigasi laporan ForeSight</div>
        </div>
      </div>
      {data && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h3>Briefing AI untuk operator <span style={{ fontWeight: 500, color: '#6b7280' }}>({short(sel)}, {horizonStr})</span></h3>
          <div className="csub" style={{ marginBottom: 8 }}>
            Analyzer on-demand — narasi disusun dari angka dashboard saat tombol ditekan; tanpa AI, dashboard tetap berfungsi penuh.
          </div>
          <AiBox konteks="Susun briefing singkat pra-siaga untuk kepala stasiun: situasi, lokasi titik bahaya, dan 2-3 aksi prioritas dari playbook."
            grounding={grounding} buttonLabel="📝 Generate Briefing AI" />
        </div>
      )}
      {PLAYBOOK.map(([lvl, cls, trigger, actions]) => (
        <div className="card" key={lvl} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span className={`badge ${cls}`}>{lvl}</span>
            <span style={{ fontSize: 12.5, color: '#6b7280' }}>Trigger: {trigger}</span>
          </div>
          <table className="tbl">
            <thead><tr><th>Aksi</th><th>PIC</th></tr></thead>
            <tbody>
              {actions.map(([a, pic]) => (
                <tr key={a}><td>{a}</td><td style={{ color: '#6b7280' }}>{pic}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

/* ================= Performance ================= */
function ConvergencePanel({ data }) {
  const defSt = 'Bundaran HI Bank Jakarta'
  const defDi = data.dates.indexOf('2026-06-27')
  const [st, setSt] = useState(defSt)
  const [tb, setTb] = useState(64) // 21:00
  const [di, setDi] = useState(defDi >= 0 ? defDi : 0)
  const targetRow = rowAt(data, st, di, tb)
  const actual = targetRow ? targetRow[2] : null
  const rows = []
  for (let k = 4; k >= 1; k--) {
    const issueB = tb - k
    const issue = issueB >= 0 ? rowAt(data, st, di, issueB) : null
    if (!issue || issue[2 + k] == null) continue
    rows.push({
      issuedAt: b2str(issueB), horizon: k * 15,
      pred: issue[2 + k],
      lo: issue[18 + k - 1], up: issue[22 + k - 1],
      err: actual != null ? issue[2 + k] - actual : null,
    })
  }
  const maxV = Math.max(actual || 0, ...rows.map((r) => r.pred), 1)
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>Konvergensi forecast — semua penerbitan untuk satu target waktu</h3>
      <div className="csub" style={{ marginBottom: 10 }}>
        Bukti "tebakan mengejar realita": makin dekat penerbitan, prediksi (dan range conformal) makin rapat ke aktual.
      </div>
      <div className="selrow" style={{ marginBottom: 10 }}>
        <label>Station</label>
        <select className="stselect" value={st} onChange={(e) => setSt(e.target.value)}>
          {data.stations.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label style={{ marginLeft: 12 }}>Tanggal</label>
        <select className="stselect" value={di} onChange={(e) => setDi(Number(e.target.value))}>
          {data.dates.map((d, i) => <option key={d} value={i}>{d}</option>)}
        </select>
        <label style={{ marginLeft: 12 }}>Target</label>
        <select className="stselect" value={tb} onChange={(e) => setTb(Number(e.target.value))}>
          {Array.from({ length: 72 }, (_, b) => <option key={b} value={b}>{b2str(b)}</option>)}
        </select>
      </div>
      <table className="tbl">
        <thead>
          <tr><th>Diterbitkan</th><th>Horizon</th><th>Prediksi</th><th>Range conformal</th><th>Error vs aktual</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.issuedAt}>
              <td>{r.issuedAt}</td>
              <td>t+{r.horizon} mnt</td>
              <td className="num">{fmt(r.pred)}</td>
              <td className="num" style={{ color: '#6b7280' }}>{r.lo != null ? `${fmt(r.lo)}–${fmt(r.up)}` : '—'}</td>
              <td className="num" style={{ color: r.err != null && r.err < 0 ? '#d93025' : '#188038' }}>
                {r.err != null ? `${r.err >= 0 ? '+' : ''}${fmt(r.err)}` : '—'}
              </td>
              <td style={{ width: '34%' }}>
                <div className="conv-track"><div className="conv-bar" style={{ width: `${(r.pred / maxV) * 100}%` }} /></div>
              </td>
            </tr>
          ))}
          {actual != null && (
            <tr>
              <td colSpan={2}><b>Aktual</b></td>
              <td className="num"><b>{fmt(actual)}</b></td>
              <td>—</td><td>—</td>
              <td><div className="conv-track"><div className="conv-bar act" style={{ width: `${(actual / maxV) * 100}%` }} /></div></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export function PerformancePage({ data }) {
  const perf = useMemo(() => {
    const per = []
    for (const st of data.stations) {
      const rows = data.rows[st]
      let mae = 0, mape = 0, w = 0, nm = 0, nw = 0, cnt = 0, ncnt = 0
      for (let d = 0; d < data.dates.length; d++) {
        for (let b = 0; b < 76; b++) {
          const r = rows[d * 76 + b]
          if (!r || r[2] == null || r[2] <= 0) continue
          const a = r[2]
          const pv = b > 0 ? rows[d * 76 + b - 1] : null
          if (pv && pv[3] != null) {
            const e = Math.abs(a - pv[3])
            mae += e; mape += e / a; w += e / a <= 0.1 ? 1 : 0; cnt++
          }
          if (b >= 4) {
            const rn = rows[d * 76 + b - 4]
            if (rn && rn[2] != null) {
              const ne = Math.abs(a - rn[2])
              nm += ne; nw += ne / a <= 0.1 ? 1 : 0; ncnt++
            }
          }
        }
      }
      per.push({ st, mae: mae / cnt, mape: (mape / cnt) * 100, w: (w / cnt) * 100, nmae: nm / ncnt, nw: (nw / ncnt) * 100 })
    }
    const avg = (k) => per.reduce((s, p) => s + p[k], 0) / per.length
    return { per, avgMae: avg('mae'), avgW: avg('w'), avgNmae: avg('nmae'), avgNw: avg('nw') }
  }, [data])

  const improv = (1 - perf.avgMae / perf.avgNmae) * 100
  const barW = (v, max) => `${Math.max(2, (v / max) * 100)}%`
  const maxMae = Math.max(perf.avgMae, perf.avgNmae)

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <h2>Performance</h2>
          <div className="sub">Rapor model vs baseline naive (penumpang 1 jam lalu) — data asli notebook v17.1, periode uji Apr–Jun</div>
        </div>
      </div>
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="card">
          <div className="lb">Rata-rata MAE — Model</div>
          <div className="perfbar-wrap"><div className="perfbar" style={{ width: barW(perf.avgMae, maxMae), background: '#1a73e8' }} /></div>
          <div className="vl" style={{ fontSize: 22, fontWeight: 800 }}>{fmt(perf.avgMae)}</div>
        </div>
        <div className="card">
          <div className="lb">Rata-rata MAE — Naive baseline</div>
          <div className="perfbar-wrap"><div className="perfbar" style={{ width: barW(perf.avgNmae, maxMae), background: '#9aa0a6' }} /></div>
          <div className="vl" style={{ fontSize: 22, fontWeight: 800 }}>{fmt(perf.avgNmae)}</div>
        </div>
        <div className="card">
          <div className="lb">Peningkatan model vs baseline</div>
          <div className="vl" style={{ fontSize: 22, fontWeight: 800, color: '#188038' }}>{improv.toFixed(0)}% lebih akurat</div>
          <div className="lb">within-10%: model {perf.avgW.toFixed(0)}% vs naive {perf.avgNw.toFixed(0)}%</div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Metrik per stasiun (horizon 15 menit, prediksi diterbitkan 15 mnt sebelumnya vs aktual)</h3>
        <table className="tbl">
          <thead>
            <tr><th>Station</th><th>MAE (model)</th><th>MAE (naive)</th><th>MAPE (model)</th><th>Within 10% (model)</th></tr>
          </thead>
          <tbody>
            {perf.per.map((p) => (
              <tr key={p.st}>
                <td><b>{short(p.st)}</b></td>
                <td className="num">{fmt(p.mae)}</td>
                <td className="num" style={{ color: '#9aa0a6' }}>{fmt(p.nmae)}</td>
                <td className="num">{p.mape.toFixed(1)}%</td>
                <td className="num">{p.w.toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="note" style={{ marginTop: 12 }}>
          Dihitung ulang di browser dari data asli (85.176 bucket × 13 stasiun). Angka evaluasi resmi —
          walk-forward 4 fold, evaluasi berbasis kejadian, lead time, sweep ambang — ada di metrics CSV hasil notebook v17.1.
        </div>
      </div>
      <ConvergencePanel data={data} />
    </div>
  )
}

/* ================= Reports (v4: aktif) ================= */
export function ReportsPage({ data, dateIdx, events, horizonStr, horizonMin, onOpenEventModal }) {
  const dateStr = data.dates[dateIdx]
  const rep = useMemo(() => {
    let totalIn = 0, totalOut = 0
    const momen = []
    let peak = { v: -1, b: 0 }
    for (let b = 0; b <= B_LAST; b++) {
      let net = 0
      for (const st of data.stations) {
        const r = rowAt(data, st, dateIdx, b)
        if (!r) continue
        if (r[2] != null) { totalIn += r[2]; net += r[2] }
        if (r[26] != null) totalOut += r[26]   // v18: tap-out aktual ikut diekspor
        if (r[8] >= 1) momen.push({ st, b, lvl: r[8], dens: r[9] != null ? r[9] : 0, hot: r[13], dem: r[2] })
      }
      if (net > peak.v) peak = { v: net, b }
    }
    momen.sort((a, z) => z.lvl - a.lvl || z.dens - a.dens)
    return { totalIn, totalOut, peak, momen: momen.slice(0, 12), nRisk: momen.length }
  }, [data, dateIdx])
  const evs = eventsOn(events, dateStr)

  const unduh = () => {
    const payload = {
      tanggal: dateStr,
      model: data.meta ? data.meta.model_version : 'v18',
      ringkasan: {
        total_tap_in_aktual: Math.round(rep.totalIn),
        total_tap_out_aktual: Math.round(rep.totalOut),
        jam_puncak_jaringan: b2str(rep.peak.b),
        volume_puncak_per_15mnt: Math.round(rep.peak.v),
        momen_berisiko_ge_medium: rep.nRisk,
      },
      momen_risiko_tertinggi: rep.momen.map((m) => ({
        waktu: b2str(m.b), stasiun: m.st, level: RISKS[m.lvl].label.toUpperCase(),
        kepadatan_org_m2: m.dens, hotspot: HOTSPOTS[m.hot] || null, tap_in_aktual: m.dem,
      })),
      event_hari_ini: evs.map((e) => `${e.name} (${e.start}-${e.end})`),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `foresight_report_${dateStr}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <h2>Reports — Laporan Harian</h2>
          <div className="sub">Ringkasan operasional {fmtDate(dateStr)} — ganti tanggal lewat pemilih di topbar</div>
        </div>
        <div className="rep-actions">
          <button className="btn" onClick={unduh} data-tip="Unduh ringkasan hari ini sebagai file JSON">⬇ Unduh JSON</button>
          <button className="btn primary" onClick={() => window.print()} data-tip="Cetak atau simpan sebagai PDF">🖨 Cetak / PDF</button>
        </div>
      </div>
      <div className="kpis" style={{ marginBottom: 16 }}>
        <div className="card"><div className="lb">Total tap-in (aktual)</div>
          <div className="vl" style={{ fontSize: 22 }}>{fmt(rep.totalIn)}</div></div>
        <div className="card"><div className="lb">Total tap-out (aktual)</div>
          <div className="vl" style={{ fontSize: 22 }}>{fmt(rep.totalOut)}</div></div>
        <div className="card"><div className="lb">Puncak jaringan</div>
          <div className="vl" style={{ fontSize: 22 }}>{b2str(rep.peak.b)}</div>
          <div className="lb">{fmt(rep.peak.v)} pax/15 mnt</div></div>
        <div className="card"><div className="lb">Momen berisiko (≥ Medium)</div>
          <div className="vl" style={{ fontSize: 22 }}>{rep.nRisk}</div>
          <div className="lb">bucket 15 menit, seluruh stasiun</div></div>
      </div>
      {evs.length > 0 && (
        <div className="ctxbar card">
          <span
            className="ctx-item clickable-ev"
            onClick={onOpenEventModal}
            data-tip="Klik untuk buka Panel Event Hari Ini & Jadwal Koridor MRT"
          >
            📅 Event hari ini:
          </span>
          {evs.map((e) => (
            <span
              key={e.name}
              className="ctx-badge clickable-ev"
              onClick={onOpenEventModal}
              data-tip={`${e.basis || e.name} — Klik untuk lihat di Panel Event`}
            >
              {e.name} · {e.start}–{e.end}
            </span>
          ))}
          <button className="btn-ev-panel" onClick={onOpenEventModal}>
            📅 Panel Event →
          </button>
        </div>
      )}
      <div className="card">
        <h3>Momen risiko tertinggi hari ini</h3>
        {rep.momen.length === 0 ? (
          <div className="note" style={{ marginTop: 10 }}>
            Tidak ada momen ≥ Medium pada {fmtDate(dateStr)} — operasi diprediksi berjalan normal.
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr><th>Waktu</th><th>Stasiun</th><th>Level</th><th>Kepadatan (org/m²)</th><th>Hotspot</th><th>Tap-in aktual</th></tr>
            </thead>
            <tbody>
              {rep.momen.map((m, i) => (
                <tr key={i}>
                  <td>{b2str(m.b)}</td>
                  <td><b>{short(m.st)}</b></td>
                  <td><Badge lvl={m.lvl} /></td>
                  <td className="num">{m.dens.toFixed(2)}</td>
                  <td style={{ color: '#6b7280' }}>{HOTSPOTS[m.hot] || '—'}</td>
                  <td className="num">{fmt(m.dem)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="note" style={{ marginTop: 14 }}>
        Laporan dihitung ulang di browser dari data dashboard (model v18, evaluasi out-of-time Apr–Jun).
        Horizon replay saat ini {horizonStr} ({horizonMin} mnt ke depan).
      </div>
    </div>
  )
}

/* ================= Settings (v4: aktif, tersimpan di browser) ================= */
function SetRow({ t, d, k, settings, setSetting }) {
  return (
    <div className="set-row">
      <div>
        <div className="t">{t}</div>
        <div className="d">{d}</div>
      </div>
      <input type="checkbox" className="switch" checked={!!settings[k]}
        onChange={(e) => setSetting(k, e.target.checked)} aria-label={t} />
    </div>
  )
}

export function SettingsPage({ settings, setSetting, onReset }) {
  const [apiKeyInput, setApiKeyInput] = useState(() => {
    return typeof window !== 'undefined' ? (localStorage.getItem('foresight_openrouter_api_key') || '') : ''
  })
  const [keySaved, setKeySaved] = useState(false)
  const [testState, setTestState] = useState({ status: 'idle', msg: '' })

  const handleSaveKey = () => {
    setOpenRouterKey(apiKeyInput)
    setKeySaved(true)
    setTimeout(() => setKeySaved(false), 2500)
  }

  const handleResetKey = () => {
    setApiKeyInput('')
    setOpenRouterKey('')
    setKeySaved(true)
    setTimeout(() => setKeySaved(false), 2500)
  }

  const handleTest = async () => {
    setTestState({ status: 'loading', msg: 'Menguji koneksi ke OpenRouter...' })
    try {
      const res = await testAIConnection()
      setTestState({ status: 'success', msg: `Koneksi Berhasil! (${res})` })
    } catch (err) {
      setTestState({ status: 'error', msg: `Koneksi Gagal: ${err.message || String(err)}` })
    }
  }

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <h2>Settings</h2>
          <div className="sub">Preferensi tampilan & konfigurasi AI — tersimpan otomatis di browser</div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 660, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>🤖 AI Analyzer Engine</h3>
          <span style={{ fontSize: 11, background: '#e0f2fe', color: '#0369a1', padding: '3px 9px', borderRadius: 12, fontWeight: 700 }}>
            OpenRouter API
          </span>
        </div>
        <div className="set-row">
          <div>
            <div className="t">Model AI Aktif</div>
            <div className="d">Model LLM berkecepatan tinggi dengan grounding data ketat</div>
          </div>
          <code style={{ fontSize: 12, background: '#f1f5f9', padding: '4px 8px', borderRadius: 6, fontWeight: 600, color: '#1e293b' }}>
            {MODEL}
          </code>
        </div>
        <div className="set-row" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: 1, marginRight: 16 }}>
            <div className="t">API Key (OpenRouter)</div>
            <div className="d">API Key bawaan telah aktif. Anda dapat memasukkan key kustom di sini jika diinginkan.</div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <input
                type="password"
                className="stselect"
                style={{ flex: 1, padding: '6px 10px', fontSize: 12 }}
                placeholder="sk-or-v1-... (Kosongkan untuk pakai key bawaan)"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
              />
              <button className="btn" onClick={handleSaveKey} style={{ padding: '6px 12px', fontSize: 12 }}>
                Simpan
              </button>
              {apiKeyInput && (
                <button className="btn" onClick={handleResetKey} style={{ padding: '6px 10px', fontSize: 12 }} title="Reset ke key bawaan">
                  ↺
                </button>
              )}
            </div>
            {keySaved && <div style={{ fontSize: 11, color: '#16a34a', marginTop: 4, fontWeight: 600 }}>✓ Pengaturan API Key disimpan!</div>}
          </div>
        </div>
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <button
            className="ai-btn"
            style={{ padding: '7px 14px', fontSize: 12 }}
            onClick={handleTest}
            disabled={testState.status === 'loading'}
          >
            {testState.status === 'loading' ? '⏳ Menguji Koneksi…' : '⚡ Tes Koneksi AI'}
          </button>
          {testState.status === 'success' && (
            <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✓ {testState.msg}</span>
          )}
          {testState.status === 'error' && (
            <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>✗ {testState.msg}</span>
          )}
        </div>
      </div>
      <div className="card" style={{ maxWidth: 660 }}>
        <h3>Antarmuka</h3>
        <SetRow t="Animasi antarmuka" d="Transisi halus (fade/swipe) saat berpindah halaman"
          k="anim" settings={settings} setSetting={setSetting} />
        <SetRow t="Tooltip bantuan" d="Penjelasan singkat saat kursor melayang di atas kontrol — membantu operator baru"
          k="tips" settings={settings} setSetting={setSetting} />
        <SetRow t="Label hujan ramah operator" d="Tampilkan 'Hujan ringan · 3,1 mm' alih-alih hanya angka mm"
          k="rainLabel" settings={settings} setSetting={setSetting} />
      </div>
      <div className="card" style={{ maxWidth: 660, marginTop: 16 }}>
        <h3>Default replay</h3>
        <div className="set-row">
          <div>
            <div className="t">Horizon default</div>
            <div className="d">Jendela forecast saat dashboard pertama dibuka</div>
          </div>
          <select className="stselect" value={settings.defHorizon}
            onChange={(e) => setSetting('defHorizon', Number(e.target.value))}>
            <option value={30}>30 menit</option>
            <option value={60}>1 jam</option>
          </select>
        </div>
        <div className="set-row">
          <div>
            <div className="t">Kecepatan replay default</div>
            <div className="d">Kecepatan awal tombol putar</div>
          </div>
          <select className="stselect" value={settings.defSpeed}
            onChange={(e) => setSetting('defSpeed', Number(e.target.value))}>
            <option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option>
          </select>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <button className="btn" onClick={onReset}>↺ Reset ke default</button>
      </div>
      <div className="note" style={{ marginTop: 14, maxWidth: 660 }}>
        Horizon & kecepatan default berlaku saat dashboard dibuka ulang; preferensi lain berlaku seketika.
        Sidebar dapat dilipat lewat tombol chevron di kiri bawah — pilihan itu juga tersimpan.
      </div>
    </div>
  )
}
