import { Link } from 'react-router-dom';
import { FileText, PlusCircle, TrendingUp, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadSPHList, formatDate } from '@/lib/sph-utils';
import { SPH } from '@/lib/sph-types';
import { useState, useEffect } from 'react';

const Index = () => {
  const [sphList, setSphList] = useState<SPH[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSPHList().then(list => {
      setSphList(list);
      setLoading(false);
    });
  }, []);

  const totalSPH = sphList.length;
  const draftCount = sphList.filter(s => s.status === 'draft').length;
  const finalCount = sphList.filter(s => s.status === 'final').length;
  const recent = sphList.slice(0, 5);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Selamat datang di SPH Management System</p>
        </div>
        <Link to="/sph/new">
          <Button className="gap-2">
            <PlusCircle className="w-4 h-4" /> Buat SPH Baru
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{loading ? '...' : totalSPH}</p>
              <p className="text-xs text-muted-foreground">Total SPH</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{loading ? '...' : draftCount}</p>
              <p className="text-xs text-muted-foreground">Draft</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{loading ? '...' : finalCount}</p>
              <p className="text-xs text-muted-foreground">Final</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent SPH */}
      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-5 border-b">
          <h2 className="section-title">SPH Terbaru</h2>
        </div>
        {loading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">Memuat data...</div>
        ) : recent.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Belum ada SPH. Mulai buat SPH pertama Anda.</p>
            <Link to="/sph/new">
              <Button variant="outline" className="mt-4 gap-2">
                <PlusCircle className="w-4 h-4" /> Buat SPH
              </Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y">
            {recent.map(sph => (
              <Link key={sph.id} to={`/sph/${sph.id}`} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-foreground font-sans">{sph.nomorSPH}</p>
                  <p className="text-xs text-muted-foreground">{sph.kepada} — {formatDate(sph.tanggal)}</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${sph.status === 'draft' ? 'badge-draft' : 'badge-final'}`}>
                  {sph.status === 'draft' ? 'Draft' : 'Final'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
