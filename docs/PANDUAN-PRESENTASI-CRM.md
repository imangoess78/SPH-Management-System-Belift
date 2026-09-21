# Panduan Presentasi Modul CRM Sales

**URL demo:** https://crm-leads.sph-management-clone.pages.dev
**Login:** pakai akun yang sudah ada (`imangoess78@gmail.com`) — sudah diberi peran **Manager**, jadi semua lead dan semua halaman bisa dibuka.

> Catatan: peran CRM ditentukan dari pencocokan email ke tabel `crm_ref_sales`.
> Kalau ada akun lain yang perlu akses, tambahkan emailnya di **Master CRM → Sales**.

---

## 10 Lead Demo — masing-masing menonjolkan satu fitur

| # | Prospek | Kanal | Sales | Skor | Status | Fitur yang ditonjolkan |
|---|---------|-------|-------|------|--------|------------------------|
| 1 | Bpk. Hendra Wijaya | Google Ads Search | Arif | **HOT 100** | Lead Baru | Skor maksimal, lead segar belum dikontak |
| 2 | Ibu Ratna Sari | Instagram | Dewo | **WARM 60** | Kontak Pertama Dilakukan | Respons cepat 35 menit |
| 3 | Bpk. Slamet Riyadi | TikTok | Firman | **COLD 20** | Survey Dijadwalkan | Lead dingin, belum ada anggaran |
| 4 | PT Graha Karya Mandiri | Arsitek (affiliate) | Imam | **HOT 80** | Survey Selesai | Lead dari rujukan pihak ketiga |
| 5 | Ibu Maya Kusuma | Meta Ads Instagram | Izzu | **HOT 100** | SPH Terkirim | Penawaran terkirim, nilai Rp 285 jt |
| 6 | Bpk. Agus Setiawan | Google Ads PMax | Jihad | **HOT 80** | Menunggu Approval Diskon | **Diskon 3% → Sales Manager** |
| 7 | RSUD Sejahtera | Google Ads Search | Arif | **HOT 100** | Menunggu Approval Diskon | **Diskon 6,5% → Direktur Operasional** |
| 8 | Hotel Nusantara | Google Business | Dewo | **WARM 40** | Menunggu Approval Diskon | **Diskon 12% → Direktur** |
| 9 | Bpk. Tri Handoko | Meta Ads Facebook | Firman | **HOT 100** | Deal - Menunggu Dokumen | **Antrean dokumen otomatis + lewat SLA** |
| 10 | Bpk. Edi Susanto | Kontraktor (affiliate) | Imam | **HOT 80→100** | SPK Ditandatangani + DP | **Perjalanan penuh 11 langkah sampai deal** |

---

## Alur presentasi yang disarankan (±7 menit)

### 1. Halaman Leads — "semua prospek dalam satu layar"
- Tunjukkan kartu ringkasan: **HOT 7 · WARM 2 · COLD 1 · Nilai SPH kosong 0**
- Tunjuk kolom Kualifikasi: skor dihitung **otomatis** dari 5 kriteria, sales tidak bisa mengarang
- Coba filter: pilih kanal "Google Ads - Search" → tinggal 2 lead

### 2. Papan Kanban — "di mana lead nyangkut?"
- 10 lead tersebar di 8 tahap, masing-masing sudah ada **PIC** (Sales / Admin / Operasional)
- Tunjuk kolom **Menunggu Approval Diskon berisi 3 kartu** — semua sedang menunggu keputusan
- Sebutkan: kartu bisa digeser antar kolom untuk mengubah status

### 3. Approval Diskon — fitur paling meyakinkan
- Tunjukkan **3 pengajuan dengan 3 jenjang berbeda** — server yang menentukan siapa yang berwenang, bukan sales:
  - 3% → Sales Manager
  - 6,5% → Direktur Operasional
  - 12% → Direktur
- Setiap kartu menampilkan **alasan sales** dan **dampak ke margin**
- **Aksi live:** klik **Setujui** pada Bpk. Agus Setiawan → status langsung lompat ke "Deal - Menunggu Dokumen"

### 4. Meja Dokumen — bukti efek dari langkah sebelumnya
- Setelah menyetujui di langkah 3, baris baru **muncul otomatis** di sini (SLA 24 jam)
- Tunjukkan **Bpk. Tri Handoko: "Lewat 13,9 jam"** dengan baris merah → sistem memberi peringatan sendiri
- Tunjukkan 2 dokumen **"Selesai tepat waktu"** → ada catatan kepatuhan SLA

### 5. Detail Lead — jejak audit
- Buka **Bpk. Edi Susanto** → tab riwayat menampilkan **11 langkah perjalanan** dari Lead Baru sampai SPK ditandatangani, lengkap dengan **waktu dan nama pelakunya**

### 6. Efektivitas Iklan — angka yang ditunggu manajemen
- Total biaya iklan **Rp 21,0 juta** → 10 lead
- **CPL Rp 2,1 juta** · **CAC Rp 21,0 juta** · **Konversi SPH 60%** · **Konversi Deal 10%**
- **Nilai deal Rp 365 juta** · **ROAS 17,38×**
- Tunjuk tabel per kanal: **Kontraktor/Mandor CPL Rp 1,0 jt** (termurah) vs **Google Ads Search Rp 4,3 jt** (termahal) → dasar keputusan pindah anggaran

---

## Aksi live yang bisa dicoba (opsional)

**Menunjukkan validasi berjalan** — buka salah satu lead, ubah statusnya jadi `Gugur` lalu simpan **tanpa mengisi alasan**. Sistem akan menolak dengan pesan *"Alasan gugur wajib diisi"*. Isi alasannya → baru tersimpan.

**Menunjukkan pengaman nilai penawaran** — ubah status lead ke `SPH Terkirim` tanpa mengisi Nilai SPH → ditolak dengan pesan *"Nilai SPH wajib diisi"*.

Dua hal ini memperlihatkan bahwa aturan bisnis dijaga di sisi server, bukan hanya di tampilan.

---

## Kalau presentasi selesai — cara menghapus data demo

```bash
cd ~/SPH-Management-System-Belift
npx wrangler d1 execute sph-management-db --remote --file=migration/d1/hapus-demo-crm.sql
```

Hanya menghapus baris ber-id `demo-crm-`, `demo-dok-`, `demo-biaya-`.
Data asli dan tabel referensi (kanal, sales, jenjang diskon, status) **tidak** ikut terhapus.

## Kalau data demo ingin dipasang ulang

```bash
cd ~/SPH-Management-System-Belift
python3 scripts/gen-demo-crm.py     # membuat ulang file SQL
npx wrangler d1 execute sph-management-db --remote --file=migration/d1/2026-09-21-seed-demo-crm.sql
```

---

## Hal yang perlu diketahui sebelum presentasi

1. **Data demo ini masuk ke database yang sama dengan production.** Modul CRM belum ada di `sph.belift.co.id` (masih di branch `feat/crm-leads`), jadi saat ini tidak terlihat oleh pengguna production. Tapi sebelum modul ini digabung ke production, jalankan perintah hapus data demo di atas.
2. **Batas hak akses baru berlaku di tampilan.** API-nya masih hanya memeriksa "sudah login atau belum", belum memeriksa peran. Untuk pemakaian internal masih wajar, tapi sebaiknya diperketat sebelum dipakai luas.
3. **Dashboard hanya menampilkan kanal yang punya lead.** Kanal yang ada biaya iklan tapi nol lead tidak muncul sama sekali — jadi belanja iklan yang sia-sia belum kelihatan di laporan.
