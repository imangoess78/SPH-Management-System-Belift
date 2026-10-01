import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Shield, Save, ChevronDown, ChevronRight, Info, AlertTriangle,
  RotateCcw, CheckCircle2, XCircle, Clock, Ban, Trash2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  PERAN, GRUP, IZIN, SEMUA_KUNCI, izinEfektif, labelPeran,
  type Peran,
} from '../../shared/akses';

interface Milik {
  sph: number; lead: number; survey: number; po: number; total: number;
}

interface Akun {
  id: string; email: string; full_name: string | null; role: string;
  status: string; permissions: string[] | null; izin_efektif: string[];
  created_at: string; approved_at: string | null;
  milik?: Milik;
}

/**
 * Inisial untuk bulatan avatar: dua huruf pertama dari nama, atau dari email
 * bila nama belum diisi. Membantu mata menemukan akun yang sama saat kembali
 * ke halaman ini, tanpa harus membaca tiap baris dari awal.
 */
function inisial(a: { full_name: string | null; email: string }): string {
  const nama = (a.full_name || '').trim();
  if (nama) {
    const bagian = nama.split(/\s+/).filter(Boolean);
    return (bagian.length >= 2 ? bagian[0][0] + bagian[1][0] : nama.slice(0, 2)).toUpperCase();
  }
  return (a.email || '?').slice(0, 2).toUpperCase();
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

  /**
   * Nonaktifkan / aktifkan akun.
   *
   * Ini cara yang AMAN untuk mencabut akses: orangnya tidak bisa login lagi,
   * tapi seluruh datanya tetap utuh dan tetap punya pemilik. Berbeda dengan
   * hapus akun, yang membuat data kehilangan pemilik.
   */
  const ubahStatus = async (a: Akun, statusBaru: 'approved' | 'nonaktif') => {
    setGalat(''); setPesan('');
    const r = await fetch(`/api/admin/users?id=${encodeURIComponent(a.id)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: statusBaru }),
    });
    const j = await r.json();
    if (!r.ok) { setGalat(j.error || 'Gagal mengubah status'); return; }
    setPesan(statusBaru === 'approved'
      ? `${a.email} diaktifkan kembali.`
      : `${a.email} dinonaktifkan — tidak bisa login lagi, tapi datanya tetap utuh.`);
    await muat();
  };

  /**
   * Hapus akun. Kalau akun masih punya data, server menolak dengan 409 dan
   * menyebutkan jumlahnya; admin harus mengonfirmasi ulang.
   */
  const hapusAkun = async (a: Akun, paksa = false) => {
    setGalat(''); setPesan('');
    const r = await fetch(`/api/admin/users?id=${encodeURIComponent(a.id)}${paksa ? '&paksa=1' : ''}`, {
      method: 'DELETE',
    });
    const j = await r.json().catch(() => ({}));

    if (r.status === 409 && j.butuhKonfirmasi) {
      const m = j.milik || {};
      const rinci = [
        m.sph ? `${m.sph} SPH/SPK` : null,
        m.lead ? `${m.lead} lead` : null,
        m.survey ? `${m.survey} survey` : null,
        m.po ? `${m.po} PO` : null,
      ].filter(Boolean).join(', ');
      const lanjut = window.confirm(
        `Akun ${a.email} masih memiliki ${m.total} data (${rinci}).\n\n` +
        `Kalau dihapus, data itu tidak akan terlihat sales mana pun — hanya admin.\n\n` +
        `Sebaiknya NONAKTIFKAN saja supaya datanya tetap punya pemilik.\n\n` +
        `Tetap hapus akun ini?`
      );
      if (lanjut) await hapusAkun(a, true);
      return;
    }

    if (!r.ok) { setGalat(j.error || 'Gagal menghapus akun'); return; }
    setPesan(`Akun ${a.email} dihapus.`);
    await muat();
  };

  const ubahPeran = async (a: Akun, roleBaru: string) => {
    if (roleBaru === a.role) return;
    setGalat(''); setPesan('');
    try {
      const r = await fetch(`/api/admin/users?id=${encodeURIComponent(a.id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        // Ganti peran -> kembali ke bawaan peran itu, jangan bawa izin khusus lama.
        body: JSON.stringify({ role: roleBaru, permissions: null }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        // Server menolak kalau ini pengelola akun terakhir dan peran baru tidak
        // punya wewenang `akun`. Tanpa penjelasan, pesannya terasa seperti
        // "tombolnya tidak berfungsi" — padahal penolakan itu disengaja.
        setGalat(
          j.error
            ? `${j.error} (peran ${labelPeran(a.role as Peran)} → ${labelPeran(roleBaru as Peran)} tidak jadi diubah)`
            : `Gagal mengubah peran ${a.email} ke ${labelPeran(roleBaru as Peran)}.`,
        );
        return;
      }
      setPesan(`Peran ${a.email} diubah ke ${labelPeran(roleBaru as Peran)}.`);
      await muat();
    } catch {
      setGalat(`Gagal menghubungi server saat mengubah peran ${a.email}. Coba lagi.`);
    }
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
    <div className="p-6 max-w-6xl">
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
        <>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Daftar Akun</h2>
            <span className="text-xs text-muted-foreground">{akun.length} akun</span>
          </div>

          <div className="bg-card border rounded-xl overflow-hidden">
            {/* Kepala kolom — hanya desktop. Di mobile tiap baris bertumpuk,
                jadi label kolom justru menambah tinggi tanpa menambah jelas. */}
            <div className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_9.5rem_8.5rem_13rem] items-center gap-4 border-b bg-muted/40 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Akun</span>
              <span>Peran</span>
              <span>Hak akses</span>
              <span className="text-right">Tindakan</span>
            </div>

            {akun.map(a => {
            const buka = terbuka === a.id;
            const dipilih = draf[a.id] || [];
            const bawaan = izinEfektif(a.role, null);
            const beda = dipilih.length > 0 &&
              !(dipilih.length === bawaan.length && dipilih.every(k => bawaan.includes(k)));
            const sendiri = a.id === user?.id;

            return (
              <div key={a.id} className="border-b last:border-b-0">
                {/* ── Baris ringkas ──
                    Mobile: bertumpuk — avatar+nama, lalu kontrol di barisnya sendiri.
                    Desktop (lg): satu baris grid sejajar dengan kepala kolom. */}
                <div className="flex flex-col gap-3 px-4 py-3 hover:bg-muted/30 transition-colors lg:grid lg:grid-cols-[minmax(0,1fr)_9.5rem_8.5rem_13rem] lg:items-center lg:gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => setTerbuka(buka ? null : a.id)}
                      aria-label={buka ? 'Tutup hak akses' : 'Buka hak akses'}
                      className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      {buka ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>

                    <span className="shrink-0 grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                      {inisial(a)}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium break-words">{a.full_name || a.email}</p>
                        {sendiri && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">Anda</span>
                        )}
                        {a.status !== 'approved' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 font-medium inline-flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />{a.status}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground break-all">{a.email}</p>
                    </div>
                  </div>

                  {/* Kontrol: bertumpuk penuh di mobile, mengikuti kolom di desktop */}
                  <div className="flex items-center gap-2 flex-wrap pl-11 lg:pl-0 lg:contents">
                    <select
                      value={a.role}
                      onChange={e => ubahPeran(a, e.target.value)}
                      aria-label={`Peran ${a.full_name || a.email}`}
                      className="text-xs border rounded-md px-2 py-1.5 bg-background lg:w-full"
                    >
                      {PERAN.map(p => <option key={p} value={p}>{labelPeran(p)}</option>)}
                    </select>

                    <span className="text-xs text-muted-foreground lg:block">
                      {a.permissions !== null
                        ? <span className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400 font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />izin khusus
                          </span>
                        : <span>{ringkas(dipilih)}</span>}
                    </span>

                    <span className="flex items-center gap-2 lg:justify-end">
                      {/* Nonaktifkan = cabut akses login tanpa menghapus data.
                          Ini pilihan yang dianjurkan untuk akun yang tidak dipakai lagi. */}
                      {!sendiri && (
                        <button
                          onClick={() => ubahStatus(a, a.status === 'approved' ? 'nonaktif' : 'approved')}
                          title={a.status === 'approved'
                            ? 'Cabut akses login. Data tetap utuh dan tetap punya pemilik.'
                            : 'Beri akses login kembali.'}
                          className={`text-xs px-2 py-1.5 rounded border inline-flex items-center gap-1 transition-colors ${
                            a.status === 'approved'
                              ? 'hover:bg-amber-500/10 hover:border-amber-500/40 hover:text-amber-600'
                              : 'border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10'
                          }`}
                        >
                          {a.status === 'approved'
                            ? <><Ban className="h-3 w-3" />Nonaktifkan</>
                            : <><CheckCircle2 className="h-3 w-3" />Aktifkan</>}
                        </button>
                      )}

                      {/* Hapus = benar-benar hilang. Diberi peringatan bila akun masih
                          punya data, karena data itu akan kehilangan pemilik. */}
                      {!sendiri && (
                        <button
                          onClick={() => hapusAkun(a)}
                          title={a.milik?.total
                            ? `Akun ini memiliki ${a.milik.total} data — akan diberi peringatan`
                            : 'Hapus akun ini'}
                          className="text-xs px-2 py-1.5 rounded border inline-flex items-center gap-1 transition-colors hover:bg-destructive/10 hover:border-destructive/40 hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />Hapus
                          {!!a.milik?.total && (
                            <span className="text-[10px] px-1 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 font-medium">
                              {a.milik.total}
                            </span>
                          )}
                        </button>
                      )}
                    </span>
                  </div>
                </div>

                {/* ── Checklist hak akses ── */}
                {buka && (
                  <div className="border-t bg-muted/30 p-4">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        <p className="text-sm font-semibold">Hak akses</p>
                        <span className="text-xs text-muted-foreground">
                          bawaan {labelPeran(a.role as Peran)}: {bawaan.filter(k => k !== '*').length} izin
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => setDraf(d => ({ ...d, [a.id]: izinEfektif(a.role, null) }))}
                                className="text-xs px-2.5 py-1.5 rounded-md border bg-background hover:bg-muted transition-colors">
                          Isi dengan bawaan peran
                        </button>
                        <button onClick={() => setDraf(d => ({ ...d, [a.id]: [] }))}
                                className="text-xs px-2.5 py-1.5 rounded-md border bg-background hover:bg-muted transition-colors">
                          Kosongkan
                        </button>
                        <button onClick={() => resetBawaan(a)}
                                className="text-xs px-2.5 py-1.5 rounded-md border bg-background hover:bg-muted transition-colors inline-flex items-center gap-1">
                          <RotateCcw className="h-3 w-3" />Bawaan
                        </button>
                      </div>
                    </div>

                    {/* Data milik akun — admin perlu tahu ini sebelum menghapus,
                        karena data akan kehilangan pemilik. */}
                    {a.milik && a.milik.total > 0 && (
                      <div className="mb-3 text-xs rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 p-2.5 flex items-start gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>
                          Akun ini memiliki <b>{a.milik.total} data</b>
                          {' '}({[a.milik.sph ? `${a.milik.sph} SPH/SPK` : null,
                                   a.milik.lead ? `${a.milik.lead} lead` : null,
                                   a.milik.survey ? `${a.milik.survey} survey` : null,
                                   a.milik.po ? `${a.milik.po} PO` : null]
                                  .filter(Boolean).join(', ')}).
                          {' '}Menghapus akunnya membuat data itu tidak terlihat sales mana pun —{' '}
                          <b>sebaiknya nonaktifkan saja</b>.
                        </span>
                      </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                              className="text-xs px-3 py-2 rounded-md bg-primary text-primary-foreground font-medium
                                         disabled:opacity-50 inline-flex items-center gap-1.5 hover:bg-primary/90 transition-colors">
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
        </>
      )}
    </div>
  );
}
