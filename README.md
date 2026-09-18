# ForeSight Dashboard — MRT Jakarta Prototype

Sistem pemantauan risiko dan peringatan dini kerumunan penumpang MRT Jakarta berbasis prediktif dan kecerdasan buatan (AI).

## 🚀 Fitur Utama
- **Monitoring Risiko Dinamis**: Visualisasi status stasiun (Aman, Waspada, Kritis) secara real-time dan per horizon waktu (15–60 menit).
- **AI Network Analyzer**: Analisis on-demand berbasis LLM (`meta-llama/llama-3.3-70b-instruct` via OpenRouter) dengan strict grounding data operasional (anti-halusinasi).
- **Event Intelligence**: Modal interaktif pemantauan event di koridor MRT beserta estimasi lonjakan penumpang.
- **Weather Intelligence**: Analisis profil curah hujan per 15 menit dan dampaknya terhadap kerumunan stasiun.
- **What-If Simulation & Mitigasi**: Simulasi skenario lonjakan penumpang dan rekomendasi penambahan headway kereta/pengaturan gate.

## 🛠️ Persyaratan & Instalasi

Pastikan telah menginstal [Node.js](https://nodejs.org/) (versi 18+).

```bash
# Clone repository
git clone https://github.com/ArleneNero/prototype_dashboard_mrt.git
cd prototype_dashboard_mrt

# Install dependensi
npm install
```

## ⚙️ Konfigurasi AI (OpenRouter)

Dashboard ini telah terintegrasi dengan model **`meta-llama/llama-3.3-70b-instruct`**.
Secara default, aplikasi siap dijalankan. Jika ingin menggunakan API key Anda sendiri:

1. Salin `.env.example` menjadi `.env`:
   ```bash
   cp .env.example .env
   ```
2. Isi variabel `VITE_OPENROUTER_API_KEY`:
   ```env
   VITE_OPENROUTER_API_KEY=your_openrouter_api_key_here
   ```

## 🖥️ Menjalankan Dashboard

```bash
# Menjalankan development server
npm run dev

# Membangun bundle produksi
npm run build
```
Buka browser di `http://localhost:5173`.
