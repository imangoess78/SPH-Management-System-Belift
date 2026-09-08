import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !fullName.trim() || !password.trim()) {
      toast.error('Email dan password wajib diisi');
      return;
    }
    if (password !== confirm) {
      toast.error('Konfirmasi password tidak sama');
      return;
    }
    setLoading(true);
    const response = await fetch('/api/auth/signup', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ email, password, fullName }) });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      toast.error(result.error || 'Signup gagal');
      return;
    }
    toast.success(result.message || 'Pendaftaran berhasil. Tunggu persetujuan Admin.');
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl border shadow-lg p-8">
          <div className="text-center mb-8">
            <img src="/BELIFT-Logo-White.webp" alt="Belift" className="w-20 h-20 mx-auto mb-4 object-contain" />
            <h1 className="text-xl font-bold text-foreground font-sans">Buat Akun Baru</h1>
            <p className="text-sm text-muted-foreground mt-1">SPH Management System</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="fullName">Nama Lengkap</Label>
              <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nama lengkap" autoComplete="name" />
            </div>
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
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label htmlFor="confirm">Konfirmasi Password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="• • • • • • • •"
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {loading ? 'Mendaftarkan...' : 'Daftar'}
            </Button>
          </form>
        </div>

        <div className="text-center text-xs text-muted-foreground mt-6 space-y-1">
          <p>
            Sudah punya akun?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">Masuk</Link>
          </p>
          <p>© {new Date().getFullYear()} PT. Belift Amanah Indonesia</p>
        </div>
      </div>
    </div>
  );
}
