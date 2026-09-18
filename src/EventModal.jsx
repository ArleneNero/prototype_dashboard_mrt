import React, { useState } from 'react'
import { fmt, fmtDate, short, eventsOn } from './util.jsx'

export default function EventModal({ isOpen, onClose, events, dateStr, setSel, goTab }) {
  if (!isOpen) return null

  const [tab, setTab] = useState('today') // 'today' | 'all'
  const [search, setSearch] = useState('')
  const [stationFilter, setStationFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const todayEvs = eventsOn(events, dateStr)

  // Filter events based on active tab and search/filter inputs
  const baseList = tab === 'today' ? todayEvs : events
  const filteredList = baseList.filter((e) => {
    if (search) {
      const q = search.toLowerCase()
      const matchName = (e.name || '').toLowerCase().includes(q)
      const matchVenue = (e.station || '').toLowerCase().includes(q)
      const matchBasis = (e.basis || '').toLowerCase().includes(q)
      const matchType = (e.event_type || '').toLowerCase().includes(q)
      if (!matchName && !matchVenue && !matchBasis && !matchType) return false
    }
    if (stationFilter && e.station !== stationFilter) return false
    if (typeFilter && e.event_type !== typeFilter) return false
    return true
  })

  // Options for filter dropdowns
  const uniqueStations = Array.from(new Set((events || []).map((e) => e.station))).filter(Boolean)
  const uniqueTypes = Array.from(new Set((events || []).map((e) => e.event_type))).filter(Boolean)

  const getEventBadgeClass = (type) => {
    switch (type) {
      case 'konser': return 'ev-type-konser'
      case 'perayaan': return 'ev-type-perayaan'
      case 'olahraga': return 'ev-type-olahraga'
      case 'festival': return 'ev-type-festival'
      case 'lari': return 'ev-type-lari'
      default: return 'ev-type-default'
    }
  }

  const getEventIcon = (type) => {
    switch (type) {
      case 'konser': return '🎵'
      case 'perayaan': return '🎉'
      case 'olahraga': return '⚽'
      case 'festival': return '🎪'
      case 'lari': return '🏃'
      default: return '📅'
    }
  }

  const handleSelectStation = (station) => {
    if (setSel) setSel(station)
    if (goTab) goTab('Overview')
    onClose()
  }

  return (
    <div className="ev-modal-overlay" onClick={onClose}>
      <div className="ev-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ev-modal-head">
          <div>
            <div className="ev-modal-title">
              <span>📅 Panel Event Intelligence</span>
              <span className="ev-date-chip">{fmtDate(dateStr)}</span>
            </div>
            <div className="ev-modal-sub">
              Daftar event terverifikasi di koridor MRT Jakarta yang memicu lonjakan demand penumpang.
            </div>
          </div>
          <button className="ev-modal-close" onClick={onClose} title="Tutup panel">✕</button>
        </div>

        {/* Tab switcher */}
        <div className="ev-modal-tabs">
          <button
            className={`ev-tab-btn ${tab === 'today' ? 'active' : ''}`}
            onClick={() => setTab('today')}
          >
            📌 Event Hari Ini ({todayEvs.length})
          </button>
          <button
            className={`ev-tab-btn ${tab === 'all' ? 'active' : ''}`}
            onClick={() => setTab('all')}
          >
            🗓️ Semua Event Terjadwal ({events.length})
          </button>
        </div>

        {/* Filter bar */}
        <div className="ev-modal-filters">
          <div className="ev-search-wrap">
            <span className="ev-search-ic">🔍</span>
            <input
              type="text"
              className="ev-search-input"
              placeholder="Cari nama event, venue, stasiun..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="ev-search-clear" onClick={() => setSearch('')}>✕</button>
            )}
          </div>
          <select
            className="ev-filter-select"
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
          >
            <option value="">Semua Stasiun</option>
            {uniqueStations.map((st) => (
              <option key={st} value={st}>{short(st)} ({st})</option>
            ))}
          </select>
          <select
            className="ev-filter-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">Semua Kategori</option>
            {uniqueTypes.map((t) => (
              <option key={t} value={t}>{getEventIcon(t)} {t.toUpperCase()}</option>
            ))}
          </select>
        </div>

        {/* Body content */}
        <div className="ev-modal-body">
          {filteredList.length === 0 ? (
            <div className="ev-empty">
              <div className="ev-empty-ic">📅</div>
              <h3>Tidak Ada Event Ditemukan</h3>
              <p>
                {tab === 'today'
                  ? `Tidak ada event terjadwal di sekitar koridor MRT pada tanggal ${fmtDate(dateStr)}.`
                  : 'Tidak ada event yang sesuai dengan pencarian/filter Anda.'}
              </p>
              {tab === 'today' && events.length > 0 && (
                <button className="btn primary" onClick={() => setTab('all')}>
                  Lihat Semua {events.length} Event Terjadwal
                </button>
              )}
            </div>
          ) : (
            <div className="ev-grid">
              {filteredList.map((e, idx) => {
                const isToday = e.date <= dateStr && dateStr <= (e.end_date || e.date)
                return (
                  <div key={idx} className={`ev-card ${isToday ? 'is-today' : ''}`}>
                    <div className="ev-card-top">
                      <div className="ev-card-title-row">
                        <span className={`ev-type-pill ${getEventBadgeClass(e.event_type)}`}>
                          {getEventIcon(e.event_type)} {e.event_type || 'Event'}
                        </span>
                        {e.network_wide ? (
                          <span className="ev-net-pill" title="Berdampak pada seluruh jaringan MRT">
                            🌐 Network Wide
                          </span>
                        ) : (
                          <span className="ev-st-pill">
                            📍 {short(e.station)}
                          </span>
                        )}
                        {isToday && <span className="ev-today-badge">HARI INI</span>}
                      </div>
                      <h4 className="ev-card-name">{e.name}</h4>
                    </div>

                    <div className="ev-card-details">
                      <div className="ev-detail-item">
                        <span className="lbl">📅 Tanggal</span>
                        <span className="val">
                          {fmtDate(e.date)}
                          {e.end_date && e.end_date !== e.date ? ` s/d ${fmtDate(e.end_date)}` : ''}
                        </span>
                      </div>
                      <div className="ev-detail-item">
                        <span className="lbl">⏰ Jam Operational Event</span>
                        <span className="val">{e.start} – {e.end} WIB</span>
                      </div>
                      <div className="ev-detail-item">
                        <span className="lbl">👥 Estimasi Penonton</span>
                        <span className="val ev-att">~{fmt(e.attendance)} orang</span>
                      </div>
                      <div className="ev-detail-item">
                        <span className="lbl">📍 Stasiun Terdekat</span>
                        <span className="val">{e.station}</span>
                      </div>
                    </div>

                    {e.basis && (
                      <div className="ev-card-basis">
                        ⓘ <b>Basis Data:</b> {e.basis}
                      </div>
                    )}

                    <div className="ev-card-actions">
                      <button
                        className="ev-action-btn"
                        onClick={() => handleSelectStation(e.station)}
                      >
                        Pilih Stasiun {short(e.station)} & Lihat Risiko →
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="ev-modal-foot">
          <span className="ev-foot-note">
            ⓘ Menampilkan {filteredList.length} dari {baseList.length} event ({tab === 'today' ? `Hari Ini: ${fmtDate(dateStr)}` : 'Semua Jadwal'}).
          </span>
          <button className="btn" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  )
}
