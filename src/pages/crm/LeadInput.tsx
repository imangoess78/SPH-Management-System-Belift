import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, type Lead, type Meta } from '@/lib/crm-api';
import { LeadForm, type Opsi } from '@/components/crm/LeadForm';
import { useCrmUser } from '@/hooks/useCrmUser';

export default function LeadInput() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { nama, bolehUbahSemua, bolehUbahBaris } = useCrmUser();

  const [meta, setMeta] = useState<Meta | null>(null);
  const [awal, setAwal] = useState<Partial<Lead> | null>(null);
  const [memuat, setMemuat] = useState(true);

  const mengubah = !!id;

  useEffect(() => {
    let aktif = true;
    (async () => {
      setMemuat(true);
      try {
        const m = await api.meta();
        if (!aktif) return;
        setMeta(m);
        if (id) {
          const r = await api.getLead(id);
          if (!aktif) return;
          if (!bolehUbahBaris(r.data.sales)) {
            toast.error('Anda tidak berwenang mengubah lead milik sales lain');
            navigate('/crm/leads');
            return;
          }
          setAwal(r.data);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal memuat data');
        navigate('/crm/leads');
      } finally { if (aktif) setMemuat(false); }
    })();
    return () => { aktif = false; };
  }, [id, navigate, bolehUbahBaris]);

  const opsi: Opsi | null = meta ? {
    status: meta.status, kanal: meta.kanal,
    sales: meta.sales.map(s => ({ nama: s.nama, peran: s.peran, status: s.status })),
  } : null;

  const simpan = async (data: Partial<Lead>, catatanRiwayat?: string) => {
    try {
      if (mengubah && id) {
        const r = await api.updateLead(id, { ...data, catatan_riwayat: catatanRiwayat });
        toast.success(`Tersimpan · skor ${r.skor} (${r.kualifikasi})`);
      } else {
        const isi = { ...data, sales: data.sales || nama };
        const r = await api.createLead(isi);
        toast.success(`Lead ${r.kode_lead} dibuat · skor ${r.skor} (${r.kualifikasi})`);
      }
      navigate('/crm/leads');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan');
    }
  };

  if (memuat || !opsi) {
    return <div className="flex items-center justify-center p-16 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin mr-2" />Memuat…
    </div>;
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/crm/leads')}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{mengubah ? `Ubah Lead ${awal?.kode_lead || ''}` : 'Tambah Lead Baru'}</h1>
          <p className="text-sm text-muted-foreground">
            {mengubah
              ? 'Perubahan status tercatat otomatis di riwayat lead.'
              : 'Isi data prospek. Skor HOT/WARM/COLD dihitung otomatis dari 5 kriteria.'}
          </p>
        </div>
      </div>

      <LeadForm
        awal={awal}
        opsi={opsi}
        onSimpan={simpan}
        onBatal={() => navigate('/crm/leads')}
        bolehUbahSales={bolehUbahSemua}
      />
    </div>
  );
}
