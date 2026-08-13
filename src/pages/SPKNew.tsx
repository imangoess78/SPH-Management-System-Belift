// ============================================================
//  SPK BARU — Pilih SPH Final sebagai dasar kontrak
//  User memilih SPH Final → diarahkan ke /spk/new?from=<id>
//  SPHForm akan membaca ?from= dan pre-populate semua field
// ============================================================
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ArrowRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/sph-utils';
import { useAuth } from '@/hooks/useAuth';

export default function SPKNew() {
  const navigate = useNavigate();
  const { signOut, fullName } = useAuth();
  const [list, setList] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    (async () => {
      setLoading(true);

      // Query langsung ke Supabase — filter status='final' di sisi DB
      const { data, error } = await (supabase as any)
        .from('sph')
        .select('id, nomor_sph, tanggal, kepada, jenis_lift, alamat_proyek, perihal, status, specs')
        .eq('status', 'final')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[SPKNew] error fetching:', error);
        setLoading(false);
        return;
      }

      // Filter hanya yang mode-nya SPH (bukan SPK)
      const sphFinals = (data || []).filter((doc: any) => {
        const specs: any[] = Array.isArray(doc.specs) ? doc.specs : [];
        const ds = specs.find((s: any) => s.key === '__docstate');
        if (ds?.value) {
          try {
            const parsed = JSON.parse(ds.value);
            return parsed.mode === 'SPH';
          } catch { /* fallthrough */ }
        }
        // Fallback: perihal mengandung 'SPH' dan tidak mengandung 'SPK'
        const perihal = String(doc.perihal || '').toUpperCase();
        return perihal.includes('SPH') && !perihal.includes('SPK');
      });
      setList(sphFinals);
      setLoading(false);
    })();
  }, []);

  // Normalize field names
  const norm = (doc: any) => {
    const specs: any[] = Array.isArray(doc.specs) ? doc.specs : [];
    const ds = specs.find((s: any) => s.key === '__docstate');
    let docstate: any = {};
    if (ds?.value) {
      try { docstate = JSON.parse(ds.value); } catch { /* ignore */ }
    }
    // saveDocument stores form fields in docstate.state
    const fs = docstate.state || docstate;

    return {
      id: doc.id,
      nomorSPH: doc.nomor_sph || '',
      tanggal: doc.tanggal || fs.tanggal || '',
      kepada: doc.kepada || fs.namaPerusahaan || fs.namaCustomer || '',
      jenisLift: doc.jenis_lift || fs.jenisLift || '',
      tipeKabin: fs.tipeKabin || '',
      kapasitas: fs.kapasitas || '',
      kotaProyek: fs.kotaProyek || doc.alamat_proyek || '',
    };
  };

  const filtered = list.map(norm).filter(item => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.nomorSPH.toLowerCase().includes(q) ||
      item.kepada.toLowerCase().includes(q) ||
      item.jenisLift.toLowerCase().includes(q) ||
      item.kotaProyek.toLowerCase().includes(q) ||
      item.tipeKabin.toLowerCase().includes(q)
    );
  });

  function pilihSPH(id: string) {
    navigate(`/spk/new?from=${id}`);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100svh', overflow: 'hidden' }}>
      {/* TOP BAR — sama dengan SPHForm */}
      <div className="topbar-app no-print" style={{
        position: 'sticky', top: 0, zIndex: 60,
        background: 'var(--brown)', color: '#fff',
        borderBottom: '3px solid var(--orange)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', height: 52 }}>
          <button
            onClick={() => navigate('/')}
            style={{ background: 'none', border: 0, color: '#E8DCD3', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 4px', flexShrink: 0 }}
          >‹</button>
          <img
            src="/BELIFT-Logo-White.webp"
            alt="Belift"
            style={{ height: 23, width: 'auto', objectFit: 'contain', display: 'block', flexShrink: 0 }}
          />
          <div style={{ marginLeft: 8, flexShrink: 0 }}>
            <span style={{
              fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, fontSize: 16,
              letterSpacing: '.08em', color: '#fff',
              borderBottom: '3px solid var(--orange)', paddingBottom: 3,
            }}>SPK · Kontrak Baru</span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {fullName && <span style={{ fontSize: 12, opacity: .7 }}>{fullName}</span>}
            <button
              onClick={signOut}
              style={{ border: '1px solid rgba(255,255,255,.35)', background: 'none', color: '#fff', padding: '7px 13px', borderRadius: 3, cursor: 'pointer', fontSize: 13 }}
            >Keluar</button>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--shell, #F0EDE9)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 16px 60px' }}>

          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{
              fontFamily: "'Barlow Condensed',sans-serif", fontSize: 28, fontWeight: 700,
              color: 'var(--brown, #592203)', letterSpacing: '.04em', margin: 0,
            }}>Buat SPK Baru</h1>
            <p style={{ fontSize: 13, color: 'var(--muted, #7A6E66)', marginTop: 6 }}>
              Pilih SPH Final sebagai dasar kontrak. Semua data akan disalin ke form SPK dan bisa diedit.
            </p>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <Search style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              width: 16, height: 16, color: 'var(--muted, #7A6E66)',
              pointerEvents: 'none',
            }} />
            <Input
              style={{ paddingLeft: 34 }}
              placeholder="Cari nomor SPH, perusahaan, jenis lift, kota..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* List */}
          <div style={{
            background: '#fff', borderRadius: 10,
            border: '1px solid var(--line, #DFD8D1)',
            boxShadow: '0 1px 4px rgba(43,27,16,.06)',
            overflow: 'hidden',
          }}>
            {loading ? (
              <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--muted, #7A6E66)', fontSize: 13 }}>
                Memuat data SPH Final…
              </div>
            ) : list.length === 0 ? (
              <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--muted, #7A6E66)' }}>
                <FileText style={{ width: 48, height: 48, margin: '0 auto 12px', opacity: .3, display: 'block' }} />
                <p style={{ fontSize: 13, fontWeight: 500, margin: '0 0 4px' }}>Belum ada SPH Final.</p>
                <p style={{ fontSize: 12, margin: 0 }}>Finalisasi SPH terlebih dahulu sebelum membuat SPK.</p>
                <Button variant="outline" style={{ marginTop: 16 }} onClick={() => navigate('/sph')}>
                  Lihat Riwayat SPH
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--muted, #7A6E66)' }}>
                Tidak ada SPH Final yang cocok dengan pencarian.
              </div>
            ) : (
              <div>
                {filtered.map((sph, idx) => (
                  <div
                    key={sph.id}
                    onClick={() => pilihSPH(sph.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderTop: idx === 0 ? 'none' : '1px solid var(--line, #DFD8D1)',
                      cursor: 'pointer', transition: 'background .12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--shell, #F0EDE9)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{
                          fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 15,
                          color: 'var(--orange, #D95103)', letterSpacing: '.04em',
                        }}>
                          {sph.nomorSPH || sph.id.slice(0, 8)}
                        </span>
                        <span className="badge-final" style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 99,
                          fontWeight: 600, border: '1px solid currentColor',
                        }}>Final</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--ink, #2B1B10)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sph.kepada || '—'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted, #7A6E66)', marginTop: 2, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {sph.tanggal && <span>{formatDate(sph.tanggal)}</span>}
                        {sph.jenisLift && <span>{sph.jenisLift}</span>}
                        {sph.tipeKabin && <span>{sph.tipeKabin}</span>}
                        {sph.kapasitas && <span>{sph.kapasitas}</span>}
                        {sph.kotaProyek && <span>📍 {sph.kotaProyek}</span>}
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); pilihSPH(sph.id); }}
                      style={{
                        marginLeft: 16, flexShrink: 0,
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: 'none', border: '1px solid var(--line, #DFD8D1)',
                        borderRadius: 4, padding: '6px 12px',
                        fontSize: 13, fontWeight: 500, cursor: 'pointer',
                        color: 'var(--ink, #2B1B10)',
                        transition: 'border-color .12s, color .12s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'var(--orange, #D95103)';
                        e.currentTarget.style.color = 'var(--orange, #D95103)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--line, #DFD8D1)';
                        e.currentTarget.style.color = 'var(--ink, #2B1B10)';
                      }}
                    >
                      Gunakan <ArrowRight style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
