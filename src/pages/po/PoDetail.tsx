import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  ArrowLeft, Save, Send, GitCompare, Printer, Lock, Unlock, AlertTriangle, History, Factory,
} from 'lucide-react';
import { poApi, type BalikanPoDetail } from '@/lib/survey-api';
import { cetakPo, salinRingkasPo } from '@/lib/survey-cetak';
import { useCrmUser } from '@/hooks/useCrmUser';
import { bolehTerbitPO } from '@/lib/crm-akses';
import { MAKS_REVISI_TANPA_APPROVAL, type PerubahanField } from '@/lib/survey-types';
import { fmtTglPendek, fmtWaktu, warnaTingkat, lencanaTingkat, labelTingkat } from '@/lib/survey-utils';

const PABRIK_UMUM = ['PT. Belift Pabrik', 'Pabrik Rekanan A', 'Pabrik Rekanan B', 'Lain-lain'];

export default function PoDetail() {
  const { id } = useParams<{ id: string }>();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const { peran, nama } = useCrmUser();
  const [d, setD] = useState<BalikanPoDetail | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);

  const [pabrik, setPabrik] = useState('');
  const [pic, setPic] = useState('');
  const [tglPo, setTglPo] = useState('');
  const [catatan, setCatatan] = useState('');
  const [idLead, setIdLead] = useState('');

  const bolehTerbit = bolehTerbitPO(peran);

  const muat = useCallback(async () => {
    if (!id) return;
    setMemuat(true);
    try {
      const r = await poApi.ambil(id);
      setD(r);
      setPabrik(r.data.pabrik || '');
      setPic(r.data.pic || '');
      setTglPo((r.data.tgl_po || '').slice(0, 10));
      setCatatan(r.data.catatan || '');
      setIdLead(r.data.id_lead || '');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memuat PO');
    } finally { setMemuat(false); }
  }, [id]);

  // PO baru: dibuat sekali saat halaman dibuka dengan ?lead=
  useEffect(() => {
    const lead = sp.get('lead');
    if (id || !lead) return;
    (async () => {
      try {
        const r = await poApi.buat({ id_lead: lead });
        navigate(`/po/${r.id}`, { replace: true });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal membuat PO');
        navigate('/po');
      }
    })();
  }, [id, sp, navigate]);

  useEffect(() => { if (id) muat(); }, [id, muat]);

  const simpanKepala = async () => {
    if (!id) return;
    setSibuk(true);
    try {
      await poApi.ubah(id, { pabrik, pic, tgl_po: tglPo || null, catatan });
      toast.success('PO tersimpan');
      muat();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal menyimpan'); }
    finally { setSibuk(false); }
  };

  const terbitkan = async (revisi = false) => {
    if (!id) return;
    const revKe = (d?.data.rev_terakhir || 0) + 1;
    let alasan: string | null = null;
    if (revisi || revKe > MAKS_REVISI_TANPA_APPROVAL) {
      const pesan = revisi
        ? `Terbitkan revisi ke-${revKe}? Jelaskan alasan revisi (tercatat):`
        : `Revisi ke-${revKe} melebihi batas ${MAKS_REVISI_TANPA_APPROVAL}. Alasan wajib diisi:`;
      alasan = prompt(pesan);
      if (!alasan?.trim()) { toast.error('Alasan wajib diisi'); return; }
    } else if (!confirm(`Terbitkan PO ${d?.data.no_po} ke ${pabrik || 'pabrik'}? Data teknis Final Survey akan dikunci sebagai revisi ke-${revKe}.`)) {
      return;
    }
    setSibuk(true);
    try {
      await simpanKepala();
      const r = revisi ? await poApi.revisi(id, alasan || undefined) : await poApi.terbit(id, alasan || undefined);
      toast.success(r.rev === 1
        ? `PO terbit — revisi ${r.rev}`
        : `Revisi ${r.rev} terbit — ${r.jml_perubahan} perubahan`);
      muat();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal menerbitkan PO'); }
    finally { setSibuk(false); }
  };

  if (memuat) return <div className="p-8 text-center text-muted-foreground">Memuat…</div>;
  if (!d) return <div className="p-8 text-center text-muted-foreground">PO tidak ditemukan.</div>;

  const po = d.data;
  const revTerbit = po.rev_terakhir || 0;
  const finalTerkunci = !!d.revisi.length;
  const revisiTerakhir = d.revisi[0];

  return (
    <div className="space-y-4">
      {/* ── Kepala ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 mb-1" onClick={() => navigate('/po')}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Daftar PO
          </Button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Factory className="w-5 h-5 text-muted-foreground" />
            <span className="font-mono">{po.no_po || 'PO belum bernomor'}</span>
            {revTerbit > 0 && (
              <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${
                revTerbit > 1 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                {revTerbit > 1 ? `Revisi ${revTerbit}` : 'Terbit'}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            {po.nama_prospek || '—'}{po.kode_proyek && <> · <span className="font-mono">{po.kode_proyek}</span></>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => { salinRingkasPo(po, d.revisi); toast.success('Tersalin'); }}>
            Salin ringkas
          </Button>
          <Button variant="outline" size="sm" onClick={() => cetakPo(po, d.revisi, pabrik, pic)}>
            <Printer className="w-4 h-4 mr-1.5" /> Cetak PO
          </Button>
          {bolehTerbit && (
            <Button variant="outline" size="sm" onClick={() => navigate(`/lacak/${idLead}`)}>
              <GitCompare className="w-4 h-4 mr-1.5" /> Lacak perubahan
            </Button>
          )}
          {bolehTerbit && revTerbit === 0 && (
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => terbitkan(false)} disabled={sibuk}>
              <Send className="w-4 h-4 mr-1.5" /> Terbitkan PO
            </Button>
          )}
          {bolehTerbit && revTerbit > 0 && (
            <Button size="sm" onClick={() => terbitkan(true)} disabled={sibuk}>
              <GitCompare className="w-4 h-4 mr-1.5" /> Terbitkan revisi {(revTerbit + 1)}
            </Button>
          )}
        </div>
      </div>

      {/* ── Peringatan syarat PO1 ── */}
      {revTerbit === 0 && (
        <div className="flex items-start gap-2 p-3 rounded-md border border-sky-200 bg-sky-50 text-sm">
          <Lock className="w-4 h-4 mt-0.5 text-sky-600 shrink-0" />
          <span>
            PO hanya bisa terbit bila <strong>Final Survey sudah dikunci</strong>. Data teknis terkunci itu
            akan disimpan sebagai revisi ke-1 dan menjadi acuan pabrik.
          </span>
        </div>
      )}
      {revTerbit > 0 && revisiTerakhir?.perubahan_setelah_final === 1 && (
        <div className="flex items-start gap-2 p-3 rounded-md border border-amber-200 bg-amber-50 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
          <span>
            Revisi {revisiTerakhir.rev} memuat <strong>{revisiTerakhir.jml_perubahan} perubahan</strong> yang terjadi
            setelah data disimpan. Rinciannya ada di bagian Riwayat Revisi di bawah.
          </span>
        </div>
      )}
      {revTerbit >= MAKS_REVISI_TANPA_APPROVAL && (
        <div className="flex items-start gap-2 p-3 rounded-md border border-rose-200 bg-rose-50 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-rose-600 shrink-0" />
          <span>Revisi sudah mencapai batas {MAKS_REVISI_TANPA_APPROVAL}. Revisi berikutnya wajib disertai alasan.</span>
        </div>
      )}

      {/* ── Kepala PO ── */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-3">Data PO</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Pabrik</label>
            <Select value={pabrik || ''} onValueChange={setPabrik} disabled={!bolehTerbit}>
              <SelectTrigger><SelectValue placeholder="Pilih pabrik" /></SelectTrigger>
              <SelectContent>
                {PABRIK_UMUM.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">PIC Pabrik</label>
            <Input value={pic} onChange={e => setPic(e.target.value)} disabled={!bolehTerbit} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Tanggal PO</label>
            <Input type="date" value={tglPo} onChange={e => setTglPo(e.target.value)} disabled={!bolehTerbit} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">No. PO</label>
            <Input value={po.no_po || ''} readOnly disabled className="bg-muted font-mono text-xs" />
          </div>
          <div className="space-y-1 sm:col-span-2 lg:col-span-4">
            <label className="text-xs font-medium text-muted-foreground">Catatan PO</label>
            <textarea value={catatan} onChange={e => setCatatan(e.target.value)} disabled={!bolehTerbit}
              rows={2} className="w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-60" />
          </div>
        </div>
        {bolehTerbit && (
          <div className="flex justify-end mt-3">
            <Button variant="outline" size="sm" onClick={simpanKepala} disabled={sibuk}>
              <Save className="w-4 h-4 mr-1.5" /> Simpan data PO
            </Button>
          </div>
        )}
      </Card>

      {/* ── Selisih Final Survey → PO ── */}
      {d.selisih_final_ke_po.length > 0 && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-1 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-500" /> Data teknis berubah setelah Final Survey
          </h2>
          <p className="text-xs text-muted-foreground mb-3">
            {d.selisih_final_ke_po.length} perbedaan antara data Final Survey yang dikunci dan yang dipakai PO sekarang.
          </p>
          <div className="space-y-1.5">
            {d.selisih_final_ke_po.map((p, i) => (
              <div key={i} className="p-2.5 rounded-md border-l-4 border-l-rose-500 bg-rose-50/60">
                <strong className="text-sm">{p.label}</strong>
                <div className="text-xs font-mono mt-0.5">
                  <span className="text-muted-foreground line-through">{p.lama}</span>
                  <span className="mx-1.5 text-muted-foreground">→</span>
                  <span className="font-semibold">{p.baru}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Riwayat revisi ── */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <History className="w-4 h-4" /> Riwayat Revisi
        </h2>
        {d.revisi.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2 flex items-center gap-2">
            <Unlock className="w-4 h-4" /> PO belum pernah diterbitkan — belum ada revisi.
          </p>
        ) : (
          <div className="space-y-3">
            {d.revisi.map(r => (
              <div key={r.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      r.rev === 1 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                      Rev {r.rev}
                    </span>
                    <span className="text-sm font-medium">{r.rev === 1 ? 'Terbit awal' : 'Revisi'}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {r.oleh || '—'} · {fmtWaktu(r.tgl_revisi || r.created_at)}
                  </span>
                </div>
                {r.alasan && (
                  <p className="text-xs italic text-muted-foreground mb-2">Alasan: {r.alasan}</p>
                )}
                {r.perubahan.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {r.rev === 1 ? 'Salinan data teknis terkunci disimpan bersama revisi ini.' : 'Tidak ada perubahan field.'}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {r.perubahan.map((p: PerubahanField, i: number) => (
                      <div key={i} className="text-xs p-1.5 rounded bg-muted/40">
                        <span className="font-medium">{p.label}</span>
                        <span className="font-mono ml-2">
                          <span className="text-muted-foreground line-through">{p.lama}</span>
                          <span className="mx-1">→</span>
                          <span className="font-semibold">{p.baru}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">
        Peran Anda: <strong>{peran}</strong> ({nama}) · {bolehTerbit
          ? 'Anda berwenang menerbitkan PO.'
          : 'Anda hanya dapat melihat PO.'}
      </p>
    </div>
  );
}
