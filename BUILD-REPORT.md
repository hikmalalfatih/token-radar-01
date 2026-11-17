# token-radar-01 — BUILD REPORT (build awal, BUKAN submit)

Dibangun 17 Nov 2026 pagi. **Tidak ada submission, tidak ada repo GitHub dibuat.**
Folder build: `~/workspace/makefun/token-radar-entry/`

## Kenapa build dimulai sekarang

Rencana awal (scouting 16 Nov): build token-radar SETELAH FPS submit. Lajur ini
dimajukan atas perintah maley "gas terus" (17 Nov pagi) karena FPS ketahan faktor
eksternal — halaman kompetisi threejs-fps-01 masih 404 dan pembuatan repo menunggu
maley — sementara jendela token-radar panjang (tutup **14 Des 2026 17:00 WIB**) dan
tidak ada rush tengah malam (kompetisi sudah buka sejak 14 Nov 17:00 WIB, sesi build
mulai sekarang sah masuk jendela transcript).

## Status kit: LIVE (dari unduhan resmi 16 Nov)

Kit resmi sudah diunduh saat scouting: `~/workspace/makefun/radar-kit/token-radar-01-kit/`
(competition.yaml, RULES.txt, input/snapshot.json, starter/, cli/, harness/).
Aturan dibaca ulang persis dari kit untuk build ini. Ringkasan yang mengikat build:

- Program `main.ts` (Node 22, stdlib saja, tanpa network) membaca
  `/input/snapshot.json`, menulis `/output/board.json`, `dashboard/`, `screenshots/`,
  dan `dossier.json` via `buildDossier` dari `vendor/makefun-board.ts` (byte-for-byte
  punya kit — terverifikasi sha256 sama: `9ca51b6e…`). Program jalan 2×, byte harus identik.
- Board: 100–4.000 baris; tiap baris slug snapshot unik, rank tepat 1..N,
  `implied_value_usd` positif ≤ 1e14 dan **non-increasing** mengikuti rank, tidak semua
  sama; **seluruh 40 watchlist wajib ada**; `farm_steps` 3–12 string @ 20–600 char.
- Dashboard: index.html + ≥1 css + ≥1 js, ≤400 file / ≤4 MiB, **tanpa referensi network**
  di atribut/style/CSS/import; source total dijaga < 64 KB (teks dossier dipotong di 65.536 byte).
- Screenshots: 3–4 gambar ≤512 KiB, sisi panjang ≤1.440, sisi pendek ≥800; panduan rumah 300–350 KiB.
- Dossier ≤1,5 MiB dan harus byte-identik dengan yang scorer bangun ulang.
- Penilaian: transcript gate 9 cek → program gate 7 baris → AI judge pairwise
  (superbot, high effort) dengan rubrik berurutan: (1) radar bekerja + cakupan watchlist,
  (2) model nilai turunan snapshot (TVL, growth 7d, tenure) bukan daftar nama hardcode,
  (3) farm plan konkret berisi biaya + durasi, (4) dashboard sortable/filterable + detail
  per protokol, (5) tampilan "made". Shortlist final di peringkat 40; rating dev ±0,953
  dibutuhkan (data scouting). Hadiah: $1.325 escrow terverifikasi on-chain saat scouting;
  juara 1 $1.000, 2–5 $50, 6–10 $25. Kuota: 5/hari, **10 total, submission terakhir yang berlaku**.

## Desain

**Model nilai (rubrik 2) — "comps-calibrated":**
`implied = TVL × multiple kategori × growth × tenure × reach × scale`

- Multiple kategori = median mcap/TVL protokol yang sudah bertoken di kategori yang
  sama, dari snapshot yang sama (128 protokol tokenized, 34 kategori berkomp;
  kategori tipis <3 komp diblend ke median global 0,214×). Band low–high dari kuartil
  komp kategori.
- Growth: change_7d → faktor clamp 0,70–1,60. Tenure: lama tercatat tanpa token,
  jenuh di 3 tahun (0,90–1,14). Reach: jumlah chain (maks +20%). Scale: premium log
  TVL $5 jt–$1 M (0,92–1,08).
- Pre-token didefinisikan persis aturan rumah: `gecko_id` dan `symbol` null.
  Produk wrapped/staked/bridged disaring dengan aturan rumah yang sama seperti
  watchlist (kategori Bridge/Canonical Bridge/Liquid Staking/Liquid Restaking/
  Restaked BTC/CEX, penanda versi di nama, kata wrapped/staked/staking, awalan
  exchange); slug watchlist selalu lolos.
- Koreksi data atas scouting: scouting menyebut 614 protokol tanpa token (itu hitungan
  `mcap_usd` null = 629). Dengan definisi rumah (gecko+symbol null) jumlahnya **342**;
  setelah saringan produk wrapped: **198 baris board**. Angka board ini yang benar
  menurut teks aturan.

**Farm plan (rubrik 3):** playbook per kelompok kategori (dex, lending, yield, bridge,
staking, rwa, chain, generic) diinstansiasi dengan data protokol sendiri (chain utama
& kedua, tier TVL, biaya sesi per chain: Ethereum $14, L2/Solana $1–2, lain $4).
6 langkah per protokol, masing-masing memuat estimasi biaya ($) dan durasi; total
estimasi biaya & jam per baris ikut ditulis ke board dan dashboard.

**Dashboard (rubrik 4–5):** vanilla HTML/CSS/JS, tema dark terminal (hitam-abu +
aksen amber). Board sortable (5 urutan), filter kategori/chain/TVL/watchlist-only,
search, dan detail view overlay per protokol yang menampilkan **seluruh math model
per protokol** (multiple, base, tiap faktor, band) + farm plan lengkap — supaya judge
bisa memverifikasi model dari screenshot & source. Hash route `#p=<slug>`,
`#watch=1`, `#cat=`, `#q=` untuk deep link & screenshot. Source repo dashboard
17.109 byte — utuh terbaca judge sebelum `data.js` (yang memang terpotong di dossier;
itu data, bukan source tulisan tangan).

## Yang terbangun

| File | Baris | Catatan |
|---|---|---|
| `main.ts` | 74 | orkestrasi: snapshot → board.json, data.js, copy dashboard/screenshots, dossier |
| `lib/model.ts` | 396 | model comps, saringan wrapped, farm playbooks, board builder |
| `dashboard/index.html` | 68 | kerangka halaman |
| `dashboard/app.css` | 108 | tema dark terminal |
| `dashboard/app.js` | 178 | render, filter, sort, detail overlay, hash route |
| `vendor/makefun-board.ts` | — | library kit, byte-identik (sha256 terverifikasi) |
| `screenshots/` | 3 PNG | 1440×1000, dirender headless Chrome dari dashboard sendiri |
| `LICENSE`, `README.md` | — | MIT; README memuat link bounty + penjelasan model |

Semua source ditulis fresh dengan write tools di sesi ini (aturan authorship:
tanpa script generator, tanpa menyalin starter — starter hanya dibaca scouting
untuk aturan & interface vendor).

## Hasil uji lokal (apa adanya)

Tidak ada grade lokal untuk kompetisi ini (server yang menilai); yang diuji =
seluruh 7 baris program gate secara lokal + determinisme:

- **Dua run byte-identik** (`diff -r` dua output bersih) ✓
- Board: **198 baris**, 382.989 byte (≤8 MiB), slug unik & semua dari snapshot,
  rank tepat 1..198, implied non-increasing, tidak semua sama ✓
- **Watchlist 40/40** tercakup ✓
- Farm steps: semua baris 6 langkah, semua dalam 20–600 char ✓
- Dashboard output: tidak ada pelanggaran referensi network; 3 file, jauh di bawah cap ✓
- Screenshots: 217.523 / 275.627 / 218.872 byte (≤512 KiB), 1440×1000 ✓ —
  board, detail (Steakhouse Financial, math + farm plan terlihat penuh), filtered
  (watchlist-only, "40 of 198 shown") — ketiganya dicek visual satu-satu ✓
- **dossier_matches: rebuild `buildDossier` dari output == dossier tertulis, byte
  per byte** ✓ — ukuran dossier 965.161 byte (≤1,5 MiB)
- Top board: #1 Steakhouse Financial $755.009.204 (TVL $2,75 miliar), #2 Sentora Curator
  $734,3 jt, #3 Gauntlet $481,6 jt. Global multiple 0,214×.

Yang BELUM diuji: `makefun check` resmi (butuh repo + bundle transcript — tahap
submit) dan tentu saja rating judge (band shortlist ±0,953; kualitas relatif kita
tidak terukur sebelum submission pertama).

## Kelemahan (jujur)

1. **Cakupan 198 baris ≈ starter (200).** Breadth bukan pembeda kita; yang membedakan
   model + detail math + farm plan. Opsi pelebaran ada (saringan nama saja → 301 baris)
   tapi berisiko dibaca judge sebagai memasukkan produk wrapped yang oleh teks tugas
   disuruh disaring — ditahan sebagai kartu iterasi, bukan default.
2. **Multiple kategori tipis.** Beberapa kategori hanya punya 1–2 komp tokenized
   (mis. Risk Curators: 1 komp → jatuh ke median global). Puncak board didominasi
   Risk Curators / Onchain Capital Allocator karena TVL raksasa × multiple global —
   masuk akal, tapi konsentrasi kategori di top-10 terlihat monoton di screenshot.
3. **Farm plan bertemplat per kategori.** Konkret (angka biaya/durasi per protokol),
   tapi kerangka kalimat sama untuk semua protokol sekategori; judge bisa menilai
   kurang "hand-tuned" dibanding entry yang menulis plan manual untuk 40 watchlist.
4. **Dossier 965 KB** — aman di bawah cap, tapi tie-break final memihak dossier lebih
   kecil; screenshot kita 712 KB dari total itu.
5. **Buta rating.** Tidak ada cara mengukur posisi vs 0,953 sebelum submit pertama;
   submission #1 memang harus diperlakukan sebagai alat ukur.

## Rencana iterasi (kuota 10, terakhir yang berlaku)

1. **Submission #1 = build ini**, setelah keputusan maley + crosscheck submit:
   repo (dibuat maley via Chrome-nya — token GitHub App 403, batas platform yang
   sudah dikenal — atau jalur source-bundle), bundle transcript sesi ini,
   `makefun check` lolos, submit bertanda tangan (signed, escrow).
2. Baca provisional rate + interval #1 sebagai baseline terukur.
3. Iterasi menyasar dimensi rubrik terlemah dari alasan judge: kandidat antrean —
   (a) farm plan watchlist-40 ditulis lebih spesifik per protokol, (b) penajaman
   multiple (blend per-kategori lebih halus / winsorize outlier komp), (c) opsi
   pelebaran board 301 baris, (d) poles visual dashboard.
4. Cadangan kuota: maksimal 6 submission untuk iterasi terencana, ≥2 disimpan
   sampai minggu terakhir sebelum 14 Des; sisanya hanya dipakai bila ada perbaikan
   terukur. No-rush: tidak ada resubmit tanpa perubahan material + crosscheck ulang.

## Blocker menuju submit (bukan blocker build)

- Repo GitHub belum ada — perlu maley (Chrome login miliknya) atau keputusan jalur
  source-bundle.
- Bundle transcript + `makefun check` belum dijalankan (memang tahap submit).
- Branding final README diverifikasi ulang saat crosscheck submit (pelajaran catur:
  penolakan pertama murni soal branding).
