import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { User, Lock } from 'lucide-react';

export default function SettingsPage() {
  const { user, fullName, refreshProfile } = useAuth();
  const { toast } = useToast();

  // --- Display name state ---
  const [displayName, setDisplayName] = useState(fullName);
  const [savingName, setSavingName] = useState(false);

  // --- Password state ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSaveDisplayName = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      toast({ title: 'Nama tidak boleh kosong', variant: 'destructive' });
      return;
    }
    if (!user) return;

    setSavingName(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: trimmed })
      .eq('user_id', user.id);

    if (error) {
      toast({ title: 'Gagal menyimpan nama', description: error.message, variant: 'destructive' });
    } else {
      await refreshProfile();
      toast({ title: 'Nama berhasil diperbarui' });
    }
    setSavingName(false);
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword || !currentPassword) {
      toast({ title: 'Semua kolom password harus diisi', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Konfirmasi password tidak cocok', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: 'Password minimal 6 karakter', variant: 'destructive' });
      return;
    }

    setSavingPassword(true);

    // Re-authenticate first to verify current password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user?.email ?? '',
      password: currentPassword,
    });

    if (signInError) {
      toast({ title: 'Password saat ini salah', variant: 'destructive' });
      setSavingPassword(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      toast({ title: 'Gagal mengubah password', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Password berhasil diubah' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    setSavingPassword(false);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Pengaturan</h1>
        <p className="text-sm text-muted-foreground mt-1">Kelola akun dan preferensi Anda</p>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* --- Profil Pengguna --- */}
        <div className="bg-card rounded-xl border shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <User className="w-4 h-4 text-muted-foreground" />
            <h2 className="section-title">Profil Pengguna</h2>
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={user?.email ?? ''}
              disabled
              className="mt-1 bg-muted text-muted-foreground cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground mt-1">Email tidak dapat diubah.</p>
          </div>

          <div>
            <Label htmlFor="displayName">Nama Tampilan</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Masukkan nama Anda"
              className="mt-1"
            />
          </div>

          <Button onClick={handleSaveDisplayName} disabled={savingName}>
            {savingName ? 'Menyimpan...' : 'Simpan Nama'}
          </Button>
        </div>

        {/* --- Ganti Password --- */}
        <div className="bg-card rounded-xl border shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <h2 className="section-title">Ganti Password</h2>
          </div>

          <div>
            <Label htmlFor="currentPassword">Password Saat Ini</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="newPassword">Password Baru</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="confirmPassword">Konfirmasi Password Baru</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1"
            />
          </div>

          <Button onClick={handleChangePassword} disabled={savingPassword}>
            {savingPassword ? 'Memproses...' : 'Ganti Password'}
          </Button>
        </div>
      </div>
    </div>
  );
}
