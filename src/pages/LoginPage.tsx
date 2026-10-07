import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, KeyRound, Loader2, LogIn } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Halaman masuk, sekaligus halaman "Lupa password".
 *
 * Aplikasi ini tidak punya layanan email, jadi lupa password TIDAK
 * memakai tautan reset lewat surel. Alurnya: pengguna meminta kode ke
 * Admin (WhatsApp/lisan), lalu memasukkan email + kode + password baru
 * di formulir ini.
 *
 * Keduanya sengaja dibuat satu halaman supaya pengguna yang gagal masuk
 * langsung melihat jalannya tanpa harus mencari tautan di tempat lain.
 */
export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'masuk' | 'lupa'>('masuk');

  // ── Formulir masuk ──
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Formulir lupa password ──
  const [lupaEmail, setLupaEmail] = useState('');
  const [kode, setKode] = useState('');
  const [sandiBaru, setSandiBaru] = useState('');
  const [ulangi, setUlangi] = useState('');
  const [loadingLupa, setLoadingLupa] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error('Email dan password wajib diisi');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast.error('Login gagal. Periksa email dan password Anda.');
    } else {
      toast.success('Login berhasil!');
      navigate('/');
    }
  };

  const handleLupa = async (e: React.FormEvent) => {
    e.preventDefault();
    const surel = lupaEmail.trim();
    const angka = kode.replace(/\D/g, '');

    if (!surel || !angka || !sandiBaru || !ulangi) {
      toast.error('Semua kolom wajib diisi');
      return;
    }
    if (angka.length !== 8) {
      toast.error('Kode harus 8 angka, sesuai yang diberikan Admin');
      return;
    }
    if (sandiBaru !== ulangi) {
      toast.error('Ulangi password belum sama');
      return;
    }
    if (sandiBaru.length < 8) {
      toast.error('Password baru minimal 8 karakter');
      return;
    }

    setLoadingLupa(true);
    let hasil: { error?: string; pesan?: string; sesiDiputus?: number } = {};
    try {
      const r = await fetch('/api/auth/lupa-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: surel, kode: angka, passwordBaru: sandiBaru }),
      });
      hasil = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(hasil.error || 'Gagal mengganti password');
        return;
      }
    } catch {
      toast.error('Gagal menghubungi server. Periksa koneksi Anda.');
      return;
    } finally {
      setLoadingLupa(false);
    }

    toast.success(hasil.pesan || 'Password berhasil diganti. Silakan masuk.');
    if (hasil.sesiDiputus) {
      toast.info(`${hasil.sesiDiputus} sesi lama diputus, termasuk bila akun sedang dibuka di perangkat lain.`);
    }

    // Bawa pengguna kembali ke formulir masuk dengan emailnya sudah terisi —
    // jangan sampai dia mengetik ulang setelah berhasil mengganti password.
    setEmail(surel);
    setPassword('');
    setKode('');
    setSandiBaru('');
    setUlangi('');
    setMode('masuk');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl border shadow-lg p-8">
          {/* Logo & Header */}
          <div className="text-center mb-8">
            <img src="/BELIFT-Logo-White.webp" alt="Belift" className="w-20 h-20 mx-auto mb-4 object-contain" />
            <h1 className="text-xl font-bold text-foreground font-sans">SPH Management System</h1>
            <p className="text-sm text-muted-foreground mt-1">PT. Belift Amanah Indonesia</p>
          </div>

          {mode === 'masuk' ? (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="• • • • • • • •"
                    autoComplete="current-password"
                  />
                </div>
                <Button type="submit" className="w-full gap-2" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                  {loading ? 'Memproses...' : 'Masuk'}
                </Button>
              </form>

              <button
                type="button"
                onClick={() => { setLupaEmail(email); setMode('lupa'); }}
                className="mt-4 w-full text-center text-sm text-primary hover:underline font-medium inline-flex items-center justify-center gap-1.5"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Lupa password?
              </button>
            </>
          ) : (
            <form onSubmit={handleLupa} className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1.5">
                <p className="font-semibold text-foreground">Butuh kode dari Admin</p>
                <p>
                  Sistem ini tidak mengirim email. Minta <strong className="text-foreground">kode 8 angka</strong> ke
                  Admin, lalu masukkan di bawah ini bersama password baru Anda.
                </p>
                <p>Kode hanya berlaku 30 menit dan cuma bisa dipakai sekali.</p>
              </div>

              <div>
                <Label htmlFor="lupaEmail">Email akun</Label>
                <Input
                  id="lupaEmail"
                  type="email"
                  value={lupaEmail}
                  onChange={e => setLupaEmail(e.target.value)}
                  placeholder="nama@email.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <Label htmlFor="kode">Kode dari Admin</Label>
                <Input
                  id="kode"
                  inputMode="numeric"
                  value={kode}
                  onChange={e => setKode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="8 angka"
                  className="tracking-[0.3em] font-mono text-lg text-center"
                  autoComplete="one-time-code"
                />
              </div>

              <div>
                <Label htmlFor="sandiBaru">Password baru</Label>
                <Input
                  id="sandiBaru"
                  type="password"
                  value={sandiBaru}
                  onChange={e => setSandiBaru(e.target.value)}
                  placeholder="Minimal 8 karakter"
                  autoComplete="new-password"
                />
              </div>

              <div>
                <Label htmlFor="ulangi">Ulangi password baru</Label>
                <Input
                  id="ulangi"
                  type="password"
                  value={ulangi}
                  onChange={e => setUlangi(e.target.value)}
                  placeholder="Ulangi password baru"
                  autoComplete="new-password"
                />
              </div>

              <Button type="submit" className="w-full gap-2" disabled={loadingLupa}>
                {loadingLupa ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                {loadingLupa ? 'Menyimpan...' : 'Ganti password'}
              </Button>

              <button
                type="button"
                onClick={() => setMode('masuk')}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Kembali ke halaman masuk
              </button>
            </form>
          )}
        </div>

        <div className="text-center text-xs text-muted-foreground mt-6 space-y-1">
          <p>
            Belum punya akun?{' '}
            <a href="/signup" className="text-primary hover:underline font-medium">Daftar</a>
          </p>
          <p>© {new Date().getFullYear()} PT. Belift Amanah Indonesia</p>
        </div>
      </div>
    </div>
  );
}
