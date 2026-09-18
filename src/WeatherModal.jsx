import React, { useMemo } from 'react'
import { fmtDate, b2str, rainAt, dailyRain, rainLabel, B_LAST } from './util.jsx'

/**
 * WeatherModal — Panel detail cuaca harian.
 * Menampilkan profil hujan per 15 menit, ringkasan harian, dan
 * panduan kategori BMKG untuk operator stasiun.
 */
export default function WeatherModal({ isOpen, onClose, data, dateIdx, bucket }) {
  if (!isOpen) return null

  const dateStr = data.dates[dateIdx]
  const nowRain = rainAt(data, dateIdx, bucket)
  const totalRain = dailyRain(data, dateIdx)
  const nowLabel = rainLabel(nowRain)

  // Build hourly rain profile from bucket data
  const hourlyProfile = useMemo(() => {
    const hours = []
    for (let b = 0; b <= B_LAST; b++) {
      const mm = rainAt(data, dateIdx, b)
      hours.push({ bucket: b, time: b2str(b), mm })
    }
    return hours
  }, [data, dateIdx])

  // Peak rain
  const peakBucket = useMemo(() => {
    let max = { mm: 0, bucket: 0 }
    for (const h of hourlyProfile) {
      if (h.mm > max.mm) max = h
    }
    return max
  }, [hourlyProfile])

  // Rain periods (consecutive buckets with rain > 0)
  const rainPeriods = useMemo(() => {
    const periods = []
    let start = null
    for (let i = 0; i < hourlyProfile.length; i++) {
      const h = hourlyProfile[i]
      if (h.mm > 0 && start === null) {
        start = i
      } else if (h.mm <= 0 && start !== null) {
        periods.push({
          from: b2str(start),
          to: b2str(i),
          duration: (i - start) * 15,
          maxMm: Math.max(...hourlyProfile.slice(start, i).map((x) => x.mm)),
        })
        start = null
      }
    }
    if (start !== null) {
      periods.push({
        from: b2str(start),
        to: b2str(hourlyProfile.length - 1),
        duration: (hourlyProfile.length - start) * 15,
        maxMm: Math.max(...hourlyProfile.slice(start).map((x) => x.mm)),
      })
    }
    return periods
  }, [hourlyProfile])

  // Stats
  const totalBucketsWithRain = hourlyProfile.filter((h) => h.mm > 0).length
  const avgRain = totalBucketsWithRain > 0 ? totalRain / totalBucketsWithRain : 0

  // Bar chart max for scaling
  const maxBar = Math.max(peakBucket.mm, 1)

  const getBarColor = (mm) => {
    if (mm <= 0) return 'transparent'
    if (mm < 0.5) return '#93c5fd'     // gerimis — biru muda
    if (mm < 5) return '#3b82f6'       // ringan — biru
    if (mm <= 10) return '#f59e0b'     // sedang — amber
    return '#ef4444'                   // lebat — merah
  }

  const getBarLabel = (mm) => {
    return rainLabel(mm)
  }

  return (
    <div className="ev-modal-overlay" onClick={onClose}>
      <div className="ev-modal-card wx-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="wx-modal-head">
          <div>
            <div className="wx-modal-title">
              <span>{nowLabel.icon} Panel Cuaca Intelligence</span>
              <span className="ev-date-chip">{fmtDate(dateStr)}</span>
            </div>
            <div className="ev-modal-sub">
              Profil curah hujan harian koridor MRT Jakarta — data per 15 menit.
            </div>
          </div>
          <button className="ev-modal-close" onClick={onClose} title="Tutup panel">✕</button>
        </div>

        {/* Summary cards */}
        <div className="wx-summary">
          <div className="wx-sum-card">
            <div className="wx-sum-icon">{nowLabel.icon}</div>
            <div>
              <div className="wx-sum-label">Status Sekarang ({b2str(bucket)})</div>
              <div className="wx-sum-value">{nowLabel.label}</div>
              <div className="wx-sum-sub">{nowRain > 0 ? `${nowRain.toFixed(1).replace('.', ',')} mm/jam` : 'Tidak hujan'}</div>
            </div>
          </div>
          <div className="wx-sum-card">
            <div className="wx-sum-icon">💧</div>
            <div>
              <div className="wx-sum-label">Total Hujan Hari Ini</div>
              <div className="wx-sum-value">{totalRain.toFixed(1).replace('.', ',')} mm</div>
              <div className="wx-sum-sub">{totalBucketsWithRain > 0 ? `${totalBucketsWithRain * 15} menit hujan` : 'Hari kering'}</div>
            </div>
          </div>
          <div className="wx-sum-card">
            <div className="wx-sum-icon">📈</div>
            <div>
              <div className="wx-sum-label">Puncak Hujan</div>
              <div className="wx-sum-value">{peakBucket.mm > 0 ? `${peakBucket.mm.toFixed(1).replace('.', ',')} mm` : '—'}</div>
              <div className="wx-sum-sub">{peakBucket.mm > 0 ? `Pukul ${b2str(peakBucket.bucket)} WIB` : 'Tidak ada hujan'}</div>
            </div>
          </div>
          <div className="wx-sum-card">
            <div className="wx-sum-icon">⏱️</div>
            <div>
              <div className="wx-sum-label">Periode Hujan</div>
              <div className="wx-sum-value">{rainPeriods.length} periode</div>
              <div className="wx-sum-sub">{rainPeriods.length > 0 ? `Rata-rata ${avgRain.toFixed(1).replace('.', ',')} mm/jam` : 'Hari kering'}</div>
            </div>
          </div>
        </div>

        {/* Bar chart */}
        <div className="wx-body">
          <div className="wx-chart-section">
            <h3 className="wx-section-title">📊 Profil Curah Hujan Per 15 Menit</h3>
            <div className="wx-chart-container">
              <div className="wx-chart-bars">
                {hourlyProfile.map((h) => {
                  const isNow = h.bucket === bucket
                  const pct = maxBar > 0 ? (h.mm / maxBar) * 100 : 0
                  return (
                    <div
                      key={h.bucket}
                      className={`wx-bar-col ${isNow ? 'is-now' : ''}`}
                      data-tip={`${h.time}: ${h.mm > 0 ? h.mm.toFixed(1).replace('.', ',') + ' mm — ' + getBarLabel(h.mm).label : 'Kering'}`}
                    >
                      <div className="wx-bar-fill-wrap">
                        <div
                          className="wx-bar-fill"
                          style={{
                            height: `${Math.max(pct, h.mm > 0 ? 4 : 0)}%`,
                            background: getBarColor(h.mm),
                          }}
                        />
                      </div>
                      {isNow && <div className="wx-bar-now-marker">▲</div>}
                    </div>
                  )
                })}
              </div>
              <div className="wx-chart-time-axis">
                {[6, 8, 10, 12, 14, 16, 18, 20, 22].map((hour) => {
                  const bucketIdx = (hour * 60 - 300) / 15
                  const pctLeft = (bucketIdx / B_LAST) * 100
                  return (
                    <span key={hour} style={{ left: `${pctLeft}%` }}>{String(hour).padStart(2, '0')}:00</span>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="wx-legend">
            <span className="wx-leg-item"><i style={{ background: '#93c5fd' }} /> Gerimis (&lt;0,5 mm)</span>
            <span className="wx-leg-item"><i style={{ background: '#3b82f6' }} /> Ringan (0,5–5 mm)</span>
            <span className="wx-leg-item"><i style={{ background: '#f59e0b' }} /> Sedang (5–10 mm)</span>
            <span className="wx-leg-item"><i style={{ background: '#ef4444' }} /> Lebat (&gt;10 mm)</span>
            <span className="wx-leg-item"><span className="wx-now-dot" /> Waktu sekarang</span>
          </div>

          {/* Rain periods detail */}
          {rainPeriods.length > 0 && (
            <div className="wx-periods-section">
              <h3 className="wx-section-title">🕐 Detail Periode Hujan</h3>
              <div className="wx-periods-grid">
                {rainPeriods.map((p, idx) => {
                  const lbl = rainLabel(p.maxMm)
                  return (
                    <div key={idx} className="wx-period-card">
                      <div className="wx-period-head">
                        <span className="wx-period-icon">{lbl.icon}</span>
                        <span className="wx-period-time">{p.from} – {p.to}</span>
                        <span className={`wx-period-badge wx-rain-${p.maxMm >= 10 ? 'lebat' : p.maxMm >= 5 ? 'sedang' : p.maxMm >= 0.5 ? 'ringan' : 'gerimis'}`}>
                          {lbl.label}
                        </span>
                      </div>
                      <div className="wx-period-details">
                        <span>Durasi: <b>{p.duration} menit</b></span>
                        <span>Puncak: <b>{p.maxMm.toFixed(1).replace('.', ',')} mm/jam</b></span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* BMKG guide */}
          <div className="wx-guide">
            <h3 className="wx-section-title">📋 Panduan Kategori BMKG & Dampak Operasional</h3>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Kategori</th>
                  <th>Curah Hujan</th>
                  <th>Dampak Operasional MRT</th>
                  <th>Rekomendasi</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className="wx-cat-pill wx-gerimis">🌦 Gerimis</span></td>
                  <td>&lt; 0,5 mm/jam</td>
                  <td>Dampak minimal terhadap operasi</td>
                  <td>Operasi normal</td>
                </tr>
                <tr>
                  <td><span className="wx-cat-pill wx-ringan">🌧 Ringan</span></td>
                  <td>0,5 – 5 mm/jam</td>
                  <td>Penumpang cenderung beralih ke MRT, demand naik 5–15%</td>
                  <td>Siagakan personel tambahan di gate</td>
                </tr>
                <tr>
                  <td><span className="wx-cat-pill wx-sedang">🌧 Sedang</span></td>
                  <td>5 – 10 mm/jam</td>
                  <td>Lonjakan demand signifikan (+15–30%), risiko antrean gate</td>
                  <td>Buka semua gate, siapkan crowd barrier</td>
                </tr>
                <tr>
                  <td><span className="wx-cat-pill wx-lebat">⛈ Lebat</span></td>
                  <td>&gt; 10 mm/jam</td>
                  <td>Demand melonjak tajam (+30%+), potensi genangan, penumpang berteduh</td>
                  <td>Koordinasi P3S, evakuasi jika perlu</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="ev-modal-foot">
          <span className="ev-foot-note">
            ⓘ Data cuaca grid tunggal koridor MRT Jakarta. Sumber: model historis (bucket 15 menit).
          </span>
          <button className="btn" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  )
}
