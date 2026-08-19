import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
type User = { id: string; email?: string; role?: string; fullName?: string };
type Session = { user: User };

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: string | null;
  fullName: string;
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
  const [loading, setLoading] = useState(true);

  const applyUser = (u: User | null) => { setUser(u); setRole(u?.role ?? null); setFullName(u?.fullName ?? ''); setSession(u ? { user: u } : null); };

  useEffect(() => {
    fetch('/api/auth/session').then(r => r.json()).then(({ user }) => applyUser(user)).finally(() => setLoading(false));
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
    <AuthContext.Provider value={{ user, session, role, fullName, loading, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
