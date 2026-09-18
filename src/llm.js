/**
 * AI Analyzer ForeSight — Menggunakan OpenRouter API (Strict Grounding mode).
 * Model: meta-llama/llama-3.3-70b-instruct
 * Dipanggil saat pengguna menekan tombol AI Analyzer pada dashboard.
 */

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
export const MODEL = 'meta-llama/llama-3.3-70b-instruct'

// Default API key untuk AI Analyzer ForeSight Dashboard
const DEFAULT_KEY_B64 = 'c2stb3ItdjEtYzY4MzJlMGFhMjk3NGM4N2MzNDM3NjkxYTFmZjkwN2ViMjlkM2JjOTk3ODcyNWIyZGYzMTYzNDNjYjUwM2UyNg=='
export const DEFAULT_API_KEY = typeof atob === 'function' 
  ? atob(DEFAULT_KEY_B64) 
  : Buffer.from(DEFAULT_KEY_B64, 'base64').toString()

export function getOpenRouterKey() {
  if (typeof window !== 'undefined') {
    const customKey = localStorage.getItem('foresight_openrouter_api_key')
    if (customKey && customKey.trim()) return customKey.trim()
  }
  const envKey = import.meta.env?.VITE_OPENROUTER_API_KEY
  if (envKey && envKey.trim() && envKey !== 'your_openrouter_api_key_here') {
    return envKey.trim()
  }
  return DEFAULT_API_KEY
}

export function setOpenRouterKey(key) {
  if (typeof window !== 'undefined') {
    if (!key || !key.trim()) {
      localStorage.removeItem('foresight_openrouter_api_key')
    } else {
      localStorage.setItem('foresight_openrouter_api_key', key.trim())
    }
  }
}

export async function testAIConnection() {
  let key = getOpenRouterKey()
  if (!key) throw new Error('API Key belum dikonfigurasi.')

  let res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
      'X-Title': 'ForeSight Dashboard MRT Jakarta',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: 'Ping koneksi ForeSight. Jawab singkat: Terhubung.' }],
      max_tokens: 15,
      temperature: 0.1,
    }),
  })

  // Jika custom key 401 unauthorized, fallback ke default key
  if (res.status === 401 && key !== DEFAULT_API_KEY && DEFAULT_API_KEY) {
    if (typeof window !== 'undefined') localStorage.removeItem('foresight_openrouter_api_key')
    key = DEFAULT_API_KEY
    res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
        'X-Title': 'ForeSight Dashboard MRT Jakarta',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: 'Ping koneksi ForeSight. Jawab singkat: Terhubung.' }],
        max_tokens: 15,
        temperature: 0.1,
      }),
    })
  }

  if (!res.ok) {
    let errDetail = ''
    try {
      const errJson = await res.json()
      errDetail = errJson.error?.message || errJson.message || JSON.stringify(errJson)
    } catch {
      errDetail = await res.text()
    }
    throw new Error(`OpenRouter HTTP ${res.status}: ${errDetail || res.statusText}`)
  }

  const j = await res.json()
  return (j?.choices?.[0]?.message?.content || 'Koneksi Berhasil').trim()
}

const SYSTEM = `Kamu adalah AI Analyzer untuk dashboard ForeSight — sistem peringatan dini kerumunan penumpang MRT Jakarta.
Aturan keras:
- Jawab dalam Bahasa Indonesia, ringkas (maksimal 4 kalimat), untuk petugas/security stasiun.
- HANYA gunakan angka dan fakta dari data grounding yang diberikan. DILARANG mengarang angka, nama event, atau fakta baru.
- Jika data kurang, katakan apa yang kurang — jangan mengisi dengan tebakan.
- Langsung narasi, tanpa pembukaan seperti "tentu" atau "berikut".`

export async function analyzeAI(konteks, grounding) {
  let apiKey = getOpenRouterKey()
  if (!apiKey) {
    throw new Error('API Key belum dikonfigurasi. Harap isi VITE_OPENROUTER_API_KEY di file .env atau pada halaman Settings.')
  }

  let res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
      'X-Title': 'ForeSight Dashboard MRT Jakarta',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Konteks tugas: ${konteks}\n\nData grounding (satu-satunya sumber fakta):\n${grounding}` },
      ],
      max_tokens: 320,
      temperature: 0.2,
    }),
  })

  // Jika error 401 dan bukan default key, auto-fallback ke DEFAULT_API_KEY
  if (res.status === 401 && apiKey !== DEFAULT_API_KEY && DEFAULT_API_KEY) {
    if (typeof window !== 'undefined') localStorage.removeItem('foresight_openrouter_api_key')
    apiKey = DEFAULT_API_KEY
    res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
        'X-Title': 'ForeSight Dashboard MRT Jakarta',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Konteks tugas: ${konteks}\n\nData grounding (satu-satunya sumber fakta):\n${grounding}` },
        ],
        max_tokens: 320,
        temperature: 0.2,
      }),
    })
  }

  if (!res.ok) {
    let errDetail = ''
    try {
      const errJson = await res.json()
      errDetail = errJson.error?.message || errJson.message || JSON.stringify(errJson)
    } catch {
      errDetail = await res.text()
    }
    throw new Error(`OpenRouter HTTP ${res.status}: ${errDetail || res.statusText}`)
  }

  const j = await res.json()
  const txt = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content
  return (txt || '').trim() || '(respons kosong dari model)'
}
