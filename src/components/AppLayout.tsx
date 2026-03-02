import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, PlusCircle, Database, Settings, ChevronLeft, Menu, LogOut, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/sph/new', icon: PlusCircle, label: 'Buat SPH Baru' },
  { to: '/sph', icon: FileText, label: 'Riwayat SPH' },
  { to: '/master', icon: Database, label: 'Master Data' },
  { to: '/settings', icon: Settings, label: 'Pengaturan' },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { fullName, role, signOut } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-16' : 'w-64'} bg-sidebar flex flex-col border-r border-sidebar-border transition-all duration-300 shrink-0`}>
        {/* Logo */}
        <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
          <img src="/logo.png" alt="Belift" className="w-9 h-9 rounded-lg object-contain bg-primary-foreground/10" />
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-sm font-bold text-sidebar-foreground leading-tight font-sans">PT. Belift Amanah Indonesia</h1>
              <p className="text-[10px] text-sidebar-foreground/50">SPH Management System</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(item => {
            const active = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
            return (
              <Link key={item.to} to={item.to} className={`nav-item ${active ? 'nav-item-active' : ''}`}>
                <item.icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User info */}
        {!collapsed && (
          <div className="p-3 border-t border-sidebar-border">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-sidebar-accent flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-sidebar-foreground" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-medium text-sidebar-foreground truncate">{fullName || 'User'}</p>
                <p className="text-[10px] text-sidebar-foreground/50 capitalize">{role || '-'}</p>
              </div>
            </div>
            <button onClick={signOut} className="nav-item w-full text-xs text-destructive/80 hover:text-destructive">
              <LogOut className="w-3.5 h-3.5" /> Keluar
            </button>
          </div>
        )}

        {/* Collapse toggle */}
        <button onClick={() => setCollapsed(!collapsed)} className="p-3 border-t border-sidebar-border text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors flex items-center justify-center">
          {collapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
