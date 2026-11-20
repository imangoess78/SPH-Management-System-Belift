import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, AlertTriangle, ImagePlus, X, Check, ImageOff } from 'lucide-react';
import {
  DT_FIELDS, DT_FIELDS_TAMPIL, KELOMPOK_FIELD, DAFTAR_ADDON, JUDUL_DOKUMENTASI,
  PERTANYAAN_KESIMPULAN, OPSI_JAWAB, hitungTravelling, hitungOverhead, hitungTotalHeight,
  type DataTeknis, type Lantai, type AddOn, type BarisDokumentasi, type PekerjaanTambahan,
  type ButirKesimpulan, type FotoDok, type FieldDef,
} from '@/lib/survey-types';

export const KOSONG = '__kosong__';

export const bacaTeks = (dt: DataTeknis, k: string): string => {
  const v = dt[k];
  return v === null || v === undefined || Array.isArray(v) ? '' : String(v);
};

/** Lampiran gambar milik satu spec / remark. */
export const bacaFoto = (dt: DataTeknis, k: string): FotoDok[] => {
  const v = dt['gambar:' + k];
  return Array.isArray(v) ? (v as FotoDok[]) : [];
};

/** Note (keterangan) milik satu spec. */
export const bacaNote = (dt: DataTeknis, k: string): string => bacaTeks(dt, 'note:' + k);

export const bacaLantai = (dt: DataTeknis): Lantai[] => (dt.lantai as Lantai[]) || [];

export const bacaAddon = (dt: DataTeknis): AddOn[] =>
  (dt.addon as AddOn[])?.length ? (dt.addon as AddOn[]) : DAFTAR_ADDON.map(a => ({ ...a }));

/** Data Teknis kosong dengan add-on & tabel lantai awal. */
export function dtKosong(): DataTeknis {
  const dt: DataTeknis = {};
  for (const f of DT_FIELDS) dt[f.key] = '';
  dt.lantai = [];
  dt.addon = DAFTAR_ADDON.map(a => ({ ...a }));
  dt.remarks = '';
  return dt;
}

export function dokumentasiKosong(): BarisDokumentasi[] {
  return JUDUL_DOKUMENTASI.map((judul, i) => ({ no: i + 1, judul, ada: false, foto: [] }));
}

export function kesimpulanKosong(): ButirKesimpulan[] {
  return PERTANYAAN_KESIMPULAN.map(q => ({ q, jawab: '', alasan: '' }));
}

export function pekerjaanKosong(): PekerjaanTambahan[] {
  return [{ nama: '', on: false, ket: '' }];
}

// ── Unggah gambar (dipakai dokumentasi, spec, dan remark) ────
//  Bucket khusus `survey-photos` (terdaftar di functions/api/media.ts).
//  Yang disimpan adalah KUNCI mentah, bukan URL jadi — URL dibentuk saat
//  ditampilkan supaya bisa dipakai juga di dokumen cetak.
async function unggahFoto(file: File): Promise<FotoDok> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${crypto.randomUUID()}.${ext || 'jpg'}`;
  const fd = new FormData();
  fd.append('file', file);
  fd.append('bucket', 'survey-photos');
  fd.append('path', path);
  const r = await fetch('/api/media', { method: 'POST', body: fd, credentials: 'same-origin' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error || 'Gagal mengunggah gambar');
  return { key: `recovery/2026-08-19/survey-photos/${path}`, nama: file.name };
}

/**
 * URL tampil untuk satu gambar.
 *
 * `key` bisa berupa kunci R2 mentah (hasil unggah di sini) ATAU URL siap pakai
 * dari Master Data (`/api/media?key=…`). Keduanya harus lolos apa adanya —
 * sebelumnya semua dianggap kunci mentah, sehingga gambar yang diambil dari
 * Master Data akan dibungkus dua kali dan gagal tampil.
 */
export const urlFoto = (key: string): string => {
  if (!key) return '';
  if (key.startsWith('/api/media') || /^(https?:)?\/\//.test(key)) return key;
  return `/api/media?key=${encodeURIComponent(key)}`;
};

/** Batas jumlah foto per slot dokumentasi. */
export const MAKS_FOTO_DOKUMENTASI = 5;

// ── Database Desain: opsi gambar Plafon & Lantai Cabin ──────
//  Diambil sekali per muat halaman. Kalau endpoint menolak (403/401),
//  panel TIDAK boleh ikut mati — cukup tampilkan keterangan.
interface OpsiDesain { id: string; nama: string; img: string; kategori: string }

/**
 * Katalog Master Data (tabel `design_items`) dalam dua bentuk:
 *   peta  → gambar per kategori (Plafon / Lantai Cabin, lampiran spec)
 *   warna → daftar NAMA warna (kategori 'Warna') untuk field 'warna'
 *
 * Warna sengaja dipisah: baris warna tidak punya `image_url`, sedangkan
 * `peta` hanya menyimpan baris bergambar. Dulu baris tanpa gambar dibuang
 * seluruhnya, jadi warna dari Master Data tidak akan pernah muncul.
 */
interface KatalogMaster {
  peta: Record<string, OpsiDesain[]>;
  /**
   * Warna dikelompokkan menurut kategori asalnya di Master Data, supaya staff
   * bisa melihat dari mana sebuah warna berasal. Urutan kategori: 'Warna'
   * lebih dulu (kategori khusus warna), lalu 'Struktur'.
   */
  warna: KelompokWarna[];
  /** Daftar nama warna datar — dipakai untuk cek nilai lama & validasi. */
  namaWarnaSemua: string[];
}

interface KelompokWarna { kategori: string; warna: string[] }

let cacheDesain: KatalogMaster | null = null;

/** Kategori Master Data yang dipakai sebagai daftar pilihan warna. */
export const KATEGORI_WARNA = 'Warna';

/**
 * Katalog warna yang SUDAH ADA di Master Data proyek ini ada di kategori
 * 'Struktur' (Struktur Black, Struktur Rose Gold, … — 8 warna, semuanya
 * bergambar, dipakai juga oleh generator SPH untuk "Struktur warna").
 * Kategori 'Warna' disediakan sebagai tempat khusus warna bila staff ingin
 * memisahkan; keduanya dibaca supaya dropdown langsung berisi, bukan kosong.
 */
export const KATEGORI_WARNA_STRUKTUR = 'Struktur';

/** "Struktur Rose Gold" → "Rose Gold" (prefix kategori dibuang). */
export const namaWarna = (nama: string): string => nama.replace(/^struktur\s+/i, '').trim();

/**
 * Susun katalog Master Data dari baris `design_items`.
 *
 * Fungsi murni supaya bisa diuji tanpa memasang komponen (dan tanpa Radix).
 * Aturan penting: baris kategori 'Warna' TIDAK butuh `image_url`. Dulu semua
 * baris tanpa gambar dibuang, sehingga warna tidak pernah muncul di dropdown
 * walau sudah diisi di Master Data.
 */
export function susunKatalog(rows: Array<Record<string, unknown>>): KatalogMaster {
  const peta: Record<string, OpsiDesain[]> = {};
  const kelompok = new Map<string, string[]>();
  const tambahWarna = (kategori: string, n: string) => {
    if (!n) return;
    const isi = kelompok.get(kategori) || [];
    // Cegah dobel HANYA di dalam kategori yang sama; warna bernama sama dari
    // kategori berbeda tetap ditampilkan di kelompoknya masing-masing supaya
    // asal-usulnya tidak tersembunyi.
    if (!isi.includes(n)) isi.push(n);
    kelompok.set(kategori, isi);
  };

  for (const row of rows || []) {
    const kat = String(row.category || '').trim();
    if (!kat) continue;
    const nama = String(row.name || row.sku || '').trim();
    if (!nama) continue;
    const katKecil = kat.toLowerCase();

    if (katKecil === KATEGORI_WARNA.toLowerCase()) {
      tambahWarna(kat, nama);
      continue; // baris warna murni tidak dipakai sebagai gambar
    }

    const url = String(row.image_url || '').trim();
    if (!url) continue;
    (peta[kat] ||= []).push({ id: String(row.id ?? url), nama, img: url, kategori: kat });

    // Warna dari katalog Struktur tetap jadi pilihan, dan tetap dipakai
    // sebagai gambar (kategori ini bergambar).
    if (katKecil === KATEGORI_WARNA_STRUKTUR.toLowerCase()) tambahWarna(kat, namaWarna(nama));
  }

  // Urutan kelompok tetap: 'Warna' dulu, lalu 'Struktur', lalu kategori lain
  // (kalau nanti staff memakai kategori tambahan). Nama kategori diambil dari
  // ejaan asli di database, bukan versi lowercase.
  const prioritas = (k: string) => {
    const kecil = k.toLowerCase();
    if (kecil === KATEGORI_WARNA.toLowerCase()) return 0;
    if (kecil === KATEGORI_WARNA_STRUKTUR.toLowerCase()) return 1;
    return 2;
  };
  const warna = [...kelompok.entries()]
    .map(([kategori, isi]) => ({ kategori, warna: [...isi].sort((a, b) => a.localeCompare(b, 'id')) }))
    .filter(k => k.warna.length > 0)
    .sort((a, b) => prioritas(a.kategori) - prioritas(b.kategori) || a.kategori.localeCompare(b.kategori, 'id'));

  const namaWarnaSemua = [...new Set(warna.flatMap(k => k.warna))].sort((a, b) => a.localeCompare(b, 'id'));
  return { peta, warna, namaWarnaSemua };
}

function useKatalogMaster(): { peta: Record<string, OpsiDesain[]>; warna: KelompokWarna[]; namaWarnaSemua: string[]; galat: string } {
  const [katalog, setKatalog] = useState<KatalogMaster>(cacheDesain || { peta: {}, warna: [], namaWarnaSemua: [] });
  const [galat, setGalat] = useState('');

  useEffect(() => {
    if (cacheDesain) return;
    let aktif = true;
    fetch('/api/data?table=design_items')
      .then(async r => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error((j as { error?: string }).error || `HTTP ${r.status}`);
        return j as { data?: Array<Record<string, unknown>> };
      })
      .then(j => {
        if (!aktif) return;
        cacheDesain = susunKatalog(j.data || []);
        setKatalog(cacheDesain);
      })
      .catch(e => { if (aktif) setGalat(e instanceof Error ? e.message : 'Gagal memuat katalog desain'); });
    return () => { aktif = false; };
  }, []);

  return { peta: katalog.peta, warna: katalog.warna, namaWarnaSemua: katalog.namaWarnaSemua, galat };
}

/** Pemilih gambar dari Database Desain (Plafon / Lantai Cabin). */
function PemilihDesain({
  f, nilai, urlTerpilih, opsi, galat, bacaSaja, pilih,
}: {
  f: FieldDef;
  nilai: string;
  urlTerpilih: string;
  opsi: OpsiDesain[];
  galat: string;
  bacaSaja?: boolean;
  pilih: (nama: string, img: string) => void;
}) {
  const [buka, setBuka] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {urlTerpilih ? (
          <img src={urlTerpilih} alt={nilai} className="w-12 h-12 rounded border object-cover shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded border grid place-items-center bg-muted/40 shrink-0">
            <ImageOff className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm truncate">{nilai || <span className="text-muted-foreground">Belum dipilih</span>}</p>
          {!bacaSaja && (
            <Button type="button" size="sm" variant="outline" className="h-7 mt-1 text-xs" onClick={() => setBuka(v => !v)}>
              {buka ? 'Tutup' : 'Pilih gambar'}
            </Button>
          )}
        </div>
      </div>

      {buka && !bacaSaja && (
        <div className="rounded-md border p-2 max-h-56 overflow-y-auto">
          {galat && <p className="text-xs text-destructive">Katalog desain tidak bisa dimuat: {galat}</p>}
          {!galat && opsi.length === 0 && <p className="text-xs text-muted-foreground">Belum ada gambar untuk kategori ini.</p>}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {opsi.map(o => {
              const aktif = nilai === o.nama;
              return (
                <button type="button" key={o.id} onClick={() => { pilih(o.nama, o.img); setBuka(false); }}
                  className={`relative rounded border overflow-hidden text-left ${aktif ? 'ring-2 ring-primary' : ''}`}>
                  <img src={o.img} alt={o.nama} className="w-full h-16 object-cover" />
                  <span className="block px-1 py-0.5 text-[10px] leading-tight truncate">{o.nama}</span>
                  {aktif && <span className="absolute top-0.5 right-0.5 bg-primary text-white rounded-full p-0.5"><Check className="w-2.5 h-2.5" /></span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Baris lampiran gambar untuk satu spec / remark. */
function LampiranGambar({
  daftar, bacaSaja, ubah, master = [], galatMaster = '',
}: {
  daftar: FotoDok[];
  bacaSaja?: boolean;
  ubah: (f: FotoDok[]) => void;
  /** Gambar hasil unggah manual di Master Data → Database Desain. */
  master?: OpsiDesain[];
  galatMaster?: string;
}) {
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');
  const [buka, setBuka] = useState(false);
  const [kategori, setKategori] = useState('');

  const tambah = async (files: FileList | null) => {
    if (!files?.length) return;
    setSibuk(true); setGalat('');
    try {
      const baru: FotoDok[] = [];
      for (const f of Array.from(files)) baru.push(await unggahFoto(f));
      ubah([...daftar, ...baru]);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal mengunggah gambar');
    } finally { setSibuk(false); }
  };

  // Ambil gambar dari Master Data: yang disimpan adalah URL siap pakai, bukan
  // kunci R2 — urlFoto() sudah menangani dua bentuk sekaligus.
  const ambilMaster = (o: OpsiDesain) => {
    if (daftar.some(d => d.key === o.img)) { setBuka(false); return; }
    ubah([...daftar, { key: o.img, nama: o.nama }]);
    setBuka(false);
  };

  const kategoriAda = useMemo(
    () => Array.from(new Set(master.map(m => m.kategori).filter(Boolean))).sort(),
    [master],
  );
  const tampil = kategori ? master.filter(m => m.kategori === kategori) : master;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {daftar.map((f, i) => (
          <div key={f.key + i} className="relative group">
            <img src={urlFoto(f.key)} alt={f.nama} className="w-10 h-10 rounded border object-cover" />
            {!bacaSaja && (
              <button type="button" onClick={() => ubah(daftar.filter((_, j) => j !== i))}
                className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-destructive text-white text-[9px] leading-none opacity-0 group-hover:opacity-100"
                title="Hapus gambar">×</button>
            )}
          </div>
        ))}
        {!bacaSaja && (
          <>
            <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px] font-normal"
              onClick={() => setBuka(v => !v)}>
              <ImagePlus className="w-3 h-3 mr-1" />
              {buka ? 'Tutup' : 'Master Data'}
            </Button>
            <label className="inline-flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer rounded border border-dashed px-1.5 py-1 hover:border-primary">
              {sibuk ? 'Mengunggah…' : 'Unggah'}
              <input type="file" accept="image/*" multiple className="hidden" disabled={sibuk}
                onChange={e => { void tambah(e.target.files); e.currentTarget.value = ''; }} />
            </label>
          </>
        )}
      </div>

      {buka && !bacaSaja && (
        <div className="rounded-md border p-2 space-y-2 bg-muted/20">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">Pilih gambar hasil upload manual di Master Data</p>
            <select value={kategori} onChange={e => setKategori(e.target.value)}
              className="h-7 rounded border bg-background px-1.5 text-[11px]">
              <option value="">Semua kategori</option>
              {kategoriAda.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          {galatMaster && <p className="text-[11px] text-destructive">Master Data tidak bisa dimuat: {galatMaster}</p>}
          {!galatMaster && tampil.length === 0 && (
            <p className="text-[11px] text-muted-foreground">
              Belum ada gambar. Unggah dulu di <strong>Master Data → Database Desain</strong>.
            </p>
          )}
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-52 overflow-y-auto">
            {tampil.map(o => {
              const terpakai = daftar.some(d => d.key === o.img);
              return (
                <button type="button" key={o.id} onClick={() => ambilMaster(o)} disabled={terpakai}
                  className={`relative rounded border overflow-hidden text-left ${terpakai ? 'opacity-40' : 'hover:ring-2 hover:ring-primary'}`}>
                  <img src={urlFoto(o.img)} alt={o.nama} className="w-full h-12 object-cover" />
                  <span className="block px-1 py-0.5 text-[9px] leading-tight truncate">{o.nama}</span>
                  {terpakai && <span className="absolute top-0.5 right-0.5 bg-primary text-white rounded-full p-0.5"><Check className="w-2.5 h-2.5" /></span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {galat && <p className="text-[11px] text-destructive">{galat}</p>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  1. DATA TEKNIS — per kelompok, tiap spec punya Note + gambar
// ════════════════════════════════════════════════════════════
export function DataTeknisPanel({
  dt, ubah, bacaSaja, wajibKosong = [],
}: {
  dt: DataTeknis;
  ubah: (k: string, v: string | FotoDok[]) => void;
  bacaSaja?: boolean;
  wajibKosong?: string[];
}) {
  const set = (k: string, v: string | FotoDok[]) => { if (!bacaSaja) ubah(k, v); };
  const { peta, warna, namaWarnaSemua, galat } = useKatalogMaster();

  // Seluruh gambar Master Data, apa pun kategorinya — dipakai tombol
  // "Master Data" pada lampiran tiap spec dan Remarks.
  const master = useMemo(() => Object.values(peta).flat(), [peta]);

  // Travelling, Overhead & Total Height dihitung ulang setiap kali pit atau
  // tinggi lantai berubah, lalu DITULIS ke dt supaya ikut tersimpan, tercetak,
  // dan terbaca mesin diff — bukan sekadar tampilan.
  //
  // Overhead hanya ditulis bila tabel lantai sudah terisi; kalau tidak, nilai
  // manual dokumen lama dibiarkan apa adanya.
  const travel = hitungTravelling(bacaLantai(dt));
  const oh = hitungOverhead(bacaLantai(dt));
  const total = hitungTotalHeight(dt);
  const travelTeks = travel ? String(travel) : '';
  const ohTeks = oh ? String(oh) : '';
  const totalTeks = total ? String(total) : '';

  useEffect(() => {
    if (bacaSaja) return;
    if (bacaTeks(dt, 'travelling') !== travelTeks) ubah('travelling', travelTeks);
    if (ohTeks && bacaTeks(dt, 'overhead') !== ohTeks) ubah('overhead', ohTeks);
    if (bacaTeks(dt, 'totalHeight') !== totalTeks) ubah('totalHeight', totalTeks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [travelTeks, ohTeks, totalTeks, bacaSaja]);

  const jumlahLantai = bacaLantai(dt).length;

  return (
    <div className="space-y-7">
      {KELOMPOK_FIELD.map(kel => {
        const field = DT_FIELDS_TAMPIL.filter(f => f.kel === kel);
        if (!field.length) return null;
        return (
          <div key={kel}>
            <h3 className="text-sm font-semibold mb-3 pb-1.5 border-b">{kel}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {field.map(f => {
                const nilai = bacaTeks(dt, f.key);
                const kurang = wajibKosong.includes(f.key);
                const note = bacaNote(dt, f.key);
                const gambar = bacaFoto(dt, f.key);
                const imgDesain = bacaTeks(dt, 'imgdesain:' + f.key);
                const hitung = f.jenis === 'hitung';

                return (
                  <div key={f.key} className="rounded-lg border p-3 space-y-2">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      {f.label}
                      {f.satuan && <span className="font-normal opacity-70">({f.satuan})</span>}
                      {kurang && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                    </label>

                    {/* Nilai */}
                    {f.jenis === 'pilih' ? (
                      // Nilai lama yang tidak ada lagi di daftar opsi (mis. Bahan
                      // Cabin "Kombinasi SS + Kaca") tetap DITAMPILKAN sebagai
                      // pilihan "lama". Tanpa ini, Select tampak kosong dan
                      // seolah data hilang — padahal isinya masih tersimpan.
                      (() => {
                        const opsi = f.opsi || [];
                        const asing = !!nilai && !opsi.includes(nilai);
                        return (
                          <Select value={nilai || KOSONG} onValueChange={v => set(f.key, v === KOSONG ? '' : v)} disabled={bacaSaja}>
                            <SelectTrigger className={kurang ? 'border-amber-400' : ''}><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={KOSONG}>—</SelectItem>
                              {asing && <SelectItem value={nilai}>{nilai} (lama)</SelectItem>}
                              {opsi.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        );
                      })()
                    ) : f.jenis === 'warna' ? (
                      // Warna dipilih dari Master Data kategori 'Warna' — bukan
                      // teks bebas, supaya ejaan warna sama antara Final Survey
                      // dan PO pabrik.
                      //
                      // Placeholder TIDAK boleh bernilai KOSONG: komponen Select
                      // mencocokkan `value` dengan placeholder, jadi placeholder
                      // bernilai KOSONG tidak pernah tampil (yang muncul justru
                      // label item "—") — akibatnya daftar warna yang masih
                      // kosong terlihat seperti dropdown biasa. Saat Master Data
                      // kosong, item "—" tidak dirender supaya placeholder
                      // benar-benar muncul dan menjelaskan cara mengisinya.
                      (() => {
                        // Nilai lama yang tidak ada di Master Data tetap bisa
                        // ditampilkan, tapi hanya dibandingkan dengan daftar
                        // datar (bukan per kelompok).
                        const asing = !!nilai && !namaWarnaSemua.includes(nilai);
                        const kosongWarna = warna.length === 0;
                        return (
                          <Select value={nilai || KOSONG} onValueChange={v => set(f.key, v === KOSONG ? '' : v)} disabled={bacaSaja}>
                            <SelectTrigger className={kurang ? 'border-amber-400' : ''}>
                              <SelectValue placeholder={kosongWarna ? 'Belum ada warna — isi di Master Data' : 'Pilih warna dari Master Data'} />
                            </SelectTrigger>
                            <SelectContent>
                              {asing && <SelectItem value={nilai}>{nilai} (lama)</SelectItem>}
                              {!kosongWarna && <SelectItem value={KOSONG}>—</SelectItem>}
                              {/* Dikelompokkan per kategori asal: "Color dari
                                  Struktur" dan "Color dari Warna" — staff bisa
                                  melihat warna itu berasal dari kategori mana. */}
                              {warna.map(kel => (
                                <SelectGroup key={kel.kategori}>
                                  <SelectLabel className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    Color dari {kel.kategori}
                                  </SelectLabel>
                                  {kel.warna.map(w => <SelectItem key={kel.kategori + '|' + w} value={w}>{w}</SelectItem>)}
                                </SelectGroup>
                              ))}
                              {kosongWarna && (
                                <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
                                  Daftar warna belum diisi. Staff mengisi lewat Master Data → kategori Warna.
                                </p>
                              )}
                            </SelectContent>
                          </Select>
                        );
                      })()
                    ) : f.jenis === 'desain' ? (
                      <PemilihDesain
                        f={f} nilai={nilai} urlTerpilih={imgDesain}
                        opsi={peta[f.kategori || ''] || []} galat={galat} bacaSaja={bacaSaja}
                        pilih={(nama, img) => { set(f.key, nama); set('imgdesain:' + f.key, img); }}
                      />
                    ) : hitung ? (
                      <div>
                        <Input value={nilai} readOnly disabled placeholder="—" className="bg-muted/40" />
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {f.key === 'travelling'
                            ? (jumlahLantai > 1
                              ? `Otomatis: total ${jumlahLantai} lantai − lantai terakhir (tanpa pit)`
                              : 'Isi tabel Lantai dulu — butuh minimal 2 lantai')
                            : f.key === 'overhead'
                              ? (jumlahLantai > 0
                                ? 'Otomatis: tinggi lantai terakhir'
                                : 'Isi tabel Lantai dulu — pakai tinggi lantai terakhir')
                              : 'Pit + Travelling + Overhead'}
                        </p>
                      </div>
                    ) : (
                      <Input
                        value={nilai}
                        onChange={e => set(f.key, e.target.value)}
                        placeholder={f.hint || ''}
                        disabled={bacaSaja}
                        className={kurang ? 'border-amber-400' : ''}
                      />
                    )}

                    {/* Note per spec */}
                    {!hitung && (
                      <Input
                        value={note}
                        onChange={e => set('note:' + f.key, e.target.value)}
                        placeholder={f.catatan ? `Note: ${f.catatan}` : 'Note'}
                        disabled={bacaSaja}
                        className="h-8 text-xs"
                      />
                    )}

                    {/* Lampiran gambar per spec */}
                    {!hitung && (
                      <LampiranGambar daftar={gambar} bacaSaja={bacaSaja} master={master} galatMaster={galat}
                        ubah={f2 => set('gambar:' + f.key, f2)} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Remarks — teks bebas + gambar, keduanya bisa diubah */}
      <div>
        <h3 className="text-sm font-semibold mb-3 pb-1.5 border-b">Remarks</h3>
        <div className="rounded-lg border p-3 space-y-2">
          <textarea
            value={bacaTeks(dt, 'remarks')}
            onChange={e => set('remarks', e.target.value)}
            disabled={bacaSaja}
            rows={3}
            placeholder="Catatan tambahan / kesepakatan lapangan…"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          />
          <LampiranGambar daftar={bacaFoto(dt, 'remarks')} bacaSaja={bacaSaja} master={master} galatMaster={galat}
            ubah={f2 => set('gambar:remarks', f2)} />
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  2. TABEL LANTAI
// ════════════════════════════════════════════════════════════
export function LantaiPanel({
  lantai, ubah, bacaSaja,
}: {
  lantai: Lantai[];
  ubah: (l: Lantai[]) => void;
  bacaSaja?: boolean;
}) {
  const set = (i: number, k: keyof Lantai, v: string) => {
    const baru = lantai.map((r, j) => j === i ? { ...r, [k]: v } : r);
    ubah(baru);
  };
  const travel = hitungTravelling(lantai);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Tabel Lantai</h3>
        {!bacaSaja && (
          <Button size="sm" variant="outline" onClick={() => ubah([...lantai, { no: lantai.length + 1, lantai: '', tinggi: '', door: '', finishing: '' }])}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Tambah lantai
          </Button>
        )}
      </div>
      {lantai.length === 0 ? (
        <p className="text-sm text-muted-foreground py-3">Belum ada baris lantai.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-2">Lantai</th>
                <th className="p-2">Tinggi (mm)</th>
                <th className="p-2">Bukaan Pintu</th>
                <th className="p-2">Finishing</th>
                {!bacaSaja && <th className="p-2 w-12" />}
              </tr>
            </thead>
            <tbody>
              {lantai.map((r, i) => (
                <tr key={i} className="border-t">
                  {(['lantai', 'tinggi', 'door', 'finishing'] as const).map(k => (
                    <td key={k} className="p-1.5">
                      <Input value={r[k] || ''} onChange={e => set(i, k, e.target.value)} disabled={bacaSaja} className="h-8" />
                    </td>
                  ))}
                  {!bacaSaja && (
                    <td className="p-1.5">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                        onClick={() => ubah(lantai.filter((_, j) => j !== i).map((x, j) => ({ ...x, no: j + 1 })))}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Travelling Height = jumlah seluruh tinggi lantai − tinggi lantai terakhir (pit tidak ikut):{' '}
        <strong>{travel ? travel + ' mm' : '—'}</strong>
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  3. ADD-ON
// ════════════════════════════════════════════════════════════
export function AddOnPanel({
  addon, ubah, bacaSaja,
}: {
  addon: AddOn[];
  ubah: (a: AddOn[]) => void;
  bacaSaja?: boolean;
}) {
  const set = (i: number, patch: Partial<AddOn>) => ubah(addon.map((r, j) => j === i ? { ...r, ...patch } : r));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Add-on</h3>
        {!bacaSaja && (
          <Button size="sm" variant="outline" onClick={() => ubah([...addon, { kode: '', nama: '', idn: '', on: false, ada: false, fotoLink: '' }])}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Tambah add-on
          </Button>
        )}
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="p-2 w-28">Kode</th>
              <th className="p-2">Nama</th>
              <th className="p-2 w-20 text-center">Dipesan</th>
              <th className="p-2 w-20 text-center">Sudah Ada</th>
              <th className="p-2 w-56">Tautan Foto</th>
              {!bacaSaja && <th className="p-2 w-12" />}
            </tr>
          </thead>
          <tbody>
            {addon.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="p-1.5">
                  <Input value={r.kode} onChange={e => set(i, { kode: e.target.value })} disabled={bacaSaja} className="h-8 font-mono text-xs" placeholder="—" />
                </td>
                <td className="p-1.5">
                  <Input value={r.nama} onChange={e => set(i, { nama: e.target.value })} disabled={bacaSaja} className="h-8" />
                  {r.idn && <span className="text-[10px] text-muted-foreground">{r.idn}</span>}
                </td>
                <td className="p-1.5 text-center">
                  <input type="checkbox" checked={r.on} disabled={bacaSaja} onChange={e => set(i, { on: e.target.checked })} className="w-4 h-4 accent-primary" />
                </td>
                <td className="p-1.5 text-center">
                  <input type="checkbox" checked={r.ada} disabled={bacaSaja} onChange={e => set(i, { ada: e.target.checked })} className="w-4 h-4 accent-primary" />
                </td>
                <td className="p-1.5">
                  <Input value={r.fotoLink} onChange={e => set(i, { fotoLink: e.target.value })} disabled={bacaSaja} className="h-8 text-xs" placeholder="https://…" />
                </td>
                {!bacaSaja && (
                  <td className="p-1.5">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                      onClick={() => ubah(addon.filter((_, j) => j !== i))}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  4. DOKUMENTASI — 24 slot, unggah foto lewat /api/media
// ════════════════════════════════════════════════════════════
export function DokumentasiPanel({
  baris, ubah, bacaSaja,
}: {
  baris: BarisDokumentasi[];
  ubah: (b: BarisDokumentasi[]) => void;
  bacaSaja?: boolean;
}) {
  const [galat, setGalat] = useState('');
  const set = (i: number, patch: Partial<BarisDokumentasi>) => ubah(baris.map((r, j) => j === i ? { ...r, ...patch } : r));

  const tambahFoto = async (i: number, files: FileList | null) => {
    if (!files?.length) return;
    // Batas 5 foto per slot (permintaan klien). Lebihnya dipotong, dan
    // pengguna diberi tahu — bukan dibuang diam-diam.
    const sisa = MAKS_FOTO_DOKUMENTASI - (baris[i].foto?.length || 0);
    if (sisa <= 0) { setGalat(`Maksimal ${MAKS_FOTO_DOKUMENTASI} foto per baris.`); return; }

    const dipilih = Array.from(files);
    if (dipilih.length > sisa) setGalat(`Hanya ${sisa} foto lagi yang bisa ditambahkan (maksimal ${MAKS_FOTO_DOKUMENTASI}).`);
    else setGalat('');

    try {
      const baru: FotoDok[] = [];
      for (const f of dipilih.slice(0, sisa)) baru.push(await unggahFoto(f));
      set(i, { foto: [...baris[i].foto, ...baru], ada: true });
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal mengunggah foto');
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Unggah foto langsung dari perangkat — maksimal <strong>{MAKS_FOTO_DOKUMENTASI} foto</strong> per baris.
        Foto ikut tercetak di dokumen Final Survey.
      </p>
      {galat && <p className="text-xs text-destructive">{galat}</p>}
      {baris.map((r, i) => (
        <div key={i} className="flex flex-wrap items-center gap-3 p-2.5 rounded-md border">
          <span className="w-6 text-xs text-muted-foreground text-right shrink-0">{r.no}.</span>
          <span className="flex-1 min-w-[180px] text-sm">{r.judul}</span>
          <label className="flex items-center gap-1.5 text-xs whitespace-nowrap">
            <input type="checkbox" checked={r.ada} disabled={bacaSaja}
              onChange={e => set(i, { ada: e.target.checked })} className="w-4 h-4 accent-primary" />
            Ada
          </label>
          {!bacaSaja && (
            <input type="file" accept="image/*" multiple
              disabled={(r.foto?.length || 0) >= MAKS_FOTO_DOKUMENTASI}
              title={(r.foto?.length || 0) >= MAKS_FOTO_DOKUMENTASI
                ? `Maksimal ${MAKS_FOTO_DOKUMENTASI} foto — hapus salah satu untuk menambah`
                : 'Unggah foto (bisa beberapa sekaligus)'}
              onChange={e => tambahFoto(i, e.target.files)}
              className="text-xs max-w-[190px] file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs disabled:opacity-50" />
          )}
          <span className={`text-xs w-14 text-right ${(r.foto?.length || 0) >= MAKS_FOTO_DOKUMENTASI ? 'text-amber-600 font-semibold' : 'text-muted-foreground'}`}>
            {r.foto?.length || 0}/{MAKS_FOTO_DOKUMENTASI}
          </span>
          {(r.foto?.length || 0) > 0 && (
            <div className="flex gap-1.5 w-full pl-9">
              {r.foto.map((f, k) => (
                <div key={k} className="relative group">
                  <img src={urlFoto(f.key)} alt={r.judul}
                    className="w-14 h-14 object-cover rounded border" />
                  {!bacaSaja && (
                    <button type="button"
                      onClick={() => set(i, { foto: r.foto.filter((_, j) => j !== k) })}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-white text-[10px] leading-none opacity-0 group-hover:opacity-100"
                      title="Hapus foto">×</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  5. PEKERJAAN TAMBAHAN
// ════════════════════════════════════════════════════════════
export function PekerjaanPanel({
  baris, ubah, bacaSaja,
}: {
  baris: PekerjaanTambahan[];
  ubah: (b: PekerjaanTambahan[]) => void;
  bacaSaja?: boolean;
}) {
  const set = (i: number, patch: Partial<PekerjaanTambahan>) => ubah(baris.map((r, j) => j === i ? { ...r, ...patch } : r));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Pekerjaan Tambahan</h3>
        {!bacaSaja && (
          <Button size="sm" variant="outline" onClick={() => ubah([...baris, { nama: '', on: false, ket: '' }])}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Tambah
          </Button>
        )}
      </div>
      {baris.map((r, i) => (
        <div key={i} className="flex flex-wrap items-center gap-3 p-2.5 rounded-md border">
          <input type="checkbox" checked={r.on} disabled={bacaSaja} onChange={e => set(i, { on: e.target.checked })} className="w-4 h-4 accent-primary" />
          <Input value={r.nama} onChange={e => set(i, { nama: e.target.value })} disabled={bacaSaja} placeholder="Nama pekerjaan" className="h-8 flex-1 min-w-[150px]" />
          <Input value={r.ket} onChange={e => set(i, { ket: e.target.value })} disabled={bacaSaja} placeholder="Keterangan" className="h-8 flex-[2] min-w-[180px]" />
          {!bacaSaja && (
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => ubah(baris.filter((_, j) => j !== i))}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  6. KESIMPULAN
// ════════════════════════════════════════════════════════════
export function KesimpulanPanel({
  baris, ubah, bacaSaja,
}: {
  baris: ButirKesimpulan[];
  ubah: (b: ButirKesimpulan[]) => void;
  bacaSaja?: boolean;
}) {
  const set = (i: number, patch: Partial<ButirKesimpulan>) => ubah(baris.map((r, j) => j === i ? { ...r, ...patch } : r));
  return (
    <div className="space-y-2">
      {baris.map((r, i) => (
        <div key={i} className="grid gap-2 p-2.5 rounded-md border sm:grid-cols-[1fr_170px_1fr] items-center">
          <span className="text-sm">{i + 1}. {r.q}</span>
          <Select value={r.jawab || KOSONG} onValueChange={v => set(i, { jawab: v === KOSONG ? '' : v })} disabled={bacaSaja}>
            <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={KOSONG}>—</SelectItem>
              {OPSI_JAWAB.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input value={r.alasan} onChange={e => set(i, { alasan: e.target.value })} disabled={bacaSaja} placeholder="Alasan / catatan" className="h-8" />
        </div>
      ))}
    </div>
  );
}
