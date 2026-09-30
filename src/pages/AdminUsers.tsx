import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Shield, Save, ChevronDown, ChevronRight, Info, AlertTriangle,
  RotateCcw, CheckCircle2, XCircle, Clock,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  PERAN, GRUP, IZIN, SEMUA_KUNCI, izinEfektif, labelPeran,
  type Peran,
} from '../../shared/akses';

interface Akun {
  id: string; email: string; full_name: string | null; role: string;
  status: string; permissions: string[] | null; izin_efektif: string[];
  created_at: string; approved_at: string | null;
}

export default function AdminUsers() {
  const nav = useNavigate();
  const { user, izin, loading: memuatSesi } = useAuth();
  const [akun, setAkun] = useState<Akun[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [terbuka, setTerbuka] = useState<string | null>(null);
  const [galat, setGalat] = useState('');
  const [pesan, setPesan] = useState('');

  // Salinan pilihan yang belum disimpan, per akun.
  const [draf, setDraf] = useState<Record<string, string[]>>({});

  const muat = async () => {
    const r = await fetch('/api/admin/users');
    if (r.status === 403) { nav('/'); return; }
    const j = await r.json();
    setAkun(j.data || []);
    setDraf(Object.fromEntries((j.data || []).map((a: Akun) =>
      [a.id, a.permissions ?? izinEfektif(a.role, null)])));
    setMemuat(false);
  };

  useEffect(() => { if (!memuatSesi && izin.length) muat(); }, [memuatSesi, izin.length]);

  if (memuatSesi) return <p className="p-6 text-sm text-muted-foreground">Memuat…</p>;

  if (!izin.includes('akun') && !izin.includes('*')) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <p className="text-sm font-semibold text-destructive">Akses ditolak</p>
          <p className="text-xs text-muted-foreground mt-1">
            Peran Anda ({labelPeran(user?.role as Peran)}) tidak berwenang membuka Manajemen Akun.
          </p>
        </div>
      </div>
    );
  }

  const simpan = async (a: Akun) => {
    setGalat(''); setPesan('');
    const dipilih = draf[a.id] || [];
    const asli = a.permissions ?? izinEfektif(a.role, null);
    // Kosongkan checklist = kembali ke bawaan peran (permissions = null).
    const samaDenganBawaan = dipilih.length === 0 ||
      (dipilih.length === asli.length && dipilih.every(k => asli.includes(k)));

    const r = await fetch(`/api/admin/users?id=${encodeURIComponent(a.id)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        permissions: dipilih.length === 0 ? null : dipilih,
        role: a.role,
        _samaDenganBawaan: samaDenganBawaan,
      }),
    });
    const j = await r.json();
    if (!r.ok) { setGalat(j.error || 'Gagal menyimpan'); return; }
    setPesan(`Hak akses ${a.email} disimpan.`);
    await muat();
  };

  const resetBawaan = async (a: Akun) => {
    setGalat(''); setPesan('');
    const r = await fetch(`/api/admin/users?id=${encodeURIComponent(a.id)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ permissions: null, role: a.role }),
    });
    const j = await r.json();
    if (!r.ok) { setGalat(j.error || 'Gagal mengembalikan'); return; }
    setPesan(`Hak akses ${a.email} dikembalikan ke bawaan peran ${labelPeran(a.role as Peran)}.`);
    await muat();
  };

  const ubahPeran = async (a: Akun, roleBaru: string) => {
    setGalat(''); setPesan('');
    const r = await fetch(`/api/admin/users?id=${encodeURIComponent(a.id)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      // Ganti peran -> kembali ke bawaan peran itu, jangan bawa izin khusus lama.
      body: JSON.stringify({ role: roleBaru, permissions: null }),
    });
    const j = await r.json();
    if (!r.ok) { setGalat(j.error || 'Gagal mengubah role'); return; }
    setPesan(`Role ${a.email} diubah ke ${labelPeran(roleBaru as Peran)}.`);
    await muat();
  };

  const toggle = (a: Akun, kunci: string) => {
    setDraf(d => {
      const kini = d[a.id] || [];
      return { ...d, [a.id]: kini.includes(kunci) ? kini.filter(k => k !== kunci) : [...kini, kunci] };
    });
  };

  const ringkas = (kunci: string[]) => {
    if (!kunci.length) return 'kosong — pakai bawaan peran';
    return `${kunci.length} dari ${SEMUA_KUNCI.length} izin`;
  };

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <Users className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-semibold">Manajemen Akun</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Atur peran dan hak akses tiap akun. Peran menentukan izin bawaan;
        centang untuk menyesuaikan khusus orang itu.
      </p>

      {galat && (
        <div className="mb-3 flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-lg p-3">
          <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-xs text-destructive">{galat}</p>
        </div>
      )}
      {pesan && (
        <div className="mb-3 flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
          <p className="text-xs text-emerald-700 dark:text-emerald-400">{pesan}</p>
        </div>
      )}

      <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-5">
        <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong className="text-foreground">Checklist kosong = pakai bawaan peran.</strong> Tidak perlu mencentang semua — cukup sesuaikan yang berbeda.</p>
          <p><strong className="text-foreground">Batasan data dijalankan di server.</strong> Sales yang hanya boleh melihat data sendiri akan ditolak API-nya (403), bukan sekadar disembunyikan tombolnya.</p>
          <p><strong className="text-foreground">Perubahan berlaku segera.</strong> Sesi akun yang diubah diputus agar izin lama tidak tertinggal.</p>
        </div>
      </div>

      {memuat ? (
        <p className="text-sm text-muted-foreground">Memuat akun…</p>
      ) : (
        <div className="space-y-2">
          {akun.map(a => {
            const buka = terbuka === a.id;
            const dipilih = draf[a.id] || [];
            const bawaan = izinEfektif(a.role, null);
            const beda = dipilih.length > 0 &&
              !(dipilih.length === bawaan.length && dipilih.every(k => bawaan.includes(k)));
            const sendiri = a.id === user?.id;

            return (
              <div key={a.id} className="bg-card border rounded-xl overflow-hidden">
                {/* ── Baris ringkas ── */}
                <div className="flex items-center gap-3 p-3">
                  <button onClick={() => setTerbuka(buka ? null : a.id)}
                          className="text-muted-foreground hover:text-foreground">
                    {buka ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{a.full_name || a.email}</p>
                      {sendiri && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">Anda</span>}
                      {a.permissions !== null && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-600 dark:text-violet-400 font-medium">
                          izin khusus
                        </span>
                      )}
                      {a.status !== 'approved' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 font-medium inline-flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />{a.status}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                  </div>

                  <select
                    value={a.role}
                    onChange={e => ubahPeran(a, e.target.value)}
                    className="text-xs border rounded-md px-2 py-1.5 bg-background"
                  >
                    {PERAN.map(p => <option key={p} value={p}>{labelPeran(p)}</option>)}
                  </select>

                  <span className="text-xs text-muted-foreground w-40 text-right hidden sm:block">
                    {ringkas(dipilih)}
                  </span>
                </div>

                {/* ── Checklist hak akses ── */}
                {buka && (
                  <div className="border-t bg-muted/30 p-4">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        <p className="text-sm font-semibold">Hak akses</p>
                        <span className="text-xs text-muted-foreground">
                          bawaan {labelPeran(a.role as Peran)}: {bawaan.filter(k => k !== '*').length} izin
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setDraf(d => ({ ...d, [a.id]: izinEfektif(a.role, null) }))}
                                className="text-xs px-2 py-1 rounded border hover:bg-background">
                          Isi dengan bawaan peran
                        </button>
                        <button onClick={() => setDraf(d => ({ ...d, [a.id]: [] }))}
                                className="text-xs px-2 py-1 rounded border hover:bg-background">
                          Kosongkan
                        </button>
                        <button onClick={() => resetBawaan(a)}
                                className="text-xs px-2 py-1 rounded border hover:bg-background inline-flex items-center gap-1">
                          <RotateCcw className="h-3 w-3" />Bawaan
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {GRUP.map(g => (
                        <div key={g.nama} className="bg-card border rounded-lg p-3">
                          <p className="text-xs font-semibold text-foreground mb-2">{g.nama}</p>
                          <div className="space-y-1.5">
                            {g.izin.map(info => {
                              const aktif = dipilih.includes(info.kunci);
                              const bawaanAktif = bawaan.includes(info.kunci);
                              return (
                                <label key={info.kunci}
                                       className="flex items-start gap-2 cursor-pointer rounded px-1.5 py-1 hover:bg-muted/60">
                                  <input type="checkbox" checked={aktif}
                                         onChange={() => toggle(a, info.kunci)}
                                         className="mt-0.5 h-3.5 w-3.5 rounded border-input accent-primary" />
                                  <span className="min-w-0">
                                    <span className="text-xs text-foreground flex items-center gap-1.5">
                                      {info.label}
                                      {bawaanAktif && !aktif && (
                                        <span className="text-[10px] text-muted-foreground">(bawaan)</span>
                                      )}
                                    </span>
                                    <span className="block text-[11px] text-muted-foreground leading-snug">
                                      {info.keterangan}
                                    </span>
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    {dipilih.length === 0 && (
                      <div className="mt-3 flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-muted-foreground">
                          Checklist kosong. Akun ini akan memakai hak akses bawaan peran
                          <strong className="text-foreground"> {labelPeran(a.role as Peran)}</strong> —
                          termasuk bila bawaan peran diubah nanti.
                        </p>
                      </div>
                    )}

                    <div className="mt-4 flex items-center gap-2">
                      <button onClick={() => simpan(a)} disabled={!beda && a.permissions === null}
                              className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-medium
                                         disabled:opacity-50 inline-flex items-center gap-1.5">
                        <Save className="h-3.5 w-3.5" />Simpan hak akses
                      </button>
                      {beda && <span className="text-[11px] text-amber-600">Ada perubahan belum disimpan</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
