/**
 * Editor Tabel Lantai untuk bagian "Unit lift & spesifikasi" (SPH & SPK).
 *
 * Tinggi tiap lantai diketik MANUAL dalam mm — inilah bentuk "Floor to Floor"
 * yang diminta klien (mis. 6 lantai, masing-masing tingginya diisi sendiri).
 * Total dihitung otomatis dari baris yang terisi dan dipakai generator saat
 * mencetak dokumen.
 */
import { LantaiUnit, lantaiAwal, totalFloorToFloor } from '@/lib/sph-types';

export default function TabelLantai({
  lantai, onChange, bacaSaja = false,
}: {
  lantai: LantaiUnit[];
  onChange: (l: LantaiUnit[]) => void;
  bacaSaja?: boolean;
}) {
  // Array kosong (mis. dokumen lama) diperlakukan sama seperti belum ada data:
  // tampilkan 6 baris baku, jangan tabel kosong tanpa satu pun kolom isian.
  const baris = Array.isArray(lantai) && lantai.length ? lantai : lantaiAwal(6);
  const total = totalFloorToFloor(baris);
  const set = (i: number, k: 'lantai' | 'tinggi', v: string) =>
    onChange(baris.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  return (
    <div className="f-item">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <label className="f-label" htmlFor="ftf-lantai-0">Floor to Floor — Tabel Lantai</label>
        {!bacaSaja && (
          <button type="button" className="f-ctrl" data-uji="tambah-lantai"
            style={{ width: 'auto', padding: '3px 10px', fontSize: 11 }}
            onClick={() => onChange([...baris, {
              no: baris.length + 1, lantai: String(baris.length + 1), tinggi: '',
            }])}>
            + Tambah lantai
          </button>
        )}
      </div>

      <table className="ptbl ftf-tbl">
        <thead>
          <tr>
            <th>Lantai</th>
            <th style={{ width: 110 }}>Tinggi (mm)</th>
            {!bacaSaja && <th style={{ width: 30 }} />}
          </tr>
        </thead>
        <tbody>
          {baris.map((l, i) => (
            <tr key={i}>
              <td>
                <input className="f-ctrl" type="text" id={i === 0 ? 'ftf-lantai-0' : undefined}
                  aria-label={`Nama lantai ${i + 1}`} value={l.lantai} placeholder="Nama lantai"
                  disabled={bacaSaja} onChange={e => set(i, 'lantai', e.target.value)} />
              </td>
              <td>
                <input className="f-ctrl" type="text" inputMode="numeric"
                  aria-label={`Tinggi lantai ${i + 1} (mm)`} value={l.tinggi} placeholder="mis. 3300"
                  disabled={bacaSaja} onChange={e => set(i, 'tinggi', e.target.value)} />
              </td>
              {!bacaSaja && (
                <td>
                  <button type="button" title="Hapus lantai" aria-label={`Hapus lantai ${i + 1}`}
                    className="f-ctrl" style={{ width: '100%', padding: '3px 0', color: '#9C0006' }}
                    onClick={() => onChange(baris.filter((_, j) => j !== i)
                      .map((r, j) => ({ ...r, no: j + 1 })))}>
                    ×
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} style={{ textAlign: 'right', fontWeight: 600, fontSize: 11 }}>
              Total Floor to Floor
            </td>
            <td style={{ fontWeight: 600, fontSize: 12 }} data-testid="total">
              {total > 0 ? total.toLocaleString('id-ID') + ' mm' : '—'}
            </td>
            {!bacaSaja && <td />}
          </tr>
        </tfoot>
      </table>

      <div className="f-hint">
        Tinggi diisi manual per lantai (mm). Kosongkan bila belum diukur — dokumen mencetak <b>After Survey</b>.
      </div>
    </div>
  );
}
