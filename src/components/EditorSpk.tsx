/**
 * Editor SPK — panel penyuntingan dokumen SPK.
 *
 * KENAPA PANEL INI ADA
 * Isi SPK berbeda antar proyek: termin bisa 3 s/d 9, ada klausul tambahan,
 * ada catatan khusus. Dulu semua itu hanya bisa diubah developer. Panel ini
 * memberi sales tiga hal yang tidak mengubah data form:
 *
 *   1. Identitas pasal — judul pasal bisa diganti.
 *   2. Isi pasal — teks asli hasil susunan form bisa disunting langsung;
 *      hasil suntingan MENGGANTIKAN isi pasal itu (bukan ditambahkan).
 *   3. Tambahan — paragraf bebas ditambahkan di akhir pasal.
 *
 * Semua isian disimpan di `GenState.manualSpk` (lihat `lib/spk-susun.ts`).
 * Data form tidak pernah ditimpa: begitu isian manual dikosongkan, teks dari
 * form kembali dipakai. Sumber teks default adalah `lib/spk-pasal.ts`, fungsi
 * yang SAMA dengan yang dipakai dokumen cetak — jadi yang terlihat di panel
 * ini identik dengan yang akan tercetak.
 *
 * CATATAN PENTING
 * File ini pernah rusak berat (ter-duplikasi ribuan kali sehingga gagal
 * di-parse dan membuat halaman SPK blank). Karena itu seluruh isi pasal
 * dibangun lewat data + satu komponen render, bukan JSX yang diulang-ulang.
 */
import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  susunPasal, normalCetak, BATAS_MARGIN, CETAK_AWAL,
  type ManualPasal, type ManualSpk, type PengaturanCetak, type UkuranKertas,
} from '@/lib/spk-susun';
import { daftarPasal } from '@/lib/spk-pasal';
import { pageSPK, type GenState, type ModeHarga } from '@/lib/sph-generator';
import type { KatalogItem, TerminItem, DesainPilihan, DesainOption } from '@/lib/sph-types';

// ── Judul pasal (dipakai juga oleh dokumen cetak) ────────────────────────────
export const JUDUL_PASAL: { no: number; judul: string }[] = [
  { no: 1, judul: 'PARA PIHAK' },
  { no: 2, judul: 'DEFINISI' },
  { no: 3, judul: 'LINGKUP PEKERJAAN' },
  { no: 4, judul: 'NILAI PEKERJAAN DAN CARA PEMBAYARAN' },
  { no: 5, judul: 'WAKTU PELAKSANAAN' },
  { no: 6, judul: 'HAK DAN KEWAJIBAN PARA PIHAK' },
  { no: 7, judul: 'PENGAWASAN DAN PEMERIKSAAN' },
  { no: 8, judul: 'SERAH TERIMA PEKERJAAN' },
  { no: 9, judul: 'KEADAAN MEMAKSA (FORCE MAJEURE)' },
  { no: 10, judul: 'PENYELESAIAN PERSELISIHAN' },
];

const UKURAN: UkuranKertas[] = ['A4', 'A5', 'Letter', 'Legal'];

const LABEL_MARGIN: { kunci: keyof PengaturanCetak; label: string }[] = [
  { kunci: 'marginAtas', label: 'Atas' },
  { kunci: 'marginBawah', label: 'Bawah' },
  { kunci: 'marginKiri', label: 'Kiri' },
  { kunci: 'marginKanan', label: 'Kanan' },
];

// ── Bahan untuk menyusun teks default ────────────────────────────────────────
/**
 * Editor butuh teks default yang SAMA dengan dokumen cetak. Cara termurah dan
 * paling jujur: render dokumennya sekali, lalu ambil isi tiap pasal dari HTML
 * yang dihasilkan. Dengan begitu tidak ada salinan teks yang bisa melenceng.
 */
function teksAsliDariDokumen(html: string): Record<number, string> {
  const hasil: Record<number, string> = {};
  if (!html) return hasil;
  const re = /<div class="pasal-blk">([\s\S]*?)<\/div>/g;
  let m: RegExpExecArray | null;
  let jatuh = 0;
  while ((m = re.exec(html)) !== null) {
    const blok = m[1];
    // Ambil nomor pasal dari <p class="pasal-no">PASAL&nbsp;&nbsp;N</p>
    const no = blok.match(/class="pasal-no"[^>]*>[\s\S]*?(\d+)/);
    if (!no) { jatuh++; continue; }
    // Buang baris nomor & judul; sisakan badan pasal.
    const badan = blok
      .replace(/<p class="pasal-no"[\s\S]*?<\/p>/, '')
      .replace(/<p class="pasal-judul"[\s\S]*?<\/p>/, '')
      .trim();
    hasil[Number(no[1])] = badan;
  }
  if (jatuh > 0) {
    // Tidak fatal: pasal yang tak terbaca akan tampil sebagai "belum lengkap".
    console.warn('[EditorSpk] pasal tak terbaca:', jatuh);
  }
  return hasil;
}

/** Bungkus teks asli dalam paragraf agar bisa disunting sebagai satu kotak. */
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

  const manual: ManualSpk = (s.manualSpk || {}) as ManualSpk;
  const cetak = normalCetak(s.cetak);

  // Teks default: dari dokumen SPK yang dibangun fungsi cetak yang sama.
  const teksDefault = useMemo(() => {
    try {
      const html = pageSPK(s, items, termin, modeHarga, pilihDesain, liveDesain);
      return teksAsliDariDokumen(html);
    } catch (e) {
      console.warn('[EditorSpk] gagal menyusun teks default:', e);
      return {} as Record<number, string>;
    }
  }, [s, items, termin, modeHarga, pilihDesain, liveDesain]);

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

  const jmlDiubah = Object.keys(manual || {}).length;

  return (
    <div className="edspk">
      <div className="edspk-head">
        <div className="edspk-title">Editor SPK</div>
        {jmlDiubah > 0 && (
          <span className="edspk-badge">{jmlDiubah} pasal diubah manual</span>
        )}
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
            {UKURAN.map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
        <div className="edspk-margin">
          {LABEL_MARGIN.map(({ kunci, label }) => (
            <label key={String(kunci)} className="edspk-margin-cell">
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
          Kotak di bawah berisi <b>teks asli pasal</b> hasil susunan data form. Hasil suntingan{' '}
          <b>menggantikan</b> isi pasal itu; data form tidak ikut berubah, dan tombol{' '}
          <b>Kembalikan ke teks form</b> memulihkannya.
        </div>
        {JUDUL_PASAL.map(({ no, judul }) => {
          const m = manual[String(no)] || {};
          const terbuka = buka === no;
          const asli = jadiHtml(teksDefault[no] || '');
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
                <span className="edspk-pj">{m.judul || judul}</span>
                {disunting && <span className="edspk-dot" title="Isi pasal disunting">•</span>}
                {m.sembunyi && <span className="edspk-hidden">disembunyikan</span>}
                <span className="edspk-ar">{terbuka ? '▾' : '▸'}</span>
              </button>

              {terbuka && (
                <div className="edspk-body">
                  <label className="edspk-lbl">Judul pasal</label>
                  <input
                    type="text"
                    className="edspk-input"
                    value={m.judul ?? ''}
                    placeholder={judul}
                    onChange={e => ubahManual(no, { judul: e.target.value })}
                  />

                  <div className="edspk-lbl-row">
                    <label className="edspk-lbl">Isi pasal</label>
                    {disunting
                      ? <span className="edspk-flag">disunting</span>
                      : <span className="edspk-flag edspk-flag-asli">teks form</span>}
                  </div>
                  {asli || disunting ? (
                    <textarea
                      className="edspk-area"
                      value={m.ganti ?? asli}
                      onChange={e => ubahManual(no, { ganti: e.target.value })}
                      rows={10}
                      spellCheck={false}
                    />
                  ) : (
                    <div className="edspk-note">
                      Teks pasal ini belum bisa ditampilkan karena data form belum lengkap.
                      Isi form terlebih dahulu, lalu buka pasal ini lagi.
                    </div>
                  )}
                  {disunting && (
                    <button
                      type="button"
                      className="mini-btn"
                      onClick={() => ubahManual(no, { ganti: undefined })}
                    >
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

/** Teks pasal yang akan tercetak setelah isian manual diterapkan. */
export function teksPasalCetak(s: GenState): { no: number; judul: string; html: string }[] {
  return susunPasal(
    JUDUL_PASAL.map(({ no, judul }) => ({ no, judul, blok: [] })),
    s.manualSpk as ManualSpk | undefined,
  ).map(p => ({ no: p.no, judul: p.judul, html: '' }));
}
