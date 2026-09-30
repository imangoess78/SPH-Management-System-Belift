# PRD — Penambahan Modul Survey Sales, Final Survey & PO Pabrik
## Sistem SPH Management — PT Belift Amanah Indonesia (`sph.belift.co.id`)

| | |
|---|---|
| **Versi** | 1.0 (draft untuk review) |
| **Tanggal** | 29 September 2026 |
| **Sumber permintaan** | Klien Belift — via prototipe `Data_Teknis_Terpadu_Belift.html` |
| **Sistem target** | `sph.belift.co.id` (Cloudflare Pages + D1) |
| **Prinsip utama** | **Aditif / non-destruktif** — sistem CRM, SPH, SPK yang sudah berjalan tidak diubah perilakunya |

---

## 1. Ringkasan Eksekutif

Klien ingin **tiga tahap baru** masuk ke alur kerja yang sudah ada:

```
SEKARANG :  CRM Lead ──────────────► SPH ──────► SPK
DIMINTA  :  CRM Lead ─► SURVEY SALES ─► SPH ─► SPK ─► FINAL SURVEY ─► PO PABRIK
```

Klien sudah membuat prototipe HTML sendiri (`Data_Teknis_Terpadu_Belift.html`, 1.951 baris, 372 KB). Prototipe itu **bagus secara isi** — data teknisnya lengkap dan terstruktur (7 seksi, 57 field, 33 wajib, 24 daftar pilihan, 25 item harga) — tetapi **belum bisa langsung dipakai di produksi**, karena:

- Menyimpan data di `localStorage` browser — **tidak ada database**, tidak bisa multi-user
- **Tanpa login & tanpa hak akses** — siapa pun yang buka bisa lihat & ubah semua proyek
- **Tanpa nomor dokumen dari server** — nomor SPH/SPK diketik manual, rawan bentrok
- Struktur datanya **berbeda** dari tabel `sph` yang sudah berjalan
- Belum terhubung ke CRM Lead yang sudah ada

**Rekomendasi:** ambil **isi & alur** prototipe (yang memang sesuai kebutuhan klien), lalu **bangun ulang sebagai modul asli** di dalam sistem sekarang — tabel D1 sendiri, API sendiri, halaman React sendiri, menu sendiri. Tidak ada satu pun tabel atau halaman lama yang diubah strukturnya.

**Estimasi:** 6–8 minggu kerja (rincian di Bab 16).

---

## 2. Latar Belakang & Tujuan

### 2.1 Latar belakang
Sistem SPH Management sekarang sudah menangani **CRM Lead**, **SPH (Penawaran)**, dan **SPK (Kontrak)**. Klien melihat ada tiga tahap operasional yang belum terwadahi:

1. **Survey Sales** — sales datang ke lokasi, mengisi form survey, memotret dokumentasi
2. **Final Survey** — pengukuran ulang setelah kontrak, sebelum barang dipesan ke pabrik
3. **PO Pabrik** — pemesanan resmi ke pabrik, termasuk revisi bila ada perubahan

Ketiga tahap ini **saling berkaitan datanya**: data teknis yang diketik di Survey Sales dipakai SPH → SPK → Final Survey → PO. Kalau berubah, harus terlihat apa yang berubah.

### 2.2 Tujuan
| # | Tujuan | Ukuran keberhasilan |
|---|---|---|
| T1 | Data lead mengalir otomatis ke form survey | Tidak ada input ulang nama/alamat customer |
| T2 | Data teknis diketik **sekali**, dipakai 5 dokumen | Nol duplikasi input antar-tahap |
| T3 | Setiap tahap terkunci (snapshot) saat disahkan | Ada jejak siapa & kapan mengunci |
| T4 | Perubahan data terdeteksi otomatis | Sistem menandai selisih antar-tahap |
| T5 | PO Pabrik tercatat per revisi | Riwayat revisi + alasan perubahan |
| T6 | **Sistem lama tetap jalan** | Nol regresi pada CRM, SPH, SPK |

### 2.3 Di luar tujuan (non-goals)
- Mengubah cara kerja SPH & SPK yang sudah disetujui klien
- Membuat aplikasi mobile native
- Integrasi langsung ke ERP/akuntansi pabrik

---

## 3. Kondisi Sistem Sekarang (Baseline)

### 3.1 Teknologi
| Lapis | Teknologi |
|---|---|
| Frontend | React + Vite + TypeScript, Tailwind, shadcn/ui, React Router |
| Hosting | Cloudflare Pages — proyek `sph-management-clone`, branch produksi `main` |
| Backend | Cloudflare Pages Functions (`functions/api/`) |
| Database | Cloudflare D1 — `sph-management-db` |
| Auth | Sesi cookie `sph_session` + tabel `app_sessions`, `app_users`, `profiles`, `user_roles` |

### 3.2 Struktur kode (yang tidak boleh diubah perilakunya)
```
src/
  App.tsx                  ← routing utama
  components/AppLayout.tsx ← menu sidebar (NAV_GROUPS)
  lib/crm-akses.ts         ← hak akses per peran
  pages/
    Index.tsx              ← Dashboard
    SPHForm.tsx  (1.026 baris) ← form SPH *dan* SPK (defaultMode)
    SPHList.tsx / SPKList.tsx / SPKNew.tsx / SPHPreview.tsx
    crm/  LeadsList · LeadInput · Kanban · IklanDashboard · Dokumen · ApprovalDiskon · CrmMaster
functions/api/
  crm.ts  (528 baris)  ← modul CRM, router ?resource=
  data.ts · media.ts · auth/* · admin/users.ts
```

### 3.3 Tabel D1 yang sudah ada
`crm_leads` · `crm_lead_riwayat` · `crm_dokumen` · `crm_biaya_iklan` · `crm_ref_kanal` · `crm_ref_sales` · `crm_ref_diskon` · `crm_ref_status` · `sph` · `sales` · `design_items` · `app_users` · `app_sessions` · `profiles` · `user_roles`

### 3.4 Alur status pipeline yang sudah berjalan (`crm_ref_status`)
| Urut | Status | Pemilik |
|---|---|---|
| 10 | Lead Baru | Sales |
| 20 | Kontak Pertama Dilakukan | Sales |
| 30 | Survey Dijadwalkan | Sales |
| 40 | Survey Selesai | Sales |
| 50 | Hitung Harga 3 Lingkup | Sales |
| 60 | SPH Terkirim | Sales |
| 70 | Negosiasi | Sales |
| 80 | Menunggu Approval Diskon | Sales |
| 90 | Deal - Menunggu Dokumen | Sales |
| 100 | SPK Disusun | Admin |
| 110 | SPK Bernomor & Terkirim | Admin |
| 120 | SPK Ditandatangani + DP | Operasional |
| 130 | KOM Terjadwal | Operasional |
| 140 | Selesai - Pindah ke File 00 | Operasional |
| 900 | Gugur | Sales |

> **Penting:** status **30 & 40** sudah tersedia tapi belum punya form. Status **130** (KOM Terjadwal) saat ini langsung setelah SPK ditandatangani. **Final Survey & PO Pabrik harus disisipkan di antara 120 dan 130.**

### 3.5 Hak akses yang sudah berjalan (`crm-akses.ts`)
`Sales` · `Admin` · `Manager` · `Direktur` · `Admin Sistem`
(_Akan ditambah peran **Surveyor** untuk Final Survey_)
- Sales: hanya lead miliknya sendiri
- Admin: seluruh lead (baca) + Meja Dokumen
- Manager/Direktur/Admin Sistem: seluruh lead + boleh ubah + kelola master

### 3.6 Celah yang ditemukan (harus ditangani PRD ini)
| # | Temuan | Dampak |
|---|---|---|
| C1 | Tabel `sph` **tidak punya kolom `id_lead`** — hubungan ke CRM hanya lewat teks `no_sph`/`no_spk` di `crm_leads` | Tidak ada relasi kuat lead ↔ proyek. Tahap baru butuh kunci penghubung |
| C2 | `sph` menyimpan spec sebagai **JSON blob** (`specs`, `items`, `terms`, `payments`, `designs`), bukan kolom terpisah | Data teknis tidak bisa di-query per field; perbandingan antar-tahap harus dihitung di aplikasi |
| C3 | Belum ada tabel survey, belum ada tabel PO | Harus dibuat baru |
| C4 | `SPHForm.tsx` melayani SPH **dan** SPK dalam satu file 1.026 baris | File sensitif — jangan disentuh; modul baru harus berdiri sendiri |

---

## 4. Aset dari Klien (Hasil Bedah Prototipe)

**File:** `Data_Teknis_Terpadu_Belift.html` — 1.951 baris, 372 KB, HTML satu file (CSS + JS inline), **tanpa backend**.

### 4.1 Konsep inti yang bagus (layak diadopsi)
> *"Satu data teknis → lima dokumen. Semua dokumen mencetak data teknis lewat fungsi yang SAMA, jadi susunan, istilah, dan gambar desain tidak mungkin berbeda antar-form."*

Ini pemikiran yang tepat dan **harus dipertahankan** di produksi.

### 4.2 Struktur 6 tab
| Tab | Kode | Nama | Fungsi di prototipe |
|---|---|---|---|
| 1 | `ss` | **Survey Sales** | Form survey kunjungan sales *(BARU)* |
| 2 | `sph` | SPH | Penawaran — sudah ada di sistem |
| 3 | `spk` | SPK | Kontrak — sudah ada di sistem |
| 4 | `fs` | **Final Survey** | Survey akhir sebelum PO *(BARU)* |
| 5 | `po` | **PO Pabrik** | Pemesanan ke pabrik + revisi *(BARU)* |
| Δ | `lacak` | Lacak | Perbandingan data antar-tahap *(BARU)* |

### 4.3 Skema Data Teknis — 7 seksi, 57 field, 33 wajib
| Seksi | EN | ID | Field | Wajib |
|---|---|---|---|---|
| `type` | TYPE | Tipe | 6 | 3 |
| `basic` | BASIC SPECIFICATION | Spesifikasi dasar | 18 | 10 |
| `shaft` | SHAFT SPECIFICATION | Spesifikasi shaft | 16 | 8 |
| `car` | CAR SPECIFICATION & DESIGN | Kabin & desain | 8 | 8 |
| `door` | DOOR | Pintu | 7 | 4 |
| `addon` | ADD-ON | Tambahan | 1 | 0 |
| `req` | SPECIAL REQUEST | Permintaan khusus | 1 | 0 |
| | | **TOTAL** | **57** | **33** |

**Tipe field:** `chk` (kotak centang) 21 · `txt` 13 · `design` (kode+finishing+gambar) 7 · `sel` 5 · `num` 4 · `calc` (hitung otomatis) 4 · `floors` 1 · `addons` 1 · `request` 1

**Field `calc` (otomatis):** `fsd` (Floor/Stop/Door) · `shaftIn` (ukuran dalam shaft) · `travel` (tinggi lintasan) · `total` (pit+lintasan+OH)

**Tabel lantai (`floors[]`):** per lantai → `mk` (floor marking) · `stop` (berhenti?) · `a`/`b` (pintu A/B) · `w` (lebar shaft) · `d` (dalam shaft) · `h` (floor-to-floor)

### 4.4 Katalog pendukung
| Aset | Jumlah | Isi |
|---|---|---|
| `OPT` daftar pilihan | 24 | model, paket, machine, cabin, language, capacity, persons, speed, entrances, copQty, env, power, freq, motor, roping, cwt, yn, structure, by, cover, carWall, flMat, opening, doorMat |
| `KATALOG` harga | 25 item | PENGADAAN 8 · INSTALASI 7 · SIPIL 10 |
| `DESAIN` | 7 kategori | carDesign, ceiling, flooring, cop, lop, door, handrail |
| `FINISH` | 2 | Hairline SS, Mirror SS |
| `ADDON_KAT` | 10 | Handrail, Cabin AC, Cabin fan, Access card, RGB lighting, Cabin CCTV, Voice announcer, Cabin mirror, Folding seat, Other |

### 4.5 Isi form survey (dipakai Survey Sales **dan** Final Survey)
| Bagian | Isi |
|---|---|
| Identitas | Disurvey oleh · Tanggal · PJ lapangan · No. HP PJ · Jam kerja lokasi |
| **A. Dokumentasi lokasi** | **7 checklist wajib** (foto tampak depan, video akses, foto shaft per lantai, foto pit, foto overhead, foto parkir/MOS, link lokasi) + upload foto + link video/Drive |
| D. Pekerjaan tambahan | 8 jenis pekerjaan sipil (Gali pit, Perkuatan struktur, Bobok opening, Buat ram/bordes, Bobok lantai, Penutup mesin, Finishing opening, Pekerjaan lain) + keterangan |
| E. Catatan lapangan | Hambatan, balok, pipa, akses material, posisi mesin |
| F. Catatan desain | Hal desain yang disepakati customer di lokasi |
| **G. Kesimpulan** | **4 pertanyaan Ya/Tidak + alasan** |
| Tanda tangan | Sales · Customer · Surveyor (tanda tangan di layar) |

**G. Pertanyaan Survey Sales:** (1) Lokasi memungkinkan dipasang lift? (2) Data cukup untuk dibuatkan SPH? (3) Ada pekerjaan sipil yang perlu dikerjakan Belift? (4) Desain & add-on sudah dipilih customer?

**G. Pertanyaan Final Survey:** (1) Hasil survey sudah final? (2) Data survey bisa ditetapkan final? (3) Bisa dilanjutkan ke pemesanan? (4) Data final sesuai kontrak?

### 4.6 Mekanisme kunci (snapshot) — bagus, layak diadopsi
Prototipe menyimpan salinan terkunci per tahap:
- `P.snap.sales` → dipakai tab **Survey Sales + SPH**
- `P.snap.kontrak` → dipakai tab **SPK**
- `P.snap.final` → dipakai tab **Final Survey**
- `P.po.revs[]` → **setiap PO** yang diterbitkan (salinan + daftar yang berubah)

Aturan kunci di prototipe:
- **Final Survey** tidak bisa dikunci kalau: masih ada isian wajib kosong, **atau** pertanyaan G1–G3 belum dijawab "Ya"
- **PO Pabrik** tidak bisa diterbitkan kalau: Final Survey belum dikunci, atau ada isian wajib kosong, atau ada perubahan setelah Final Survey tapi kolom *"Alasan perubahan"* masih kosong
- **Buka kunci** wajib menuliskan alasan (tercatat di riwayat)

### 4.7 Validasi pintar di prototipe (layak diadopsi)
| Validasi | Cara kerja |
|---|---|
| **Deteksi nilai kabur** | Regex menolak nilai seperti *custom*, *costume*, *after survey*, *as per drawing*, *sesuai gambar*, *menyusul*, *TBD* — wajib nilai pasti |
| **Cek ketegakan shaft** | Kalau selisih ukuran shaft antar-lantai > 20 mm → peringatan |
| **Peringatan COP** | Akses 2 pintu tapi COP hanya 1 → peringatan |
| **Perbandingan antar-tahap** | `diff(a,b)` membandingkan 57 field + tabel lantai + add-on, dipisah jadi *berubah / baru diisi / dikosongkan* |
| **Persentase kesesuaian** | Menghitung berapa % isian kontrak yang tetap sama di Final Survey |

### 4.8 Dokumen cetak yang dihasilkan prototipe
| Fungsi | Dokumen |
|---|---|
| `docSurvey("ss")` | Form Survey Sales |
| `docSurvey("fs")` | Form Final Survey |
| `docSPH()` | SPH — Penawaran |
| `docSPK()` | SPK — Kontrak (berpasal) |
| `docPO()` | PO Pabrik (per revisi) |
| `docLacak()` | Lacak Perubahan (tabel perbandingan) |

Semua A4, ada kop surat, nomor halaman, tanda tangan, cap, watermark.

### 4.9 Ekspor teks (tempel ke sistem lain)
| Fungsi | Tujuan |
|---|---|
| `copyRegister("SPH"/"SPK")` | Baris register SPH/SPK (tempel ke Excel) |
| `exportOrderDB()` | Blok 1 → File 00 sheet *Daftar Proyek*; Blok 2 → File Invoice sheet *DATA ORDER* |
| `exportKOM()` | Data teknis ringkas untuk aplikasi KOM |

### 4.10 Data referensi di prototipe → diselaraskan dengan DB
| Data | Di prototipe | **Keputusan: pakai DB** |
|---|---|---|
| Sales | Imam Solikhin, Firman, Dewo, Arif, Jihad, Izzu | Tabel `sales` — 7 aktif: Arif, Dewo, Firman, Imam Solikhin, Izzu, Jihad, Mas Nur |
| Direktur | Adhie Kurnia | Adhie Kurnia *(sama)* |
| Jabatan ttd | Sales, Sales Manager, Direktur Operasional, Direktur | Sama seperti sistem sekarang |
| Alamat kantor | 2 (Depok — Komplek PELNI; Central Duta Graha) | Sama seperti sistem sekarang |
| Rekening | BANK BCA 1662996330 KCP Cimanggis, Depok | Sama seperti sistem sekarang |
| **Surveyor** | Rohim | **Baru** — tambahkan ke referensi |
| **PIC PO** | Sholahuddin Asy Syamil | **Baru** — tambahkan ke referensi |

> **Prinsip (keputusan klien):** untuk sales & direktur, **ambil dari database** — jangan hardcode. Data baru (surveyor, PIC PO) ditambahkan sebagai referensi baru.

### 4.11 Kekurangan prototipe (alasan tidak bisa dipakai langsung)
| # | Kekurangan | Risiko |
|---|---|---|
| P1 | Penyimpanan `localStorage` | Data hilang kalau browser dibersihkan; tidak bisa diakses dari komputer lain |
| P2 | Tanpa login | Siapa pun yang buka file bisa lihat harga & data customer |
| P3 | Tanpa hak akses | Sales bisa lihat lead sales lain |
| P4 | Nomor SPH/SPK manual | Bisa bentrok nomor |
| P5 | Tanpa backup server | Tidak ada pemulihan data |
| P6 | Satu file 372 KB (dengan gambar base64) | Berat dibuka di HP; gambar tertanam di file |
| P7 | Struktur data berbeda dari tabel `sph` | Tidak bisa langsung dibaca sistem sekarang |

---

## 5. Alur Bisnis yang Diminta

```
┌─────────────┐    ┌──────────────┐    ┌─────┐    ┌─────┐    ┌──────────────┐    ┌───────────┐
│  CRM Lead   │───►│ SURVEY SALES │───►│ SPH │───►│ SPK │───►│ FINAL SURVEY │───►│ PO PABRIK │
│  (ada)      │    │   (BARU)     │    │(ada)│    │(ada)│    │   (BARU)     │    │  (BARU)   │
└─────────────┘    └──────────────┘    └─────┘    └─────┘    └──────────────┘    └───────────┘
   status 10-20        status 30-40    status 50-60  status 90-120   sebelum 130      sebelum 130
```

**Yang diminta klien, kalimat aslinya:**
> "alurnya sales input data lead masuk seperti di CRM. kemudian sales melakukan survey ke lokasi, ada form yang harus di isi. ini nanti jadi Menu nav Survey Sales. Kemudian lanjut ke tahap pembuatan SPH, lanjut ke tahap Pembuatan SPK. kemudian tahap Final Survey dan terakhir ke tahap PO ke Pabrik."
>
> "Sistem yang sekarang sudah sesuai. yaitu CRM, SPH dan SPK. Client ingin menambahkan Bagian yang Survey Sales, Survey Final dan PO Pabrik."

### 5.1 Aturan keterkaitan data
| # | Aturan |
|---|---|
| A1 | Survey Sales **hanya bisa dibuat** dari lead yang sudah ada di CRM |
| A2 | Data customer (nama, perusahaan, alamat, kota, HP) **terisi otomatis** dari lead |
| A3 | Data teknis diketik **di Survey Sales**, lalu dipakai SPH |
| A4 | SPH & SPK yang ada sekarang **tetap bisa dibuat** tanpa Survey Sales (jalur lama tidak diputus) |
| A5 | Final Survey **membandingkan** data kontrak (SPK terkunci) vs kondisi lapangan sebenarnya |
| A6 | PO Pabrik **hanya bisa diterbitkan** setelah Final Survey dikunci |
| A7 | Setiap perubahan setelah kunci **tercatat** sebagai revisi + alasan |
| A8 | Semua tahap terhubung ke **satu kunci proyek** (`kode_proyek`, format `BLF-TAHUN-NOMOR`) |

---

## 6. Analisis Kesenjangan (Gap Analysis)

| Kebutuhan | Status sekarang | Yang harus dibangun |
|---|---|---|
| Input lead CRM | ✅ Ada | — |
| Menu & form Survey Sales | ❌ Belum | **Halaman baru + tabel + API** |
| Data teknis terstruktur (57 field) | ⚠️ Sebagian — `sph.specs` JSON blob | **Tabel baru, terpisah dari `sph`** |
| Upload & checklist dokumentasi survey | ❌ Belum | **Tabel + endpoint media** |
| Menu & form Final Survey | ❌ Belum | **Halaman baru + tabel + API** |
| Perbandingan otomatis antar-tahap | ❌ Belum | **Mesin diff di frontend** |
| Menu & PO Pabrik + revisi | ❌ Belum | **Halaman baru + tabel + API** |
| Kunci/snapshot per tahap | ❌ Belum | **Kolom snapshot + API** |
| Nomor dokumen dari server | ✅ Ada (SPH/SPK) | Perluas ke PO |
| Riwayat & audit | ⚠️ Ada `crm_lead_riwayat` | Perluas ke tahap baru |
| Kunci penghubung lead ↔ proyek | ⚠️ Hanya teks | **Kolom `id_lead` + `kode_proyek`** |

---

## 7. Ruang Lingkup

### 7.1 Termasuk
1. Tabel D1 baru: survey, PO, revisi PO, dokumentasi, snapshot
2. Kolom tambahan (**nullable**) pada tabel yang ada — tidak mengubah data lama
3. API baru: `functions/api/survey.ts`, `functions/api/po.ts`
4. Halaman React baru: `SurveySales`, `FinalSurvey`, `POPabrik`, `LacakPerubahan`
5. Menu sidebar baru: grup **"Operasional Lapangan"** dengan 3 item
6. Form survey lengkap (7 seksi dokumentasi, 8 pekerjaan tambahan, catatan, 4 pertanyaan G, tanda tangan)
7. Mesin diff & validasi (deteksi nilai kabur, cek shaft, cek COP)
8. Cetak: Form Survey, Form Final Survey, PO Pabrik, Lacak Perubahan
9. Peran & hak akses untuk tahap baru
10. Integrasi status pipeline (`crm_ref_status` ditambah 3 status baru)

### 7.2 Tidak termasuk
1. Mengubah `SPHForm.tsx`, `SPHList.tsx`, `SPKList.tsx`, `SPKNew.tsx`, `SPHPreview.tsx`
2. Mengubah struktur tabel `sph` (kecuali tambah kolom nullable)
3. Mengubah modul CRM yang sudah jalan (Leads, Kanban, Diskon, Dokumen, Iklan, Master)
4. Migrasi data lama ke skema baru
5. Aplikasi mobile native

---

## 8. Rancangan Arsitektur (Non-Destruktif)

### 8.1 Prinsip
| Prinsip | Penerapan |
|---|---|
| **Aditif** | Semua tabel, kolom, file, route, menu **baru**. Tidak ada yang diganti |
| **Terisolasi** | Modul baru punya file sendiri — kalau bermasalah, matikan menu-nya saja, sistem lama tetap utuh |
| **Kompatibel mundur** | SPH/SPK lama tetap bisa dibuka, diedit, dicetak apa adanya |
| **Satu arah** | Modul baru **boleh baca** data lama; modul lama **tidak diubah** untuk membaca data baru |
| **Bertahap** | 4 fase, tiap fase bisa dilepas sendiri |

### 8.2 Pola integrasi
```
                    ┌──────────────────────────────────────┐
                    │         crm_leads (ADA)              │
                    │  + kolom baru: id_proyek,            │
                    │    kode_proyek, status_po (nullable) │
                    └──────────────┬───────────────────────┘
                                   │ id_lead (FK baru)
                    ┌──────────────▼───────────────────────┐
                    │    survey_teknis  (TABEL BARU)       │
                    │  satu baris per proyek per jenis     │
                    │  jenis: 'sales' | 'final'            │
                    │  dt: JSON (57 field + floors+addons) │
                    └──────────────┬───────────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
┌───────▼────────┐      ┌──────────▼─────────┐      ┌─────────▼────────┐
│ sph (ADA)      │      │ po_pabrik (BARU)   │      │ snapshot (BARU)  │
│ + id_lead      │      │ + po_revisi (BARU) │      │ kunci per tahap  │
│   (nullable)   │      │                    │      │                  │
└────────────────┘      └────────────────────┘      └──────────────────┘
        ▲                          ▲                          ▲
        │                          │                          │
   TIDAK DIUBAH              halaman baru               halaman baru
   (hanya kolom baru)        (Survey/FS/PO)             (Lacak)
```

### 8.3 Keputusan desain penting

**D1 — Data teknis disimpan sebagai JSON, bukan 57 kolom.**
Alasan: struktur `SEC` bisa berkembang (klien suka menambah kode pabrik / opsi). Kalau 57 kolom, tiap penambahan butuh migrasi DB. JSON = fleksibel. Konsekuensi: perbandingan dihitung di aplikasi (sudah terbukti jalan di prototipe).

**D2 — Modul baru berdiri sendiri, tidak menumpang `sph`.**
Alasan: `sph` dipakai SPH/SPK yang sedang berjalan. Menambah 57 field ke sana berisiko. Cukup tambah `id_lead` + `kode_proyek` (nullable) untuk penautan.

**D3 — Jalur lama tidak diputus.**
SPH/SPK tetap bisa dibuat lewat `/sph/new` dan `/spk/new` seperti sekarang. Menu baru adalah **tambahan**, bukan pengganti.

**D4 — Nomor PO dari server, bukan diketik.**
Format (keputusan klien): `{urut}/PO/LIFT/BAI/{bulan romawi}/{tahun}` — sama dengan pola SPK, hanya "SPK" diganti "PO".

---

## 9. Rancangan Data

> Semua perintah SQL di bawah bersifat **`CREATE TABLE` baru** atau **`ALTER TABLE ... ADD COLUMN`** yang nullable. Tidak ada `DROP`, tidak ada `UPDATE` massal.

### 9.1 Tabel baru: `survey_teknis`
```sql
CREATE TABLE IF NOT EXISTS survey_teknis (
  id              TEXT PRIMARY KEY,
  id_lead         TEXT NOT NULL,        -- FK → crm_leads.id
  kode_proyek     TEXT,                 -- BLF-2026-001
  jenis           TEXT NOT NULL,        -- 'sales' | 'final'
  no_survey       TEXT,                 -- nomor form survey
  tgl_survey      TEXT,
  surveyor        TEXT,
  pj_lapangan     TEXT,
  pj_telp         TEXT,
  jam_kerja       TEXT,
  -- Data teknis (57 field + tabel lantai + add-on)
  dt              TEXT,                 -- JSON
  -- Bagian form survey
  dokumentasi     TEXT,                 -- JSON [{no, judul, ada, foto:[{key,nama}]}]
  video_link      TEXT,
  pekerjaan_tambahan TEXT,              -- JSON [{nama, on, ket}]
  catatan_lapangan   TEXT,
  catatan_desain     TEXT,
  kesimpulan      TEXT,                 -- JSON [{q, jawab, alasan}]
  ttd             TEXT,                 -- JSON {sales, customer, surveyor}
  -- Pengesahan
  terkunci        INTEGER DEFAULT 0,
  dikunci_oleh    TEXT,
  dikunci_pada    TEXT,
  status          TEXT DEFAULT 'Draft', -- Draft | Terkunci
  dibuat_oleh     TEXT,
  diubah_oleh     TEXT,
  created_at      TEXT,
  updated_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_survey_lead  ON survey_teknis(id_lead);
CREATE INDEX IF NOT EXISTS idx_survey_jenis ON survey_teknis(id_lead, jenis);
```

### 9.2 Tabel baru: `po_pabrik`
```sql
CREATE TABLE IF NOT EXISTS po_pabrik (
  id              TEXT PRIMARY KEY,
  id_lead         TEXT NOT NULL,
  kode_proyek     TEXT,
  no_po           TEXT,
  tgl_po          TEXT,
  pabrik          TEXT,
  pic             TEXT,
  rev_terakhir    INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'Draft',   -- Draft | Terbit
  catatan         TEXT,
  dibuat_oleh     TEXT,
  created_at      TEXT,
  updated_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_po_lead ON po_pabrik(id_lead);
```

### 9.3 Tabel baru: `po_revisi`
```sql
CREATE TABLE IF NOT EXISTS po_revisi (
  id              TEXT PRIMARY KEY,
  id_po           TEXT NOT NULL,          -- FK → po_pabrik.id
  rev             INTEGER NOT NULL,
  tgl_revisi      TEXT,
  oleh            TEXT,
  alasan          TEXT,
  dt              TEXT,                   -- snapshot data teknis saat PO ini
  perubahan       TEXT,                   -- JSON [{field, lama, baru}]
  jml_perubahan   INTEGER DEFAULT 0,
  perubahan_setelah_final INTEGER DEFAULT 0,
  created_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_rev_po ON po_revisi(id_po, rev);
```

### 9.4 Tabel baru: `proyek` (kunci penghubung — opsional, disarankan)
```sql
CREATE TABLE IF NOT EXISTS proyek (
  id              TEXT PRIMARY KEY,
  kode_proyek     TEXT UNIQUE,            -- BLF-2026-001
  id_lead         TEXT NOT NULL,
  nama_proyek     TEXT,
  customer        TEXT,
  kota            TEXT,
  status_terakhir TEXT,
  tahap_sekarang  TEXT,                   -- CRM | Survey | SPH | SPK | FinalSurvey | PO
  created_at      TEXT,
  updated_at      TEXT
);
```

### 9.5 Kolom tambahan pada tabel yang ada (**semua nullable**)
```sql
-- Penautan saja. Data lama tidak disentuh.
ALTER TABLE crm_leads ADD COLUMN id_proyek    TEXT;
ALTER TABLE crm_leads ADD COLUMN kode_proyek  TEXT;
ALTER TABLE crm_leads ADD COLUMN status_po    TEXT;
ALTER TABLE sph       ADD COLUMN id_lead      TEXT;
ALTER TABLE sph       ADD COLUMN kode_proyek  TEXT;
```

> **Catatan eksekusi:** D1/SQLite tidak punya `ADD COLUMN IF NOT EXISTS`. Migrasi harus idempoten — dicek dulu lewat `PRAGMA table_info(...)` sebelum `ALTER`.

### 9.6 Status pipeline baru (`crm_ref_status`)
```sql
INSERT OR IGNORE INTO crm_ref_status (status, urutan, pemilik, keterangan) VALUES
  ('Final Survey Dijadwalkan', 121, 'Operasional', 'Setelah SPK ditandatangani'),
  ('Final Survey Selesai',     122, 'Operasional', 'Data final siap PO'),
  ('PO Terbit ke Pabrik',      125, 'Operasional', 'PO dikirim ke pabrik');
```
> Memakai `INSERT OR IGNORE` — kalau status sudah ada, tidak dobel. Status lama tidak diubah.

### 9.7 Peran & hak akses baru
| Peran | Survey Sales | Final Survey | PO Pabrik |
|---|---|---|---|
| Sales | Buat & ubah miliknya | Lihat | Lihat |
| **Surveyor** | Buat & ubah | **Buat, ubah & KUNCI** | Lihat |
| Admin | Lihat semua | Lihat semua | Lihat semua |
| Manager | Lihat & ubah | Lihat & ubah | Lihat & ubah |
| Direktur | Lihat & ubah | Lihat & ubah | Lihat & ubah |
| Admin Sistem | Penuh | Penuh | Penuh |

> **Peran `Surveyor` adalah peran baru** (keputusan klien: surveyor yang berhak mengunci Final Survey). Ditambahkan sebagai nilai baru di kolom `peran` pada `crm_ref_sales` — nilai lama tidak diubah.

Ditambahkan di `src/lib/crm-akses.ts` sebagai fungsi baru — **fungsi lama tidak diubah**.

### 9.8 Data referensi yang perlu ditambah
| Data | Nilai | Keterangan |
|---|---|---|
| Sales | Ambil dari tabel `sales` (7 aktif: Arif, Dewo, Firman, Imam Solikhin, Izzu, Jihad, Mas Nur) | **Satu sumber** — jangan hardcode |
| Direktur | Adhie Kurnia | Sudah sama dengan sistem sekarang |
| **Surveyor** | Rohim | **Baru** — perlu ditambahkan |
| **PIC PO** | Sholahuddin Asy Syamil | **Baru** — perlu ditambahkan |

---

## 10. Rancangan API

Pola mengikuti `functions/api/crm.ts` (router `?resource=`), supaya konsisten dengan yang sudah ada.

### 10.1 `functions/api/survey.ts` (baru)
| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/survey?resource=list&jenis=sales` | Daftar survey |
| GET | `/api/survey?resource=detail&id=…` | Detail satu survey |
| POST | `/api/survey?resource=simpan` | Buat survey baru |
| PUT | `/api/survey?resource=simpan&id=…` | Ubah survey |
| POST | `/api/survey?resource=kunci&id=…` | Kunci survey (validasi wajib) |
| POST | `/api/survey?resource=buka&id=…` | Buka kunci + alasan |
| GET | `/api/survey?resource=banding&id=…` | Perbandingan antar-tahap |
| GET | `/api/survey?resource=meta` | Daftar opsi & katalog |

### 10.2 `functions/api/po.ts` (baru)
| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/po?resource=list` | Daftar PO |
| GET | `/api/po?resource=detail&id=…` | Detail PO + revisi |
| POST | `/api/po?resource=terbit` | Terbitkan PO (nomor dari server) |
| POST | `/api/po?resource=revisi` | Terbitkan revisi PO |
| GET | `/api/po?resource=banding&id=…` | Perbandingan revisi |

### 10.3 Aturan server (wajib, tidak boleh hanya di frontend)
| # | Aturan |
|---|---|
| S1 | Survey tidak bisa dikunci kalau masih ada field wajib kosong |
| S2 | Final Survey tidak bisa dikunci kalau G1–G3 belum "Ya" |
| S3 | PO tidak bisa terbit kalau Final Survey belum terkunci |
| S4 | PO tidak bisa terbit kalau ada perubahan setelah Final Survey tanpa alasan |
| S5 | Nomor PO digenerate server (anti bentrok) |
| S6 | Setiap kunci/buka kunci/revisi **wajib** masuk log |
| S7 | Sales hanya bisa akses survey miliknya |

---

## 11. Rancangan UI/UX

### 11.1 Menu sidebar baru
Ditambahkan di `AppLayout.tsx` sebagai **grup baru** — grup lama tidak diubah:

```
Operasional Lapangan
  ├── Survey Sales     → /survey/sales
  ├── Final Survey     → /survey/final
  └── PO Pabrik        → /po
```
Plus satu item di grup CRM Sales yang sudah ada (atau grup baru):
```
  └── Lacak Perubahan  → /lacak
```

### 11.2 Halaman baru
| Halaman | File | Isi |
|---|---|---|
| Survey Sales | `src/pages/survey/SurveySales.tsx` | Daftar + form survey jenis `sales` |
| Final Survey | `src/pages/survey/FinalSurvey.tsx` | Daftar + form survey jenis `final` |
| PO Pabrik | `src/pages/po/POPabrik.tsx` | Daftar PO + form terbit + riwayat revisi |
| Lacak Perubahan | `src/pages/survey/LacakPerubahan.tsx` | Tabel perbandingan antar-tahap |

### 11.3 Alur halaman Survey
```
Daftar Survey  →  [ + Survey Baru ]  →  Pilih Lead dari CRM
                                              ↓
                                    Form Survey (7 bagian)
                                    A. Dokumentasi (7 checklist + foto)
                                    B. Data Teknis (7 seksi, 57 field)
                                    D. Pekerjaan tambahan (8)
                                    E. Catatan lapangan
                                    F. Catatan desain
                                    G. Kesimpulan (4 pertanyaan)
                                    Tanda tangan (3 peran)
                                              ↓
                                    [ Simpan Draft ]  [ Kunci Survey ]
```
Indikator progres di tiap bagian: `x dari y wajib terisi` — mengadopsi badge `cnt` dari prototipe.

### 11.4 Prinsip UX dari prototipe yang dipertahankan
| # | Prinsip |
|---|---|
| U1 | **Satu form data teknis**, bukan 5 form terpisah |
| U2 | Panel kiri = form input, panel kanan = pratinjau dokumen langsung |
| U3 | Kelompok field bisa dibuka-tutup (accordion) |
| U4 | Tanda tangan langsung di layar (jari di HP/tablet) |
| U5 | Foto dikompres di HP sebelum dikirim (prototipe: max lebar 700 px) |
| U6 | Bilah tahap di atas menunjukkan status tiap tahap (draf/terkunci/terbit) |
| U7 | Peringatan validasi tampil sebagai daftar, bukan satu-satu |

### 11.5 Mobile
Semua halaman baru **wajib** rapi di HP — sales memakai HP di lapangan. Mengikuti pola `AppLayout` yang sudah ada (drawer + top bar). Foto dari kamera HP langsung.

---

## 12. Aturan Bisnis & Validasi

### 12.1 Field wajib (33 field)
| Seksi | Field wajib |
|---|---|
| Tipe (3) | model, machine, cabin |
| Dasar (10) | qty, capacity, speed, fsd, entrances, copQty, env, power, cwt, controller |
| Shaft (8) | structure, structureBy, cover, coverBy, floors, pit, oh |
| Kabin (8) | carDim, carDesign, ceiling, carWall, flooring, cop, lop |
| Pintu (4) | opening, openingSize, carDoor, carDoorMat, landingDoor, landingDoorMat |

### 12.2 Aturan tabel lantai
- Minimal **2 lantai**
- Tiap lantai wajib: `mk` (floor marking), `w` (lebar shaft), `d` (dalam shaft)
- Semua lantai kecuali terakhir wajib: `h` (floor-to-floor)
- Kalau `stop` dicentang, wajib ada pintu A (atau B untuk akses 2 pintu)

### 12.3 Deteksi nilai kabur (dari prototipe)
Ditolak sebagai nilai pasti:
```
custom · costume · after survey · as per drawing · as a pict · as at pict
sesuai gambar · menyusul · tbd
```
Kalau sales mengisi nilai seperti itu, sistem minta nilai pasti — atau minta alasan yang tercatat.

### 12.4 Peringatan (bukan penghalang)
| Peringatan | Syarat |
|---|---|
| Shaft tidak tegak | Selisih ukuran antar-lantai > 20 mm |
| COP tidak konsisten | Akses 2 pintu, COP hanya 1 |
| Data berubah setelah kunci | Ada selisih antara snapshot dan data kerja |

### 12.5 Gerbang kunci
| Aksi | Syarat |
|---|---|
| Kunci Survey Sales | Field wajib terisi |
| Kunci Final Survey | Field wajib terisi **dan** G1–G3 = "Ya" |
| Terbitkan PO | Final Survey terkunci + field wajib lengkap + alasan perubahan terisi (kalau ada perubahan) |
| Buka kunci | **Wajib** menulis alasan (masuk log) |

---

## 13. Dokumen Cetak (Output)

| # | Dokumen | Format | Sumber data |
|---|---|---|---|
| 1 | **Form Survey Sales** | A4, kop surat, 3 ttd | snapshot `sales` |
| 2 | **Form Final Survey** | A4, kop surat, 3 ttd | snapshot `final` |
| 3 | SPH — Penawaran | A4 | *(sudah ada di sistem)* |
| 4 | SPK — Kontrak | A4 berpasal | *(sudah ada di sistem)* |
| 5 | **PO Pabrik** | A4, per revisi | snapshot PO |
| 6 | **Lacak Perubahan** | A4, tabel perbandingan | semua snapshot |

**Tambahan dari prototipe yang perlu dipertahankan:** kop surat dengan 2 pilihan alamat kantor, nomor halaman, watermark DRAFT, tanda tangan + cap, dan penanda kuning untuk nilai yang berubah antar-revisi.

### 13.1 Ekspor teks
| Ekspor | Tujuan |
|---|---|
| Register SPH/SPK | Tempel ke Excel |
| `exportOrderDB` | File 00 sheet *Daftar Proyek* + File Invoice sheet *DATA ORDER* |
| `exportKOM` | Aplikasi KOM |

> Perlu konfirmasi klien: apakah ketiga ekspor ini masih dipakai, atau sudah digantikan fitur lain.

---

## 14. Matriks Integrasi — Titik Sentuh & Risiko Regresi

Ini bagian terpenting untuk jaminan **"tidak merusak sistem yang sudah jadi"**.

| # | File/Tabel lama | Jenis sentuhan | Risiko | Penanganan |
|---|---|---|---|---|
| 1 | `src/App.tsx` | **Tambah** 4 `<Route>` baru | Rendah | Hanya menambah baris; rute lama tidak diubah |
| 2 | `AppLayout.tsx` | **Tambah** 1 grup menu | Rendah | `NAV_GROUPS` hanya ditambah elemen; grup lama utuh |
| 3 | `functions/api/crm.ts` | **Tidak disentuh** | Nol | Modul baru pakai file API sendiri |
| 4 | `src/pages/SPHForm.tsx` | **Tidak disentuh** | Nol | 1.026 baris sensitif — dilarang diubah |
| 5 | `SPHList/SPKList/SPKNew/SPHPreview` | **Tidak disentuh** | Nol | — |
| 6 | Tabel `sph` | **Tambah kolom nullable** | Rendah | `id_lead`, `kode_proyek` — kosong untuk data lama |
| 7 | Tabel `crm_leads` | **Tambah kolom nullable** | Rendah | `id_proyek`, `kode_proyek`, `status_po` |
| 8 | `crm_ref_status` | **Tambah 3 baris** | Rendah | `INSERT OR IGNORE`; status lama tidak diubah |
| 9 | `crm-akses.ts` | **Tambah fungsi** | Rendah | Fungsi lama tidak diubah |
| 10 | Modul CRM (Leads/Kanban/Diskon/Dokumen/Iklan/Master) | **Tidak disentuh** | Nol | — |

### 14.1 Aturan pengamanan rilis
| # | Aturan |
|---|---|
| R1 | **Uji di preview dulu** — deploy ke branch preview, bukan langsung produksi |
| R2 | **Backup D1 sebelum migrasi** — ekspor tabel yang akan diubah |
| R3 | **Migrasi idempoten** — boleh dijalankan berulang, hasil sama |
| R4 | **Verifikasi pasca-deploy** — cek 3 alur lama (CRM, SPH, SPK) masih jalan |
| R5 | **Rilis per fase** — kalau fase bermasalah, menu fase itu dimatikan, sisanya jalan |
| R6 | **Jangan sentuh `dist/` secara manual** — selalu build dari sumber |

### 14.2 Daftar uji regresi (wajib dijalankan tiap rilis)
- [ ] Login & logout normal
- [ ] Dashboard menampilkan angka yang benar
- [ ] Buat SPH baru → tersimpan → tercetak
- [ ] Edit SPH lama → data lama tidak berubah
- [ ] Buat SPK baru → tersimpan → tercetak
- [ ] CRM: daftar lead, input lead baru, edit lead
- [ ] Kanban: kartu pindah kolom
- [ ] Meja Dokumen: antrean tampil
- [ ] Approval Diskon: pengajuan & persetujuan
- [ ] Master CRM: CRUD referensi
- [ ] Manajemen Akun (admin)
- [ ] Mobile: sidebar drawer, semua halaman baru rapi di HP

---

## 15. Risiko & Mitigasi

| # | Risiko | Dampak | Kemungkinan | Mitigasi |
|---|---|---|---|---|
| R1 | Data teknis JSON tidak bisa di-query per field | Sedang | Tinggi | Hitung diff di aplikasi (sudah terbukti); kalau perlu query, buat kolom ringkasan |
| R2 | Klien minta struktur `SEC` berubah saat pengembangan | Sedang | Tinggi | JSON = tidak perlu migrasi DB; cukup ubah katalog di frontend |
| R3 | Data lama `sph` tanpa `id_lead` | Rendah | Pasti | Kolom nullable; laporan lama tetap jalan |
| R4 | Sales mengisi nilai kabur | Sedang | Sedang | Validasi `VAGUE` sudah ada di prototipe — diadopsi |
| R5 | Foto survey membebani D1 | Sedang | Sedang | Foto ke R2/media, D1 hanya simpan key; kompres di HP (max 700 px) |
| R6 | Nomor PO bentrok | Sedang | Rendah | Nomor dari server, satu sumber |
| R7 | Regresi pada SPH/SPK | **Tinggi** | Rendah | File tidak disentuh + uji regresi wajib + rilis bertahap |
| R8 | Klien berubah pikiran soal alur | Sedang | Sedang | Rilis per fase; fase 1 sudah bisa dilihat klien |
| R9 | Perbedaan istilah prototipe vs sistem | Rendah | Tinggi | Buat tabel pemetaan istilah, minta persetujuan klien |

---

## 16. Rencana Bertahap

| Fase | Isi | Estimasi | Bisa dilihat klien |
|---|---|---|---|
| **F1** | Tabel + API + **Survey Sales** (form lengkap, upload foto, kunci) | 2 minggu | ✅ Form survey jalan |
| **F2** | **Final Survey** + mesin perbandingan + halaman Lacak | 2 minggu | ✅ Banding kontrak vs lapangan |
| **F3** | **PO Pabrik** + revisi + nomor dari server | 1,5 minggu | ✅ PO terbit & tercetak |
| **F4** | Cetak semua dokumen + ekspor + penyempurnaan mobile | 1,5 minggu | ✅ Siap pakai penuh |
| **F5** | Pelatihan & pendampingan | 1 minggu | — |
| | **TOTAL** | **8 minggu** | |

### 16.1 Urutan pengerjaan yang disarankan
1. **Minggu 1** — Konfirmasi istilah & data referensi ke klien
2. **Minggu 1–2** — Migrasi DB + API Survey
3. **Minggu 2–3** — Halaman Survey Sales + form + upload
4. **Minggu 3–4** — Uji coba Survey Sales dengan sales asli
5. **Minggu 5–6** — Final Survey + Lacak
6. **Minggu 6–7** — PO Pabrik + revisi
7. **Minggu 7–8** — Cetak, ekspor, mobile, pelatihan

---

## 17. Kriteria Penerimaan (UAT)

| # | Skenario | Hasil yang diharapkan |
|---|---|---|
| U1 | Sales buat survey dari lead CRM | Data customer terisi otomatis, tidak perlu ketik ulang |
| U2 | Sales isi 57 field + tabel lantai | Tersimpan di server, bisa dibuka dari komputer lain |
| U3 | Sales upload 7 foto dokumentasi | Foto tampil, terkompres, tidak berat |
| U4 | Sales kunci survey dengan field kosong | **Ditolak** dengan daftar field yang kurang |
| U5 | Sales kunci survey lengkap | Terkunci, tercatat siapa & kapan |
| U6 | Final Survey dibuka | Data kontrak terkunci muncul sebagai pembanding |
| U7 | Final Survey diisi nilai berbeda dari kontrak | Selisih **otomatis** ditandai |
| U8 | Final Survey dikunci tanpa G1–G3 "Ya" | **Ditolak** |
| U9 | Terbitkan PO sebelum Final Survey dikunci | **Ditolak** |
| U10 | Terbitkan PO dengan perubahan tanpa alasan | **Ditolak** |
| U11 | Terbitkan PO lengkap | Nomor PO dari server, tercetak |
| U12 | Terbitkan revisi PO | Revisi tercatat, perubahan ditandai |
| U13 | Buka kunci tanpa alasan | **Ditolak** |
| U14 | Sales buka survey sales lain | **Ditolak** (hak akses) |
| U15 | **Buat SPH & SPK seperti biasa** | **Jalan normal — tidak ada perubahan** |
| U16 | **Buka SPH/SPK lama** | **Data lama utuh** |
| U17 | Semua halaman baru di HP | Rapi, tidak ada yang terpotong |

---

## 18. Keputusan yang Sudah Disetujui

| # | Pertanyaan | Keputusan |
|---|---|---|
| P1 | Data referensi prototipe vs DB | **Sesuaikan dengan DB yang sekarang.** Sales dari tabel `sales` & `crm_ref_sales`, direktur tetap **Adhie Kurnia**. Tambah data baru: PIC PO (`Sholahuddin Asy Syamil`), surveyor (`Rohim`). Data lain dicek ulang saat implementasi |
| P2 | Jalur lama (SPH tanpa survey) ditutup? | **Dibuka.** SPH/SPK tetap bisa dibuat seperti sekarang |
| P3 | Siapa yang kunci Final Survey? | **Surveyor** — perlu peran baru di hak akses |
| P4 | Format nomor PO | **Sama dengan SPK:** `{urut}/PO/LIFT/BAI/{bulan romawi}/{tahun}` |

## 18b. Pertanyaan Terbuka untuk Klien (1 tersisa)

| # | Pertanyaan | Penjelasan |
|---|---|---|
| ~~P1–P4~~ | *(Sudah diputuskan)* | — |
| P5 | **File 00 / File Invoice / aplikasi KOM — masih dipakai atau sudah tidak perlu?** | Prototipe klien punya 3 tombol ekspor yang menyalin data ke sistem lain: (a) *Copy Register* — tempel ke Excel register SPH/SPK; (b) *Export Order DB* — copas ke file Excel "File 00" (Daftar Proyek) & "File Invoice" (DATA ORDER); (c) *Export KOM* — data teknis ke aplikasi terpisah. Kalau masih dipakai, dibangun. Kalau tidak, dilewati. |
| P6 | Foto survey disimpan berapa lama? | Menentukan kebijakan penyimpanan |
| P7 | Apakah perlu notifikasi (WhatsApp/email) saat tahap berpindah? | Fitur tambahan, di luar lingkup awal |
| P8 | Harga & termin di prototipe — sama dengan SPH/SPK yang berjalan? | Menghindari dua sumber harga berbeda |

*Pertanyaan tambahan: P6–P8 dibahas saat implementasi.*

---

## 19. Lampiran

### 19.1 Pemetaan istilah prototipe → sistem
| Prototipe | Sistem sekarang | Catatan |
|---|---|---|
| Tab `ss` Survey Sales | *(belum ada)* | Jadi menu baru |
| Tab `sph` | `/sph/new`, `/sph` | Sudah ada |
| Tab `spk` | `/spk/new`, `/spk` | Sudah ada |
| Tab `fs` Final Survey | *(belum ada)* | Jadi menu baru |
| Tab `po` PO Pabrik | *(belum ada)* | Jadi menu baru |
| Tab `lacak` | *(belum ada)* | Jadi halaman baru |
| `P.meta` | `crm_leads` + `sph` | Perlu pemetaan field |
| `P.dt` data teknis | `sph.specs` (JSON) | Skema berbeda — modul baru pakai skema prototipe |
| `P.harga` | `sph.items` (JSON) | Perlu disamakan |
| `P.snap.*` | *(belum ada)* | Tabel snapshot baru |
| `P.po.revs[]` | *(belum ada)* | Tabel `po_revisi` baru |
| `M.sales` | `crm_ref_sales` | Satu sumber |
| `KATALOG` | `sph.items` | Perlu dicek kesamaan harga |

### 19.2 Berkas yang diserahkan
| Berkas | Isi |
|---|---|
| `Data_Teknis_Terpadu_Belift.html` | Prototipe dari klien (1.951 baris, 372 KB) |
| `PRD-Survey-Sales-Final-Survey-PO.md` | Dokumen ini |

### 19.3 Ringkasan keputusan yang perlu persetujuan
1. ✅ **Setuju** modul baru dibangun sebagai bagian sistem (bukan pakai file HTML mentah)
2. ✅ **Setuju** sistem lama (CRM/SPH/SPK) tidak diubah
3. ✅ **Setuju** data teknis disimpan sebagai JSON di tabel baru
4. ⬜ **Perlu keputusan** jalur lama (SPH tanpa survey) tetap dibuka atau ditutup
5. ⬜ **Perlu keputusan** urutan fase & prioritas

---

*Dokumen ini draft untuk direview. Setelah disetujui, lanjut ke spesifikasi teknis per fase.*
