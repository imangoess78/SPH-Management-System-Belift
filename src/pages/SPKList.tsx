import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FileText, PlusCircle, Trash2, Copy, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { loadDocumentList, deleteDocument, saveDocument, formatDate, generateId } from '@/lib/sph-utils';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export default function SPKList() {
  const [searchParams] = useSearchParams();
  const [list, setList] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'final'>(
    (searchParams.get('status') as 'draft' | 'final') || 'all'
  );
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchList = async () => {
    setLoading(true);
    const all = await loadDocumentList();
    // Filter hanya dokumen SPK — dicek dari specs.__docstate
    const spkOnly = all.filter(doc => {
      const specs: any[] = doc.specs || [];
      const ds = specs.find((s: any) => s.key === '__docstate');
      if (ds) {
        try {
          const parsed = JSON.parse(ds.value);
          return parsed.mode === 'SPK';
        } catch { /* ignore */ }
      }
      // Fallback: cek perihal
      return String(doc.perihal || '').includes('SPK');
    });
    setList(spkOnly);
    setLoading(false);
  };

  useEffect(() => { fetchList(); }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Hapus SPK ini?')) return;
    const ok = await deleteDocument(id);
    if (ok) {
      setList(prev => prev.filter(s => s.id !== id));
      toast.success('SPK berhasil dihapus');
    } else {
      toast.error('Gagal menghapus SPK');
    }
  };

  const handleDuplicate = async (doc: any) => {
    if (!user) return;
    const newDoc = {
      ...JSON.parse(JSON.stringify(doc)),
      id: generateId(),
      tanggal: new Date().toISOString().split('T')[0],
      status: 'draft',
    };
    const ok = await saveDocument(newDoc, user.id);
    if (ok) {
      setList(prev => [newDoc, ...prev]);
      toast.success('SPK berhasil diduplikasi');
    } else {
      toast.error('Gagal menduplikasi SPK');
    }
  };

  const norm = (s: any) => ({
    id: s.id,
    nomorSPK: s.nomor_sph || s.nomorSPH || '',
    tanggal: s.tanggal || '',
    kepada: s.kepada || '',
    jenisLift: s.jenis_lift || s.jenisLift || '',
    status: s.status || 'draft',
  });

  const filtered = list.map(norm).filter(s => {
    const q = search.toLowerCase();
    const matchSearch = (
      s.nomorSPK.toLowerCase().includes(q) ||
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
          <h1 className="text-2xl font-bold text-foreground">Riwayat SPK</h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} surat perjanjian kerja</p>
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
          <Link to="/spk/new">
            <Button className="gap-2 w-full sm:w-auto">
              <PlusCircle className="w-4 h-4" /> Buat SPK Baru
            </Button>
          </Link>
        </div>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">Memuat data...</div>
        ) : list.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Belum ada SPK.</p>
            <Link to="/spk/new">
              <Button variant="outline" className="mt-4 gap-2">
                <PlusCircle className="w-4 h-4" /> Buat SPK Pertama
              </Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-medium text-muted-foreground">No. SPK</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Tanggal</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Kepada</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Jenis Lift</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(spk => (
                  <tr key={spk.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4">
                      <Link to={`/spk/${spk.id}/edit`} className="font-medium text-primary hover:underline">
                        {spk.nomorSPK || spk.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="p-4 text-muted-foreground">{formatDate(spk.tanggal)}</td>
                    <td className="p-4">{spk.kepada}</td>
                    <td className="p-4 text-muted-foreground">{spk.jenisLift}</td>
                    <td className="p-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${spk.status === 'draft' ? 'badge-draft' : 'badge-final'}`}>
                        {spk.status === 'draft' ? 'Draft' : 'Final'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/spk/${spk.id}/edit`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit SPK">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => handleDuplicate(list.find(d => d.id === spk.id))}
                          title="Duplikasi">
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(spk.id)} title="Hapus">
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
