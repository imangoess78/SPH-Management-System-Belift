# Prosedur Darurat — Data SPH Hilang atau Rusak

**Dokumen ini ditulis untuk dibaca saat panik.** Ikuti dari atas ke bawah.
Jangan improvisasi.

> **Aturan nomor satu: JANGAN HAPUS APA PUN.**
> Database lama, berkas backup, log — semua ditinggal apa adanya sampai
> pemulihan selesai dan sudah diperiksa. Yang paling sering terjadi saat
> panik adalah menghapus bukti yang justru masih bisa diselamatkan.

---

## 0. Tenang dulu — cek dulu keadaannya

Sebelum apa pun, pastikan memang benar-benar rusak. Buka aplikasi, periksa
beberapa data. Kadang yang terlihat "hilang" ternyata cuma salah filter,
salah tab, atau sesi login habis.

Kalau memang rusak, lanjut.

---

## 1. Tentukan tingkat kerusakannya

| Keadaan | Artinya | Langkah |
|---|---|---|
| **A. Sebagian baris hilang/berubah**, tabel masih ada | Yang perlu dikembalikan hanya datanya | Bagian 3, pakai backup apa saja |
| **B. Tabel rusak/terhapus, database masih ada** | Skema perlu diperbaiki | Bagian 3, pakai backup bertanda ✔ |
| **C. Database hilang total** | Semua perlu dibangun ulang | Bagian 3, **wajib** backup bertanda ✔ |
| **D. Berkas foto/desain hilang** | Bukan database | Bagian 6 — **tidak bisa dipulihkan** |

Tingkat C adalah yang paling sering dibayangkan orang, dan justru di situlah
backup lama (tanpa skema) tidak berguna.

---

## 2. Lihat backup yang tersedia

```bash
cd ~/SPH-Management-System-Belift
./scripts/pulihkan-d1.sh
```

**Kalau muncul "Tidak bisa membaca daftar backup"**, berarti token Cloudflare
tidak terbaca. Perbaiki sekali saja, lalu tidak akan diminta lagi:

```bash
mkdir -p ~/.config/sph && chmod 700 ~/.config/sph
printf '%s' 'TOKEN-ANDA' > ~/.config/sph/cloudflare-token
chmod 600 ~/.config/sph/cloudflare-token
```

> **Kenapa di luar folder proyek?** Repo ini **PUBLIK**. Token yang ditaruh di
> dalam folder proyek (`.env`) akan ikut ter-push ke GitHub dan bisa dipakai
> orang lain. Tempat di atas tidak mungkin ter-commit.

Keluarannya seperti ini:

```
  2026-10-01T17-30-05-113Z.json    508 KB  ← TIDAK memuat skema, jangan dipakai untuk database hilang total
  2026-10-01T22-45-32-794Z.json    520 KB  ✔ lengkap
```

**Cara memilih:**
- Kalau keadaan **A atau B** → pakai yang **paling baru** (data paling segar)
- Kalau keadaan **C** → **wajib** yang bertanda **✔ lengkap**
- Ragu? Pakai yang ✔ paling baru. Selalu aman untuk semua keadaan.

Backup dibuat otomatis tiap hari jam **00:30 WIB** (± jam 17:30 UTC).
Backup disimpan **30 hari terakhir**, yang lebih lama dibuang sendiri.

---

## 3. Jalankan pemulihan

```bash
./scripts/pulihkan-d1.sh 2026-10-01T22-45 sph-management-db-pulihan
```

Tulis **penanda waktu** saja (boleh dipotong, tidak perlu lengkap).

Skrip ini akan:
1. Mengunduh berkas backup
2. **Memeriksa isinya dulu** — kalau kosong atau tanpa skema, berhenti
3. Membuat database tujuan
4. Mengisi skema lalu data
5. **Menghitung ulang tiap tabel dan membandingkan hasilnya**
6. Memberi tahu kalau ada yang tidak cocok

**Skrip ini SENGAJA tidak menimpa database produksi.** Hasilnya ditaruh di
database bernama lain supaya Anda sempat memeriksa dulu. Ini disengaja: kalau
ternyata backup-nya salah, masih ada jalan pulang.

Tunggu sampai muncul **`✔ PEMULIHAN UTUH`**. Kalau muncul pesan bahwa ada
tabel yang berbeda, **jangan lanjutkan** — ulangi dengan backup lain.

---

## 4. Periksa sebelum menukar

Jangan langsung percaya angka dari skrip. Lihat datanya:

```bash
npx wrangler d1 execute sph-management-db-pulihan --remote --json \
  --command "SELECT nomor_sph, status FROM sph ORDER BY nomor_sph DESC LIMIT 5"

npx wrangler d1 execute sph-management-db-pulihan --remote --json \
  --command "SELECT COUNT(*) FROM app_users"
```

Cocokkan dengan yang Anda ingat. Kalau ada yang aneh, **jangan lanjut**.

---

## 5. Tukar database

**Hanya setelah Bagian 4 cocok.**

1. Buka `wrangler.jsonc`, ubah binding database:

```jsonc
"database_name": "sph-management-db-pulihan"   // ← dari sph-management-db
```

2. Deploy ulang:

```bash
npm run build
npx wrangler pages deploy dist --project-name sph-management-clone --branch main
```

3. Buka aplikasi, periksa sekali lagi.

4. **SIMPAN database lama minimal 7 hari.** Jangan hapus. Ganti namanya saja
   kalau perlu. Hapus hanya setelah benar-benar yakin:

```bash
npx wrangler d1 delete sph-management-db --skip-confirmation
```

---

## 6. Yang TIDAK ikut dipulihkan

**Ini bagian yang paling penting untuk diketahui sebelum terjadi masalah.**

Backup berisi **database saja**. Berkas berikut ada di R2 (penyimpanan
terpisah) dan **TIDAK** ada di dalam berkas backup:

| Berkas | Lokasi | Ikut backup? |
|---|---|---|
| Foto survey lapangan | R2 `survey-photos/` | ❌ Tidak |
| Tanda tangan | R2 `signatures/` | ❌ Tidak |
| Gambar desain | R2 `design-images/` | ❌ Tidak |
| Data database (SPH, lead, survey, PO) | D1 | ✔ Ya |

Artinya: kalau database hilang dan dipulihkan, **datanya kembali tapi foto dan
tandatangan tidak**. Barisnya ada, isinya kosong.

**Pencegahan:** R2 jauh lebih jarang hilang daripada database (tidak ada
skema yang bisa rusak), tapi ini tetap celah yang perlu ditutup. Kalau ini
penting, beri tahu saya — perlu ditambahkan pencadangan berkas R2 juga.

---

## 7. Kalau tidak ada backup sama sekali

Kalau `./scripts/pulihkan-d1.sh` bilang **"Tidak ada backup sama sekali"**:

1. **Jangan hapus database apa pun.** Mungkin masih bisa diselamatkan
   sebagian dengan alat perbaikan SQLite.
2. Periksa apakah Cloudflare punya **point-in-time recovery** untuk database
   ini (ada di dashboard Cloudflare → D1 → database → Backups).
3. Hubungi yang mengurus akun Cloudflare.

Ini adalah keadaan terburuk. Kalau ini terjadi, berarti backup otomatisnya
sedang tidak berjalan — periksa jadwalnya:

```bash
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts/sph-backup-cron/schedules"
```

Harus muncul `"cron": "30 17 * * *"`. Kalau kosong, deploy ulang worker-nya:

```bash
cd workers/backup-cron && npx wrangler deploy
```

Cara paling mudah memastikan backup berjalan: lihat daftar backup, pastikan
tanggal terbarunya **kemarin atau hari ini**.

---

## 8. Periksa rutin (jangan tunggu darurat)

**Sebulan sekali**, 2 menit:

1. Jalankan `./scripts/pulihkan-d1.sh` — pastikan backup terbaru **ada** dan
   bertanda **✔ lengkap**
2. Pastikan tanggalnya **kemarin atau hari ini** (kalau tidak, backup
   otomatisnya mati — segera perbaiki)
3. Jalankan backup manual lewat tombol di aplikasi, pastikan berhasil

Backup yang tidak pernah diperiksa sama dengan tidak punya backup.

---

## Ringkasan satu layar

```
CEK     : ./scripts/pulihkan-d1.sh
PULIH   : ./scripts/pulihkan-d1.sh <waktu> sph-management-db-pulihan
PERIKSA : lihat isinya, cocokkan dengan yang diingat
TUKAR   : ubah wrangler.jsonc → deploy
SIMPAN  : database lama 7 hari, jangan buru-buru hapus

JANGAN  : hapus apa pun sebelum pemulihan diperiksa
INGAT   : foto & tandatangan TIDAK ikut backup
```
