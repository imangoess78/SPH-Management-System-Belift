import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus, Loader2, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error('Email dan password wajib diisi');
      return;
    }
    if (password !== confirm) {
      toast.error('Konfirmasi password tidak sama');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message || 'Signup gagal');
      return;
    }
    toast.success('Akun berhasil dibuat. Silakan login.');
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
            <a href="/login" className="text-primary hover:underline font-medium">Masuk</a>
          </p>
          <p>© {new Date().getFullYear()} PT. Belift Amanah Indonesia</p>
        </div>
      </div>
    </div>
  );
}
