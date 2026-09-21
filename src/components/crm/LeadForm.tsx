import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, X } from 'lucide-react';
import { KRITERIA, PILIHAN_JAWABAN, formatRupiah } from '@/lib/crm-utils';
import { KualifikasiBadge } from '@/components/crm/CrmBadges';
import type { Lead } from '@/lib/crm-api';
import { hitungSkor, kualifikasiDariSkor } from '@/lib/crm-utils';

export interface Opsi {
  status: { status: string }[];
  kanal: { kode: string; kanal: string; kelompok: string }[];
  sales: { nama: string; peran: string; status: string }[];
}

const kosong: Partial<Lead> = {
  waktu_masuk: new Date().toISOString().slice(0, 16),
  butuh_jelas: '', lokasi_siap: '', budget_masuk: '', rencana_6bulan: '', bicara_decider: '',
  status_terakhir: 'Lead Baru', metode_assign: 'Manual', diskon_diminta: null,
};

/**
 * Form input lead. Skor & kualifikasi ditampilkan langsung saat diketik,
 * tapi nilai yang tersimpan tetap dihitung ulang di server.
 */
export function LeadForm({
  awal, opsi, onSimpan, onBatal, bolehUbahSales,
}: {
  awal?: Partial<Lead> | null;
  opsi: Opsi;
  onSimpan: (data: Partial<Lead>, catatanRiwayat?: string) => Promise<void>;
  onBatal: () => void;
  bolehUbahSales: boolean;
}) {
  const [f, setF] = useState<Partial<Lead>>({ ...kosong, ...(awal || {}) });
  const [catatanRiwayat, setCatatanRiwayat] = useState('');
  const [simpan, setSimpan] = useState(false);

  const set = <K extends keyof Lead>(k: K, v: Lead[K]) => setF(p => ({ ...p, [k]: v }));

  const skorHitung = hitungSkor(f as Record<string, string | null>);
  const kualHitung = kualifikasiDariSkor(skorHitung);
  const salesAktif = opsi.sales.filter(s => s.peran === 'Sales' && s.status === 'Aktif');

  const kirim = async () => {
    setSimpan(true);
    try { await onSimpan(f, catatanRiwayat || undefined); }
    finally { setSimpan(false); }
  };

  const wajibNomor = f.status_terakhir === 'Gugur';
  const belumLengkap = !f.nama_prospek?.trim() || (wajibNomor && !f.alasan_gugur?.trim());

  return (
    <div className="space-y-5">
      {/* ── A. Identitas lead ── */}
      <Card className="p-4 space-y-3">
        <p className="text-sm font-semibold">A. Identitas Lead</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Nama Prospek <span className="text-rose-500">*</span></Label>
            <Input value={f.nama_prospek || ''} onChange={e => set('nama_prospek', e.target.value)} placeholder="Ibu Vera / Bapak Indra" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">No HP</Label>
            <Input value={f.no_hp || ''} onChange={e => set('no_hp', e.target.value)} placeholder="0812..." inputMode="tel" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Kota / Wilayah</Label>
            <Input value={f.kota || ''} onChange={e => set('kota', e.target.value)} placeholder="Yogyakarta" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Waktu Masuk</Label>
            <Input type="datetime-local" value={(f.waktu_masuk || '').slice(0, 16)} onChange={e => set('waktu_masuk', e.target.value)} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs">Kebutuhan</Label>
            <Textarea rows={2} value={f.kebutuhan || ''} onChange={e => set('kebutuhan', e.target.value)} placeholder="Home lift 3 lantai, rumah baru" />
          </div>
        </div>
      </Card>

      {/* ── B. Sumber & penugasan ── */}
      <Card className="p-4 space-y-3">
        <p className="text-sm font-semibold">B. Sumber & Penugasan</p>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Kanal Masuk</Label>
            <Select value={f.kode_kanal || ''} onValueChange={v => set('kode_kanal', v)}>
              <SelectTrigger><SelectValue placeholder="Pilih kanal" /></SelectTrigger>
              <SelectContent>
                {opsi.kanal.map(k => (
                  <SelectItem key={k.kode} value={k.kode}>{k.kanal} <span className="text-muted-foreground">· {k.kelompok}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sales</Label>
            <Select value={f.sales || ''} onValueChange={v => set('sales', v)} disabled={!bolehUbahSales}>
              <SelectTrigger><SelectValue placeholder="Pilih sales" /></SelectTrigger>
              <SelectContent>
                {salesAktif.map(s => <SelectItem key={s.nama} value={s.nama}>{s.nama}</SelectItem>)}
              </SelectContent>
            </Select>
            {!bolehUbahSales && <p className="text-[11px] text-muted-foreground">Hanya Manager / Admin yang boleh mengubah penugasan.</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status Terakhir</Label>
            <Select value={f.status_terakhir || 'Lead Baru'} onValueChange={v => set('status_terakhir', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {opsi.status.map(s => <SelectItem key={s.status} value={s.status}>{s.status}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* ── C. Kualifikasi (penentu skor) ── */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">C. Kualifikasi — 5 Kriteria</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Skor</span>
            <span className="text-lg font-bold tabular-nums">{skorHitung}<span className="text-xs font-normal text-muted-foreground">/100</span></span>
            <KualifikasiBadge nilai={kualHitung} />
          </div>
        </div>
        <div className="space-y-2">
          {KRITERIA.map(k => (
            <div key={k.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">{k.label}</p>
                <p className="text-[11px] text-muted-foreground">{k.petunjuk}</p>
              </div>
              <div className="flex gap-1.5">
                {PILIHAN_JAWABAN.map(p => {
                  const aktif = (f[k.key] || '') === p;
                  const warna = p === 'Ya' ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600'
                    : p === 'Belum Jelas' ? 'bg-amber-500 hover:bg-amber-600 border-amber-500'
                    : 'bg-slate-500 hover:bg-slate-600 border-slate-500';
                  return (
                    <button
                      key={p} type="button"
                      onClick={() => set(k.key, aktif ? '' : p)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                        aktif ? `${warna} text-white` : 'bg-background text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Setiap jawaban "Ya" bernilai 20 poin. HOT = 80–100, WARM = 40–60, COLD = 0–20.
        </p>
        <div className="space-y-1.5 max-w-xs">
          <Label className="text-xs">Waktu Kontak Pertama</Label>
          <Input type="datetime-local" value={(f.waktu_kontak_pertama || '').slice(0, 16)} onChange={e => set('waktu_kontak_pertama', e.target.value)} />
          <p className="text-[11px] text-muted-foreground">Respons (jam) dihitung otomatis dari Waktu Masuk.</p>
        </div>
      </Card>

      {/* ── D. Penawaran & diskon ── */}
      <Card className="p-4 space-y-3">
        <p className="text-sm font-semibold">D. Penawaran & Diskon</p>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">No SPH</Label>
            <Input value={f.no_sph || ''} onChange={e => set('no_sph', e.target.value)} placeholder="477/SPH/LIFT/BAI/VIII/2026" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tgl SPH</Label>
            <Input type="date" value={(f.tgl_sph || '').slice(0, 10)} onChange={e => set('tgl_sph', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nilai SPH (Rp)</Label>
            <Input
              inputMode="numeric"
              value={f.nilai_sph ?? ''}
              onChange={e => set('nilai_sph', e.target.value === '' ? null : Number(e.target.value.replace(/\D/g, '')) as never)}
              placeholder="250000000"
            />
            {!!f.nilai_sph && <p className="text-[11px] text-muted-foreground">{formatRupiah(Number(f.nilai_sph))}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Diskon Diminta (%)</Label>
            <Input
              inputMode="decimal"
              value={f.diskon_diminta === null || f.diskon_diminta === undefined ? '' : (Number(f.diskon_diminta) * 100)}
              onChange={e => {
                const v = e.target.value.replace(',', '.');
                set('diskon_diminta', v === '' ? null : Number(v) / 100 as never);
              }}
              placeholder="5"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs">Alasan Diskon</Label>
            <Input value={f.alasan_diskon || ''} onChange={e => set('alasan_diskon', e.target.value)} placeholder="Harga kompetitor lebih rendah" />
          </div>
          {!!f.diskon_diminta && (
            <div className="md:col-span-3 rounded-lg bg-muted/50 border p-2.5 text-xs">
              Approver wajib dihitung otomatis dari jenjang diskon setelah disimpan.
            </div>
          )}
        </div>
      </Card>

      {/* ── E. SPK / KOM / Gugur ── */}
      <Card className="p-4 space-y-3">
        <p className="text-sm font-semibold">E. SPK & Hasil Akhir</p>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">No SPK</Label>
            <Input value={f.no_spk || ''} onChange={e => set('no_spk', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tgl SPK</Label>
            <Input type="date" value={(f.tgl_spk || '').slice(0, 10)} onChange={e => set('tgl_spk', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Lokasi GPS</Label>
            <Input value={f.lokasi_gps || ''} onChange={e => set('lokasi_gps', e.target.value)} placeholder="-6.4025, 106.7942" />
          </div>
          {wajibNomor && (
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Alasan Gugur <span className="text-rose-500">*</span></Label>
              <Input value={f.alasan_gugur || ''} onChange={e => set('alasan_gugur', e.target.value)} placeholder="Wajib diisi kalau status Gugur" />
            </div>
          )}
          <div className="space-y-1.5 md:col-span-3">
            <Label className="text-xs">Catatan</Label>
            <Textarea rows={2} value={f.catatan || ''} onChange={e => set('catatan', e.target.value)} />
          </div>
        </div>
      </Card>

      {/* ── Catatan riwayat (kalau status berubah) ── */}
      {awal?.id && (
        <Card className="p-4 space-y-1.5">
          <Label className="text-xs">Catatan Perubahan Status (opsional)</Label>
          <Input value={catatanRiwayat} onChange={e => setCatatanRiwayat(e.target.value)} placeholder="Misal: customer minta revisi harga" />
        </Card>
      )}

      <div className="flex justify-end gap-2 sticky bottom-0 bg-background/95 backdrop-blur py-3 border-t">
        <Button variant="outline" onClick={onBatal} disabled={simpan}><X className="w-4 h-4 mr-1.5" />Batal</Button>
        <Button onClick={kirim} disabled={simpan || belumLengkap}>
          {simpan ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
          {awal?.id ? 'Simpan Perubahan' : 'Simpan Lead'}
        </Button>
      </div>
    </div>
  );
}
