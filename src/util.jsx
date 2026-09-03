import React from 'react'

/* ---------- waktu & format ---------- */
export const B0 = 300 // 05:00 dalam menit
export const b2min = (b) => B0 + b * 15
export const min2str = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
export const b2str = (b) => min2str(b2min(b))
export const fmt = (n) => Math.round(n).toLocaleString('en-US')
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const fmtDate = (iso) => {
  const [y, m, d] = iso.split('-')
  return `${parseInt(d, 10)} ${MONTHS[parseInt(m, 10) - 1]} ${y}`
}

/* ---------- stasiun ---------- */
export const SHORT = {
  'Lebak Bulus BSI': 'Lebak Bulus',
  'Fatmawati Indomaret': 'Fatmawati',
  'Cipete Raya TUKU': 'Cipete Raya',
  'Haji Nawi': 'Haji Nawi',
  'Blok A': 'Blok A',
  'Blok M BCA': 'Blok M',
  ASEAN: 'ASEAN',
  Senayan: 'Senayan',
  'Istora Mandiri': 'Istora',
  'Bendungan Hilir': 'Bendungan Hilir',
  'Setiabudi Astra': 'Setiabudi Astra',
  'Dukuh Atas BNI': 'Dukuh Atas',
  'Bundaran HI Bank Jakarta': 'Bundaran HI',
}
export const short = (s) => SHORT[s] || s
export const STATION_ORDER = Object.keys(SHORT)
export const sortStations = (list) => {
  if (!list) return list
  const orderMap = new Map(STATION_ORDER.map((st, i) => [st, i]))
  return [...list].sort((a, b) => (orderMap.has(a) ? orderMap.get(a) : 99) - (orderMap.has(b) ? orderMap.get(b) : 99))
}

/* ---------- risiko ---------- */
export const RISKS = [
  { label: 'Low', color: '#188038', cls: 'b-low' },
  { label: 'Medium', color: '#b26a00', cls: 'b-medium' },
  { label: 'High', color: '#d93025', cls: 'b-high' },
  { label: 'Critical', color: '#a50e0e', cls: 'b-critical' },
]
export const riskOf = (score) => (score < 0.45 ? 0 : score < 0.65 ? 1 : score < 0.8 ? 2 : 3)
export const Badge = ({ lvl }) => <span className={`badge ${RISKS[lvl].cls}`}>{RISKS[lvl].label.toUpperCase()}</span>
export const HOTSPOTS = ['gate-in', 'peron', 'gate-out']

/* ---------- titik antrean (CRS 3 titik) ---------- */
export const TITIK = [
  { id: 'gate_in', label: 'Gate-in', col: 10 },
  { id: 'peron', label: 'Peron', col: 11 },
  { id: 'gate_out', label: 'Gate-out', col: 12 },
]
export const AREA_TITIK_M2 = 800 // area antre efektif (VERIFIKASI MRT)
export const LAJU_GATE_BUCKET = 5 * 20 * 15 // 5 gate x 20 org/mnt x 15 mnt (ujung konservatif rilis MRT)
export const SLOT_KERETA = 1950 * 0.20 // kapasitas resmi 1.950 x FRAKSI_NAIK (VERIFIKASI MRT)
export const FRUIN_BINS = [0.83, 1.54, 3.57] // SEDANG / TINGGI / KRITIS (Fruin 1971)
export const lvlFromDens = (d) => (d < 0.83 ? 0 : d < 1.54 ? 1 : d < 3.57 ? 2 : 3)
export const densTitik = (row, k) => (row ? row[TITIK[k].col] / AREA_TITIK_M2 : 0)
export const lajuTitik = (row, k) => (k === 1 ? (row ? row[16] * SLOT_KERETA : 0) : LAJU_GATE_BUCKET)
export const waitTitik = (row, k) => {
  if (!row) return 0
  const laju = lajuTitik(row, k)
  return laju > 0 ? (row[TITIK[k].col] / laju) * 15 : 0
}

/* ---------- indeks baris cepat ---------- */
// Layout baris (adapter v17.1):
// [0 hari, 1 bucket, 2 aktual, 3-6 p1..p4, 7 q90_t+1, 8 riskLvl, 9 density,
//  10 q_in, 11 q_peron, 12 q_out, 13 hotspot, 14 rain, 15 eventAtt, 16 trains, 17 lag532,
//  18-21 lower_t+1..4, 22-25 upper_t+1..4]
// Bucket 72-75 (23:00-23:45) = null (ekspor berhenti 22:45).
export const rowAt = (data, st, d, b) => {
  const rows = data.rows[st]
  const i = d * 76 + b
  return rows && i >= 0 && i < rows.length ? rows[i] : undefined
}

// Prediksi yang DITERBITKAN pada bucket `bucket` untuk horizon ke-h (1..4)
export const forecastFor = (data, st, d, bucket, h) => {
  const issue = rowAt(data, st, d, bucket)
  const v = issue ? issue[2 + h] : null
  return v != null ? v : 0
}
// Pita conformal untuk horizon ke-h yang diterbitkan di `bucket`: [lower, upper]
export const bandFor = (data, st, d, bucket, h) => {
  const issue = rowAt(data, st, d, bucket)
  if (!issue) return [null, null]
  return [issue[18 + h - 1], issue[22 + h - 1]]
}

// Risiko per stasiun: demand = forecast yang diterbitkan di `bucket` untuk `hb`;
// level & kepadatan = CRS prediksi (lapisan peringatan) pada bucket `hb`.
export function riskAt(data, dateIdx, bucket, hb) {
  const h = Math.max(hb - bucket, 1)
  return data.stations.map((st) => {
    const target = rowAt(data, st, dateIdx, hb)
    return {
      st,
      demand: forecastFor(data, st, dateIdx, bucket, h),
      score: target ? target[9] : 0,
      lvl: target ? target[8] : 0,
      hotspot: target ? HOTSPOTS[target[13]] : null,
    }
  })
}

/* ---------- typical day & faktor why ---------- */
export function typicalOf(data, st) {
  if (!data._typ) data._typ = {}
  if (data._typ[st]) return data._typ[st]
  const all = data.rows[st]
  const sum = new Array(76).fill(0)
  const cnt = new Array(76).fill(0)
  let actSum = 0, actCnt = 0, trSum = 0, trCnt = 0
  for (let i = 0; i < all.length; i++) {
    const r = all[i]
    if (!r) continue
    const b = i % 76
    if (r[2] != null) { sum[b] += r[2]; cnt[b]++; actSum += r[2]; actCnt++ }
    if (r[16] != null && r[16] > 0) { trSum += r[16]; trCnt++ }
  }
  const res = {
    typ: sum.map((s, b) => (cnt[b] ? s / cnt[b] : 0)),
    meanAll: actCnt ? actSum / actCnt : 0,
    meanTrains: trCnt ? trSum / trCnt : 0,
  }
  data._typ[st] = res
  return res
}

export function whyOf(data, st, dateIdx, bucket, hb) {
  const t = typicalOf(data, st)
  const target = rowAt(data, st, dateIdx, hb)
  const h = Math.max(hb - bucket, 1)
  const issue = rowAt(data, st, dateIdx, bucket)
  if (!issue && !target) return null
  const demand = issue && issue[2 + h] != null ? issue[2 + h] : null
  const typB = t.typ[hb] || 0
  const hist = demand != null && typB > 0.5 ? Math.round(((demand - typB) / typB) * 100) : 0
  const peak = t.meanAll > 0 ? Math.round(((typB - t.meanAll) / t.meanAll) * 100) : 0
  const trains = target ? target[16] : null
  const headway = t.meanTrains > 0 && trains != null
    ? Math.round(((t.meanTrains - trains) / t.meanTrains) * 100)
    : 0
  const rain = target ? target[14] : 0
  const rainV = rain ? Math.round(Math.min(rain, 20) * 0.5) : 0
  const ev = target ? target[15] : 0
  const evV = ev ? Math.min(40, Math.round(ev / 2500)) : 0
  return [hist, peak, headway, rainV, evV]
}

/* ---------- konteks tanggal: event & hujan ---------- */
export function eventsOn(events, dateStr) {
  if (!events) return []
  return events.filter((e) => e.date <= dateStr && dateStr <= (e.end_date || e.date))
}

// Hujan harian: satu grid cuaca untuk seluruh jaringan -> ambil dari stasiun pertama
export function dailyRain(data, dateIdx) {
  const rows = data.rows[data.stations[0]]
  let total = 0
  for (let b = 0; b < 76; b++) {
    const r = rows[dateIdx * 76 + b]
    if (r && r[14] != null) total += r[14] / 4
  }
  return total
}
export function rainAt(data, dateIdx, b) {
  const r = rowAt(data, data.stations[0], dateIdx, b)
  return r && r[14] != null ? r[14] : 0
}

/* ---------- ikon ---------- */
export const NAV_PATHS = {
  Overview: 'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5',
  'Risk Monitor': 'M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z',
  Prediction: 'M4 19V5m0 14h16M7 15l4-5 3 3 5-7',
  'Why (Explain)': 'M12 17h.01M9.5 9a2.5 2.5 0 1 1 3.4 2.3c-.8.4-.9 1-.9 1.7M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  'What-if Simulator': 'M6 4v5a3 3 0 0 0 3 3h9m0 0-3-3m3 3-3 3M18 20v-5a3 3 0 0 0-3-3H6m0 0 3-3m-3 3 3 3',
  Recommendation: 'M9 18h6m-5 3h4M12 3a6 6 0 0 0-4 10.5c.8.7 1 1.5 1 2.5h6c0-1 .2-1.8 1-2.5A6 6 0 0 0 12 3z',
  Performance: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 12V7m8.5 11a10 10 0 1 0-17 0',
  Reports: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5m-5 4h5',
  Settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 12a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.4 7.4 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.5 7.5 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.4 7.4 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.06-.4.1-.8.1-1.2z',
}
export const Icon = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)
export const Transport = ({ kind }) => {
  const paths = {
    prev: 'M6 5h2.5v14H6zM20 5v14L9.5 12z',
    next: 'M15.5 5H18v14h-2.5zM4 5v14l10.5-7z',
    play: 'M7 4l13 8-13 8z',
    pause: 'M6 4h4v16H6zM14 4h4v16H14z',
  }

  const s = kind === 'play' || kind === 'pause' ? 17 : 15
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d={paths[kind]} /></svg>
}

/* ---------- v4: batas data & label hujan ramah operator ---------- */
export const B_LAST = 75 // v19.1: ekspor diperpanjang — bucket terakhir 75 = 23:45 (jendela s.d. 00:00)

// Curah hujan dibungkus label yang dipahami operator awam; angka mm tetap disertakan.
export function rainLabel(mm) {
  if (!mm || mm <= 0) return { icon: '☀', label: 'Kering' }
  if (mm < 0.5) return { icon: '🌦', label: 'Gerimis' }
  if (mm < 5) return { icon: '🌧', label: 'Hujan ringan' }
  if (mm <= 10) return { icon: '🌧', label: 'Hujan sedang' }
  return { icon: '⛈', label: 'Hujan lebat' }
}

export function rainText(nowRain, totalRain) {
  const fmtMm = (v) => v.toFixed(1).replace('.', ',')
  if (totalRain === undefined) {
    const mm = nowRain || 0
    const r = rainLabel(mm)
    if (mm <= 0) return `${r.icon} ${r.label}`
    return `${r.icon} ${r.label} · ${fmtMm(mm)} mm`
  }
  const now = nowRain || 0
  const total = totalRain || 0
  if (total <= 0) {
    return '☀ Kering'
  }
  if (now > 0) {
    const r = rainLabel(now)
    return `${r.icon} ${r.label} · ${fmtMm(now)} mm/jam · total hari ini ${fmtMm(total)} mm`
  }
  return `☀ Kering sekarang · hujan ${fmtMm(total)} mm hari ini`
}

export const RAIN_TIP =
  'Angka mm/jam mengikuti waktu aktif slider. Total harian adalah akumulasi 24 jam. BMKG per jam: <0,5 mm gerimis, 0,5–5 mm ringan, 5–10 mm sedang, >10 mm lebat.'

export const NOWCAST_TIP =
  'Gate-out memakai data tap-out AKTUAL yang terbaca saat ini (nowcasting) — standar operasi — bukan prediksi, karena antrean keluar bersifat impulsif dan lebih akurat dibaca langsung.'

export const ARUS_TIP =
  'Kami memprediksi dua arah karena kerumunan punya dua pintu. Tap-in tinggi = siaga di gate masuk & peron. Tap-out tinggi = siaga di gate keluar. Arus balik malam event: orang tap-in di stasiun venue, lalu ±30 menit kemudian tap-out di stasiun tujuan (Lebak Bulus, Blok M, ASEAN, Dukuh Atas).'

export const QUEUE_TIP =
  'Kapasitas layanan per 15 menit: gate ±1.500 orang (5 gate x 20 org/mnt), peron ±390 slot per kereta. Antrean terbentuk hanya saat demand melewati angka itu — mis. malam promo Rp1 atau bubaran konser. Angka tunggu = antrean / kapasitas x 15 menit (Hukum Little).'

/* ---------- garis stasiun (dipakai Overview & Risk Monitor) ---------- */
export function StationLine({ data, riskNow, sel, onSelect }) {
  return (
    <div className="mapscroll">
      <div className="mapline">
        <div className="track" />
        <div className="mapcols">
          {data.stations.map((st, i) => {
            const info = riskNow[i]
            return (
              <div key={st} className={`stcol ${sel === st ? 'sel' : ''}`} onClick={() => onSelect && onSelect(st)}>
                <div className="dotwrap">
                  <div className="dot" style={{ background: RISKS[info.lvl].color }} title={st} />
                </div>
                <div className="nm">{short(st)}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
