import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
type User = {
  id: string; email?: string; role?: string; fullName?: string;
  permissions?: string[]; namaSales?: string;
};
type Session = { user: User };

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: string | null;
  fullName: string;
  /** Izin efektif akun ini (gabungan peran + penyesuaian khusus). */
  izin: string[];
  namaSales: string;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [izin, setIzin] = useState<string[]>([]);
  const [namaSales, setNamaSales] = useState('');
  const [loading, setLoading] = useState(true);

  const applyUser = (u: User | null) => {
    setUser(u);
    setRole(u?.role ?? null);
    setFullName(u?.fullName ?? '');
    // Izin datang dari server. Tampilan hanya memakainya untuk menyembunyikan
    // menu — penolakan yang sebenarnya terjadi di API.
    setIzin(u?.permissions ?? []);
    setNamaSales(u?.namaSales ?? '');
    setSession(u ? { user: u } : null);
  };

  useEffect(() => {
    let active = true;
    fetch(`/api/auth/session?_=${Date.now()}`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async r => {
        if (!r.ok) throw new Error(`Session check failed: ${r.status}`);
        return r.json();
      })
      .then(({ user }) => { if (active) applyUser(user); })
      .catch(() => { if (active) applyUser(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; }
  }, []);

  const signIn = async (email: string, password: string) => {
    const r = await fetch('/api/auth/login', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ email, password }) });
    if (!r.ok) { const d = await r.json().catch(() => ({})); return { error: new Error(d.error || 'Login gagal') }; }
    const { user: u } = await r.json(); applyUser(u); return { error: null };
  };

  const refreshProfile = async () => {
    const { user: u } = await fetch('/api/auth/session').then(r => r.json()); applyUser(u);
  };

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }); applyUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, fullName, izin, namaSales, loading, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
