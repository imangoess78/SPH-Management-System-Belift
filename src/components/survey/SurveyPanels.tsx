import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import {
  DT_FIELDS, KELOMPOK_FIELD, DAFTAR_ADDON, JUDUL_DOKUMENTASI, PERTANYAAN_KESIMPULAN, OPSI_JAWAB,
  type DataTeknis, type Lantai, type AddOn, type BarisDokumentasi, type PekerjaanTambahan,
  type ButirKesimpulan, type FotoDok,
} from '@/lib/survey-types';

export const KOSONG = '__kosong__';

export const bacaTeks = (dt: DataTeknis, k: string): string => {
  const v = dt[k];
  return v === null || v === undefined || Array.isArray(v) ? '' : String(v);
};

export const bacaLantai = (dt: DataTeknis): Lantai[] => (dt.lantai as Lantai[]) || [];

export const bacaAddon = (dt: DataTeknis): AddOn[] =>
  (dt.addon as AddOn[])?.length ? (dt.addon as AddOn[]) : DAFTAR_ADDON.map(a => ({ ...a }));

/** Data Teknis kosong dengan add-on & tabel lantai awal. */
export function dtKosong(): DataTeknis {
  const dt: DataTeknis = {};
  for (const f of DT_FIELDS) dt[f.key] = '';
  dt.lantai = [];
  dt.addon = DAFTAR_ADDON.map(a => ({ ...a }));
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

// ════════════════════════════════════════════════════════════
//  1. DATA TEKNIS — 57 field, dikelompokkan
// ════════════════════════════════════════════════════════════
export function DataTeknisPanel({
  dt, ubah, bacaSaja, wajibKosong = [],
}: {
  dt: DataTeknis;
  ubah: (k: string, v: string) => void;
  bacaSaja?: boolean;
  wajibKosong?: string[];
}) {
  const set = (k: string, v: string) => { if (!bacaSaja) ubah(k, v); };

  return (
    <div className="space-y-6">
      {KELOMPOK_FIELD.map(kel => {
        const field = DT_FIELDS.filter(f => f.kel === kel);
        if (!field.length) return null;
        return (
          <div key={kel}>
            <h3 className="text-sm font-semibold mb-3 pb-1.5 border-b">{kel}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {field.map(f => {
                const nilai = bacaTeks(dt, f.key);
                const kurang = wajibKosong.includes(f.key);
                return (
                  <div key={f.key} className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      {f.label}
                      {f.satuan && <span className="font-normal opacity-70">({f.satuan})</span>}
                      {kurang && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                    </label>
                    {f.jenis === 'pilih' ? (
                      <Select value={nilai || KOSONG} onValueChange={v => set(f.key, v === KOSONG ? '' : v)} disabled={bacaSaja}>
                        <SelectTrigger className={kurang ? 'border-amber-400' : ''}><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={KOSONG}>—</SelectItem>
                          {f.opsi?.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={nilai}
                        onChange={e => set(f.key, e.target.value)}
                        placeholder={f.hint || ''}
                        disabled={bacaSaja}
                        className={kurang ? 'border-amber-400' : ''}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
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
                <th className="p-2 w-12">No</th>
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
                  <td className="p-2 text-muted-foreground">{i + 1}</td>
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
//  Bucket khusus `survey-photos` (ditambahkan ke daftar bucket yang
//  diizinkan di functions/api/media.ts). Yang disimpan adalah KUNCI
//  mentah, bukan URL jadi — URL dibentuk saat ditampilkan supaya bisa
//  dipakai juga di dokumen cetak.
// ════════════════════════════════════════════════════════════
async function unggahFoto(file: File): Promise<FotoDok> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${crypto.randomUUID()}.${ext || 'jpg'}`;
  const fd = new FormData();
  fd.append('file', file);
  fd.append('bucket', 'survey-photos');
  fd.append('path', path);
  const r = await fetch('/api/media', { method: 'POST', body: fd, credentials: 'same-origin' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error || 'Gagal mengunggah foto');
  return { key: `recovery/2026-08-19/survey-photos/${path}`, nama: file.name };
}

/** URL tampil untuk satu foto dokumentasi. */
export const urlFoto = (key: string): string => `/api/media?key=${encodeURIComponent(key)}`;

export function DokumentasiPanel({
  baris, ubah, bacaSaja,
}: {
  baris: BarisDokumentasi[];
  ubah: (b: BarisDokumentasi[]) => void;
  bacaSaja?: boolean;
}) {
  const set = (i: number, patch: Partial<BarisDokumentasi>) => ubah(baris.map((r, j) => j === i ? { ...r, ...patch } : r));

  const tambahFoto = async (i: number, files: FileList | null) => {
    if (!files?.length) return;
    try {
      const baru: FotoDok[] = [];
      for (const f of Array.from(files)) baru.push(await unggahFoto(f));
      set(i, { foto: [...baris[i].foto, ...baru], ada: true });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal mengunggah foto');
    }
  };

  return (
    <div className="space-y-2">
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
              onChange={e => tambahFoto(i, e.target.files)}
              className="text-xs max-w-[190px]" />
          )}
          <span className="text-xs text-muted-foreground w-16 text-right">{r.foto.length} foto</span>
          {r.foto.length > 0 && (
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
