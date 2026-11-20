/**
 * Editor SPK — panel penyuntingan dokumen SPK.
 *
 * KENAPA PANEL INI ADA
 * Isi SPK berbeda antar proyek: termin bisa 3 s/d 9, ada klausul tambahan,
 * ada catatan khusus. Dulu semua itu hanya bisa diubah developer. Panel ini
 * memberi sales tiga hal yang tidak mengubah data form:
 *
 *   1. Kertas & margin — A4/A5/Letter/Legal dan margin 5–60 mm.
 *   2. Identitas pasal — judul pasal bisa diganti.
 *   3. Isi pasal — teks asli hasil susunan form disunting WYSIWYG; hasil
 *      suntingan MENGGANTIKAN isi pasal itu (bukan ditambahkan).
 *
 * Semua isian disimpan di `GenState.manualSpk` (lihat `lib/spk-susun.ts`).
 * Data form tidak pernah ditimpa: begitu isian manual dikosongkan, teks dari
 * form kembali dipakai. Sumber teks default adalah `pageSPK()` — fungsi yang
 * SAMA dengan yang dipakai dokumen cetak — jadi yang terlihat di panel ini
 * identik dengan yang akan tercetak.
 *
 * CATATAN PENTING
 * File ini pernah rusak berat (ter-duplikasi ribuan kali sehingga gagal
 * di-parse dan membuat halaman SPK blank). Karena itu seluruh isi pasal
 * dibangun lewat data + satu komponen render, bukan JSX yang diulang-ulang.
 */
import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  normalCetak, BATAS_MARGIN, CETAK_AWAL,
  type ManualPasal, type ManualSpk, type PengaturanCetak, type UkuranKertas,
} from '@/lib/spk-susun';
import { pageSPK, type GenState, type ModeHarga } from '@/lib/sph-generator';
import type { KatalogItem, TerminItem, DesainPilihan, DesainOption } from '@/lib/sph-types';
import PasalEditor from '@/components/PasalEditor';

/**
 * Judul pasal — HARUS sama dengan `daftarPasal()` di `lib/spk-pasal.ts`.
 * Dipakai hanya sebagai cadangan bila judul tidak terbaca dari dokumen;
 * sumber utamanya tetap dokumen itu sendiri (lihat `teksAsliDariDokumen`).
 */
export const JUDUL_PASAL: { no: number; judul: string }[] = [
  { no: 1, judul: 'DEFINISI ISTILAH DAN KETENTUAN' },
  { no: 2, judul: 'LINGKUP PEKERJAAN' },
  { no: 3, judul: 'LOKASI PEKERJAAN' },
  { no: 4, judul: 'NILAI KONTRAK' },
  { no: 5, judul: 'WAKTU PELAKSANAAN PEKERJAAN' },
  { no: 6, judul: 'PINALTY' },
  { no: 7, judul: 'CARA PEMBAYARAN' },
  { no: 8, judul: 'FORCE MAJURE' },
  { no: 9, judul: 'PENYELESAIAN' },
  { no: 10, judul: 'PENUTUP' },
];

const UKURAN: UkuranKertas[] = ['A4', 'A5', 'Letter', 'Legal'];

const LABEL_MARGIN: { kunci: 'marginAtas' | 'marginBawah' | 'marginKiri' | 'marginKanan'; label: string }[] = [
  { kunci: 'marginAtas', label: 'Atas' },
  { kunci: 'marginBawah', label: 'Bawah' },
  { kunci: 'marginKiri', label: 'Kiri' },
  { kunci: 'marginKanan', label: 'Kanan' },
];

// ── Bahan untuk menyusun teks default ────────────────────────────────────────
interface IsiPasal { judul: string; badan: string }

/**
 * Editor butuh teks default yang SAMA dengan dokumen cetak. Cara paling jujur:
 * render dokumennya sekali, lalu ambil judul dan badan tiap pasal dari HTML
 * yang dihasilkan. Tidak ada salinan teks yang bisa melenceng.
 */
function teksAsliDariDokumen(html: string): Record<number, IsiPasal> {
  const hasil: Record<number, IsiPasal> = {};
  if (!html) return hasil;
  const re = /<div class="pasal-blk">([\s\S]*?)<\/div>/g;
  let m: RegExpExecArray | null;
  let gagal = 0;
  while ((m = re.exec(html)) !== null) {
    const blok = m[1];
    const no = blok.match(/class="pasal-no"[^>]*>[\s\S]*?(\d+)/);
    if (!no) { gagal++; continue; }
    const judul = (blok.match(/class="pasal-judul"[^>]*>([\s\S]*?)<\/p>/) || ['', ''])[1]
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
    const badan = blok
      .replace(/<p class="pasal-no"[\s\S]*?<\/p>/, '')
      .replace(/<p class="pasal-judul"[\s\S]*?<\/p>/, '')
      .trim();
    hasil[Number(no[1])] = { judul, badan };
  }
  if (gagal > 0) console.warn('[EditorSpk] pasal tak terbaca:', gagal);
  return hasil;
}

/** Bungkus teks polos jadi paragraf agar bisa dimuat editor. */
function jadiHtml(teks: string): string {
  const t = String(teks ?? '').trim();
  if (!t) return '';
  return /<(p|ul|ol|div|table|h[1-6])\b/i.test(t) ? t : '<p>' + t + '</p>';
}

// ── Tipe props ───────────────────────────────────────────────────────────────
export interface EditorSpkProps {
  s: GenState;
  setS: Dispatch<SetStateAction<GenState>>;
  /** Diperlukan untuk menyusun teks default. Bila kosong, dokumen tetap jalan. */
  items?: KatalogItem[];
  termin?: Record<string, TerminItem[]>;
  modeHarga?: ModeHarga;
  pilihDesain?: DesainPilihan;
  liveDesain?: Record<string, DesainOption[]>;
}

// ── Komponen ─────────────────────────────────────────────────────────────────
export default function EditorSpk({
  s, setS, items = [], termin = {}, modeHarga = 'satuan',
  pilihDesain = {} as DesainPilihan, liveDesain = {},
}: EditorSpkProps) {
  const [buka, setBuka] = useState<number | null>(null);
  /** Dinaikkan saat "Kembalikan ke teks form" — memaksa editor dimuat ulang. */
  const [segarkan, setSegarkan] = useState<Record<number, number>>({});

  const manual: ManualSpk = (s.manualSpk || {}) as ManualSpk;
  const cetak = normalCetak(s.cetak);

  // Teks default hanya dibangun saat ada pasal terbuka — menghemat kerja pada
  // setiap ketikan ketika panel sedang tertutup semua.
  const isi = useMemo<Record<number, IsiPasal>>(() => {
    if (buka === null) return {};
    try {
      return teksAsliDariDokumen(pageSPK(s, items, termin, modeHarga, pilihDesain, liveDesain));
    } catch (e) {
      console.warn('[EditorSpk] gagal menyusun teks default:', e);
      return {};
    }
    // `s` sengaja tidak dijadikan dependensi: isi pasal hanya dibaca saat panel
    // dibuka, bukan dihitung ulang tiap ketikan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buka, items, termin, modeHarga, pilihDesain, liveDesain]);

  const ubahManual = (no: number, ubah: Partial<ManualPasal>) => {
    setS(prev => {
      const semua: ManualSpk = { ...(prev.manualSpk || {}) };
      const lama = semua[String(no)] || {};
      const baru: ManualPasal = { ...lama, ...ubah };
      // Buang kunci yang dikosongkan supaya dokumen kembali ke teks form.
      (Object.keys(baru) as (keyof ManualPasal)[]).forEach(k => {
        const v = baru[k];
        if (v === undefined || v === null || v === '' ||
            (Array.isArray(v) && v.length === 0)) delete baru[k];
      });
      if (Object.keys(baru).length === 0) delete semua[String(no)];
      else semua[String(no)] = baru;
      return { ...prev, manualSpk: semua };
    });
  };

  const ubahCetak = (ubah: Partial<PengaturanCetak>) => {
    setS(prev => ({ ...prev, cetak: normalCetak({ ...normalCetak(prev.cetak), ...ubah }) }));
  };

  const kembalikan = (no: number) => {
    ubahManual(no, { ganti: undefined });
    setSegarkan(p => ({ ...p, [no]: (p[no] || 0) + 1 }));
  };

  const jmlDiubah = Object.keys(manual || {}).length;

  return (
    <div className="edspk">
      <div className="edspk-head">
        <div className="edspk-title">Editor SPK</div>
        {jmlDiubah > 0 && <span className="edspk-badge">{jmlDiubah} pasal diubah manual</span>}
      </div>

      {/* ── Kertas & margin ── */}
      <div className="edspk-sec">
        <div className="edspk-ttl">Kertas &amp; margin</div>
        <div className="edspk-row">
          <label className="edspk-lbl" htmlFor="edspk-kertas">Ukuran kertas</label>
          <select
            id="edspk-kertas"
            className="edspk-input"
            value={cetak.kertas}
            onChange={e => ubahCetak({ kertas: e.target.value as UkuranKertas })}
          >
            {UKURAN.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="edspk-margin">
          {LABEL_MARGIN.map(({ kunci, label }) => (
            <label key={kunci} className="edspk-margin-cell">
              <span className="edspk-lbl">{label} (mm)</span>
              <input
                type="number"
                className="edspk-input"
                min={BATAS_MARGIN.min}
                max={BATAS_MARGIN.max}
                value={String(cetak[kunci])}
                onChange={e => ubahCetak({ [kunci]: Number(e.target.value) } as Partial<PengaturanCetak>)}
              />
            </label>
          ))}
        </div>
        <div className="edspk-note">
          Margin {BATAS_MARGIN.min}–{BATAS_MARGIN.max} mm. Bawaan {CETAK_AWAL.kertas}:{' '}
          {CETAK_AWAL.marginAtas}/{CETAK_AWAL.marginBawah}/{CETAK_AWAL.marginKiri}/{CETAK_AWAL.marginKanan} mm.
        </div>
      </div>

      {/* ── Pasal ── */}
      <div className="edspk-sec">
        <div className="edspk-ttl">Pasal — isi bisa disunting</div>
        <div className="edspk-note">
          Teks di bawah tampil <b>seperti hasil cetak</b> dan bisa langsung disunting. Suntingan{' '}
          <b>menggantikan</b> isi pasal itu; data form tidak berubah, dan tombol{' '}
          <b>Kembalikan ke teks form</b> memulihkannya.
        </div>

        {JUDUL_PASAL.map(({ no, judul }) => {
          const m = manual[String(no)] || {};
          const terbuka = buka === no;
          const data = isi[no];
          const judulTampil = m.judul || data?.judul || judul;
          const badan = jadiHtml(data?.badan || '');
          const disunting = !!m.ganti;
          return (
            <div key={no} className={'edspk-pasal' + (terbuka ? ' on' : '')}>
              <button
                type="button"
                className="edspk-ph"
                onClick={() => setBuka(terbuka ? null : no)}
                aria-expanded={terbuka}
              >
                <span className="edspk-no">Pasal {no}</span>
                <span className="edspk-pj">{judulTampil}</span>
                {disunting && <span className="edspk-dot" title="Isi pasal disunting">•</span>}
                {m.sembunyi && <span className="edspk-hidden">disembunyikan</span>}
                <span className="edspk-ar">{terbuka ? '▾' : '▸'}</span>
              </button>

              {terbuka && (
                <div className="edspk-body">
                  <label className="edspk-lbl" htmlFor={'edspk-judul-' + no}>Judul pasal</label>
                  <input
                    id={'edspk-judul-' + no}
                    type="text"
                    className="edspk-input"
                    value={m.judul ?? ''}
                    placeholder={data?.judul || judul}
                    onChange={e => ubahManual(no, { judul: e.target.value })}
                  />

                  <div className="edspk-lbl-row">
                    <span className="edspk-lbl">Isi pasal</span>
                    {disunting
                      ? <span className="edspk-flag">disunting</span>
                      : <span className="edspk-flag edspk-flag-asli">teks form</span>}
                  </div>

                  {disunting || badan ? (
                    <PasalEditor
                      key={no + ':' + (segarkan[no] || 0)}
                      html={disunting ? m.ganti! : badan}
                      onSimpan={html => ubahManual(no, { ganti: html })}
                    />
                  ) : (
                    <div className="edspk-note">
                      Teks pasal ini belum bisa ditampilkan karena data form belum lengkap.
                      Isi form terlebih dahulu, lalu buka pasal ini lagi.
                    </div>
                  )}

                  {disunting && (
                    <button type="button" className="mini-btn" onClick={() => kembalikan(no)}>
                      Kembalikan ke teks form
                    </button>
                  )}

                  <label className="edspk-cek">
                    <input
                      type="checkbox"
                      checked={!!m.sembunyi}
                      onChange={e => ubahManual(no, { sembunyi: e.target.checked })}
                    />
                    Sembunyikan pasal ini dari dokumen
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
