/**
 * Penyunting isi pasal — WYSIWYG.
 *
 * KENAPA BUKAN TEXTAREA
 * Versi sebelumnya menampilkan HTML mentah (`<p><strong>…</strong></p>`) di dalam
 * kotak teks. Sales harus membaca tag untuk tahu mana yang tebal, dan satu salah
 * ketik tag bisa merusak dokumen. Di sini teks tampil seperti hasil cetak: tebal
 * terlihat tebal, daftar terlihat sebagai daftar.
 *
 * TABEL TIDAK DISUNTING DI SINI
 * Pasal 7 memuat tabel termin pembayaran yang disusun dari data form. Editor teks
 * kaya tidak mengenal tabel, jadi kalau isinya dimuat mentah-mentah lalu disimpan
 * ulang, tabelnya HILANG. Karena itu badan pasal dipecah: bagian teks disunting
 * (WYSIWYG), bagian tabel ditampilkan apa adanya sebagai blok terkunci dan ikut
 * tersimpan utuh saat teks di sekitarnya disunting.
 *
 * Tampilan editor sengaja disamakan dengan dokumen cetak (Barlow, 10.5pt,
 * line-height 1.5) supaya yang terlihat di sini sama dengan yang tercetak.
 */
import { useReducer, useRef, useState, useEffect } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';

// ── Pemecahan badan pasal: teks vs blok terkunci ─────────────────────────────
/**
 * Blok yang TIDAK boleh masuk editor teks kaya.
 *
 * - `<table>` — editor teks kaya tidak mengenal tabel. Kalau dimuat mentah lalu
 *   disimpan ulang, tabelnya HILANG. Ini yang dulu menghapus tabel termin.
 * - `<div class="sign">` — blok tanda tangan PIHAK PERTAMA / PIHAK KEDUA,
 *   lengkap dengan `.sigbox` (tempat gambar tanda tangan & cap) dan `.sig-nm`.
 *   Tiptap hanya mengenal paragraf/daftar/heading, jadi div beserta class-nya
 *   dilucuti: tanda tangan, cap, dan garis nama ikut lenyap begitu pasal
 *   disimpan — termasuk saat pengguna sekadar menghapus satu kata di pasal 10.
 *
 * Keduanya dikeluarkan dari area sunting dan disimpan apa adanya.
 */
export type JenisSegmen = 'teks' | 'tabel' | 'tanda';

export interface Segmen { jenis: JenisSegmen; html: string }

/** Awal blok terkunci yang dikenali. */
const AWAL_TERKUNCI = /<table\b|<div\b[^>]*\bclass="[^"]*\bsign\b/gi;

/**
 * Posisi akhir blok terkunci yang dimulai di `mulai`, atau -1 bila bukan blok
 * terkunci. Untuk `<div class="sign">` dipakai penghitung kedalaman karena
 * isinya bersarang (`sign > div > sigbox`, `sig-nm`, dst.) — regex `.*?` akan
 * berhenti di `</div>` pertama dan memotong tanda tangan di tengah.
 */
function akhirBlok(html: string, mulai: number): number {
  const sisa = html.slice(mulai);

  if (/^<table\b/i.test(sisa)) {
    const t = html.toLowerCase().indexOf('</table>', mulai);
    return t < 0 ? html.length : t + '</table>'.length;
  }

  if (/^<div\b/i.test(sisa)) {
    const re = /<div\b[^>]*>|<\/div>/gi;
    re.lastIndex = mulai;
    let kedalaman = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      if (m[0].charAt(1) === '/') {
        kedalaman--;
        if (kedalaman === 0) return m.index + m[0].length;
      } else {
        kedalaman++;
      }
    }
    return html.length; // div tidak tertutup — ambil sampai habis
  }

  return -1;
}

export function pisahSegmen(html: string): Segmen[] {
  const hasil: Segmen[] = [];
  const re = new RegExp(AWAL_TERKUNCI.source, 'gi');
  let akhir = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(html)) !== null) {
    const tutup = akhirBlok(html, m.index);
    if (tutup < 0 || tutup <= m.index) continue;
    if (m.index > akhir) hasil.push({ jenis: 'teks', html: html.slice(akhir, m.index) });
    const isi = html.slice(m.index, tutup);
    hasil.push({ jenis: /^<table\b/i.test(isi) ? 'tabel' : 'tanda', html: isi });
    akhir = tutup;
    re.lastIndex = tutup; // lewati seluruh blok supaya <div> di dalamnya tak ikut terdeteksi
  }

  if (akhir < html.length) hasil.push({ jenis: 'teks', html: html.slice(akhir) });
  if (hasil.length === 0) hasil.push({ jenis: 'teks', html: '' });
  return hasil;
}

// ── Tombol bilah alat ────────────────────────────────────────────────────────
function Tb({ on, aktif, judul, children, nonaktif }: {
  on: () => void; aktif?: boolean; judul: string; children: React.ReactNode; nonaktif?: boolean;
}) {
  return (
    <button
      type="button"
      className={'tb' + (aktif ? ' tb-on' : '')}
      title={judul}
      aria-label={judul}
      aria-pressed={!!aktif}
      disabled={nonaktif}
      // Mousedown dicegah supaya fokus editor tidak hilang sebelum perintah jalan.
      onMouseDown={e => e.preventDefault()}
      onClick={on}
    >
      {children}
    </button>
  );
}

function BilahAlat({ editor }: { editor: Editor }) {
  // Tiptap tidak memicu render React pada tiap perubahan seleksi; paksa segarkan
  // supaya status tombol (tebal/miring/daftar) jujur mengikuti posisi kursor.
  const [, segarkan] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    editor.on('transaction', segarkan);
    return () => { editor.off('transaction', segarkan); };
  }, [editor, segarkan]);

  return (
    <div className="edspk-tb" role="toolbar" aria-label="Format teks">
      <Tb on={() => editor.chain().focus().toggleBold().run()} aktif={editor.isActive('bold')} judul="Tebal">
        <b>B</b>
      </Tb>
      <Tb on={() => editor.chain().focus().toggleItalic().run()} aktif={editor.isActive('italic')} judul="Miring">
        <i>I</i>
      </Tb>
      <Tb on={() => editor.chain().focus().toggleUnderline().run()} aktif={editor.isActive('underline')} judul="Garis bawah">
        <u>U</u>
      </Tb>
      <span className="edspk-tb-pisah" />
      <Tb on={() => editor.chain().focus().toggleBulletList().run()} aktif={editor.isActive('bulletList')} judul="Daftar butir">
        •&nbsp;List
      </Tb>
      <Tb on={() => editor.chain().focus().toggleOrderedList().run()} aktif={editor.isActive('orderedList')} judul="Daftar bernomor">
        1.&nbsp;List
      </Tb>
      <span className="edspk-tb-pisah" />
      <Tb on={() => editor.chain().focus().undo().run()} judul="Batalkan" nonaktif={!editor.can().undo()}>
        ↶
      </Tb>
      <Tb on={() => editor.chain().focus().redo().run()} judul="Ulangi" nonaktif={!editor.can().redo()}>
        ↷
      </Tb>
    </div>
  );
}

// ── Satu segmen teks ─────────────────────────────────────────────────────────
function SegmenTeks({ html, onUbah }: { html: string; onUbah: (h: string) => void }) {
  const cb = useRef(onUbah);
  cb.current = onUbah;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        // Kelas dipertahankan supaya CSS dokumen cetak (.ul/.ol) tetap berlaku.
        bulletList: { HTMLAttributes: { class: 'ul' } },
        orderedList: { HTMLAttributes: { class: 'ol' } },
      }),
      TextAlign.configure({ types: ['paragraph'] }),
    ],
    content: html && html.trim() ? html : '<p></p>',
    editorProps: {
      attributes: { class: 'edspk-prose', spellcheck: 'true' },
    },
    onUpdate: ({ editor: e }) => cb.current(e.getHTML()),
  }, []);

  if (!editor) return <div className="edspk-muat">Menyiapkan editor…</div>;

  return (
    <div className="edspk-ed">
      <BilahAlat editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

// ── Komponen utama ───────────────────────────────────────────────────────────
export interface PasalEditorProps {
  /** Badan pasal awal (HTML). Dibaca sekali saat panel dibuka. */
  html: string;
  /** Dipanggil setiap isi berubah — sudah termasuk tabel yang disisipkan kembali. */
  onSimpan: (html: string) => void;
}

export default function PasalEditor({ html, onSimpan }: PasalEditorProps) {
  // Segmen dibekukan saat mount. Induk mengganti `key` bila pasal berganti atau
  // pengguna menekan "Kembalikan ke teks form", jadi tidak ada penimpaan diam-diam
  // terhadap apa yang sedang diketik.
  const [segmen] = useState<Segmen[]>(() => pisahSegmen(html));
  const nilai = useRef<string[]>(segmen.map(s => s.html));
  const cb = useRef(onSimpan);
  cb.current = onSimpan;

  const kirim = () => cb.current(nilai.current.join(''));

  const adaTabel = segmen.some(s => s.jenis === 'tabel');
  const adaTanda = segmen.some(s => s.jenis === 'tanda');

  return (
    <div className="edspk-isi">
      {segmen.map((s, i) => s.jenis === 'teks' ? (
        <SegmenTeks
          key={'t' + i}
          html={s.html}
          onUbah={h => { nilai.current[i] = h; kirim(); }}
        />
      ) : (
        <div
          key={'b' + i}
          className={'edspk-blok edspk-blok-' + s.jenis}
          data-jenis={s.jenis}
        >
          <div className="edspk-blok-kepala">
            <span>{s.jenis === 'tabel' ? 'Tabel dari data form' : 'Blok tanda tangan'}</span>
            <span className="edspk-blok-not">tidak disunting di sini</span>
          </div>
          <div
            className="edspk-blok-isi"
            // Blok ini disimpan apa adanya: kalau dimuat ke editor teks kaya,
            // div + class-nya dilucuti dan tanda tangan/cap ikut hilang.
            dangerouslySetInnerHTML={{ __html: s.html }}
          />
        </div>
      ))}
      {adaTabel && (
        <div className="edspk-catatan">
          Tabel di atas disusun otomatis dari termin dan nilai pada form. Untuk mengubah
          isinya, ubah data form — bukan teks pasal. Tabel tetap tersimpan utuh.
        </div>
      )}
      {adaTanda && (
        <div className="edspk-catatan">
          Blok tanda tangan (PIHAK PERTAMA &amp; PIHAK KEDUA) diambil dari data customer,
          direktur, dan gambar tanda tangan pada Pengaturan. Blok ini tidak ikut berubah
          saat teks pasal disunting, jadi tanda tangan &amp; cap tidak akan hilang.
        </div>
      )}
    </div>
  );
}
