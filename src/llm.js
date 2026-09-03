/**
 * AI Analyzer ForeSight — on-demand saja (dipanggil saat pengguna menekan tombol),
 * BUKAN chatbot: satu arah, angka selalu digrounding dari data dashboard.
 *
 * ⚠️ KEAMANAN: key tertanam di client untuk kebutuhan demo lokal. Siapa pun yang membuka
 * source dashboard dapat membacanya — ROTATE key ini setelah demo, dan untuk produksi
 * pindahkan ke proxy/env sisi server.
 */
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'meta-llama/llama-3.3-70b-instruct'
const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || ''

const SYSTEM = `Kamu adalah AI Analyzer untuk dashboard ForeSight — sistem peringatan dini kerumunan penumpang MRT Jakarta.
Aturan keras:
- Jawab dalam Bahasa Indonesia, ringkas (maksimal 4 kalimat), untuk petugas/security stasiun.
- HANYA gunakan angka dan fakta dari data grounding yang diberikan. DILARANG mengarang angka, nama event, atau fakta baru.
- Jika data kurang, katakan apa yang kurang — jangan mengisi dengan tebakan.
- Langsung narasi, tanpa pembukaan seperti "tentu" atau "berikut".`

export async function analyzeAI(konteks, grounding) {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
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
  if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`)
  const j = await res.json()
  const txt = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content
  return (txt || '').trim() || '(respons kosong dari model)'
}
