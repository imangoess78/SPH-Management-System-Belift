import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogIn, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
