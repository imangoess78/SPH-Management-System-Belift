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

// ── Pemecahan badan pasal: teks vs tabel ─────────────────────────────────────
type Segmen = { jenis: 'teks' | 'tabel'; html: string };

export function pisahSegmen(html: string): Segmen[] {
  const hasil: Segmen[] = [];
  const re = /<table[\s\S]*?<\/table>/gi;
  let akhir = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m.index > akhir) hasil.push({ jenis: 'teks', html: html.slice(akhir, m.index) });
    hasil.push({ jenis: 'tabel', html: m[0] });
    akhir = m.index + m[0].length;
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

  return (
    <div className="edspk-isi">
      {segmen.map((s, i) => s.jenis === 'teks' ? (
        <SegmenTeks
          key={'t' + i}
          html={s.html}
          onUbah={h => { nilai.current[i] = h; kirim(); }}
        />
      ) : (
        <div key={'b' + i} className="edspk-tabel">
          <div className="edspk-tabel-kepala">
            <span>Tabel dari data form</span>
            <span className="edspk-tabel-not">tidak disunting di sini</span>
          </div>
          <div className="edspk-tabel-isi" dangerouslySetInnerHTML={{ __html: s.html }} />
        </div>
      ))}
      {adaTabel && (
        <div className="edspk-catatan">
          Tabel di atas disusun otomatis dari termin dan nilai pada form. Untuk mengubah
          isinya, ubah data form — bukan teks pasal. Tabel tetap tersimpan utuh.
        </div>
      )}
    </div>
  );
}
