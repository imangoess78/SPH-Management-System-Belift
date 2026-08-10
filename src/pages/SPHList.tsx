import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FileText, PlusCircle, Trash2, Copy, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { loadSPHList, deleteSPH, saveSPH, formatDate, generateId, generateNomorSPH, getNextIncrement } from '@/lib/sph-utils';
import { SPH } from '@/lib/sph-types';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export default function SPHList() {
  const [searchParams] = useSearchParams();
  const [sphList, setSphList] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'final'>(
    (searchParams.get('status') as 'draft' | 'final') || 'all'
  );
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchList = async () => {
    setLoading(true);
    const list = await loadSPHList();
    setSphList(list);
    setLoading(false);
  };

  useEffect(() => { fetchList(); }, []);

  const handleDelete = async (id: string) => {
    const ok = await deleteSPH(id);
    if (ok) {
      setSphList(prev => prev.filter(s => s.id !== id));
      toast.success('SPH berhasil dihapus');
    } else {
      toast.error('Gagal menghapus SPH');
    }
  };

  const handleDuplicate = async (sph: any) => {
    if (!user) return;
    const increment = await getNextIncrement();
    const newSPH: SPH = {
      ...JSON.parse(JSON.stringify(sph)),
      id: generateId(),
      nomorSPH: generateNomorSPH(increment),
      tanggal: new Date().toISOString().split('T')[0],
      status: 'draft' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const ok = await saveSPH(newSPH, user.id);
    if (ok) {
      setSphList(prev => [newSPH, ...prev]);
      toast.success('SPH berhasil diduplikasi');
    } else {
      toast.error('Gagal menduplikasi SPH');
    }
  };

  // Normalize both camelCase (legacy) and snake_case (DB) field names
  const norm = (s: any) => ({
    id: s.id,
    nomorSPH: s.nomorSPH || s.nomor_sph || '',
    tanggal: s.tanggal || '',
    kepada: s.kepada || '',
    jenisLift: s.jenisLift || s.jenis_lift || '',
    status: s.status || 'draft',
  });

  const filteredList: any[] = sphList.map(norm).filter(s => {
    const q = search.toLowerCase();
    const matchSearch = (
      s.nomorSPH.toLowerCase().includes(q) ||
      s.kepada.toLowerCase().includes(q) ||
      s.jenisLift.toLowerCase().includes(q)
    );
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Riwayat SPH</h1>
          <p className="text-sm text-muted-foreground mt-1">{filteredList.length} surat penawaran</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto sm:items-center">
          {/* Status filter tabs */}
          <div className="flex rounded-lg border overflow-hidden shrink-0">
            {(['all', 'draft', 'final'] as const).map(f => (
              <button key={f} onClick={() => setStatusFilter(f)} className={`px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === f ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted/50'}`}>
                {f === 'all' ? 'Semua' : f === 'draft' ? 'Draft' : 'Final'}
              </button>
            ))}
          </div>
          <Input
            className="w-full sm:w-56"
            placeholder="Cari nomor, perusahaan, jenis lift..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <Link to="/sph/new">
            <Button className="gap-2 w-full sm:w-auto"><PlusCircle className="w-4 h-4" /> Buat SPH Baru</Button>
          </Link>
        </div>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">Memuat data...</div>
        ) : sphList.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Belum ada SPH.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-medium text-muted-foreground">No. SPH</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Tanggal</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Kepada</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Jenis Lift</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredList.map(sph => (
                  <tr key={sph.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4">
                      <Link to={`/sph/${sph.id}`} className="font-medium text-primary hover:underline">{sph.nomorSPH}</Link>
                    </td>
                    <td className="p-4 text-muted-foreground">{formatDate(sph.tanggal)}</td>
                    <td className="p-4">{sph.kepada}</td>
                    <td className="p-4 text-muted-foreground">{sph.jenisLift}</td>
                    <td className="p-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${sph.status === 'draft' ? 'badge-draft' : 'badge-final'}`}>
                        {sph.status === 'draft' ? 'Draft' : 'Final'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/sph/${sph.id}/preview`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Preview PDF">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDuplicate(sph)}>
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(sph.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
