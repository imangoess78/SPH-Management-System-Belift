import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, PlusCircle, Database, Settings, ChevronLeft, Menu, LogOut, User, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/sph/new', icon: PlusCircle, label: 'Buat SPH Baru' },
  { to: '/sph', icon: FileText, label: 'Riwayat SPH' },
  { to: '/spk/new', icon: PlusCircle, label: 'Buat SPK Baru' },
  { to: '/spk', icon: FileText, label: 'Riwayat SPK' },
  { to: '/master', icon: Database, label: 'Master Data' },
  { to: '/settings', icon: Settings, label: 'Pengaturan' },
];

function SidebarContent({
  collapsed,
  onCollapse,
  onClose,
  isMobileOverlay,
}: {
  collapsed: boolean;
  onCollapse: () => void;
  onClose?: () => void;
  isMobileOverlay?: boolean;
}) {
  const location = useLocation();
  const { fullName, role, signOut } = useAuth();

  return (
    <div className={`${isMobileOverlay ? 'w-64' : collapsed ? 'w-16' : 'w-64'} bg-sidebar flex flex-col h-full transition-all duration-300`}>
      {/* Logo */}
      <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0">
          <img src="/favicon.ico" alt="Belift" className="w-7 h-7 object-contain" />
        </div>
        {(!collapsed || isMobileOverlay) && (
          <div className="overflow-hidden flex-1">
            <h1 className="text-sm font-bold text-sidebar-foreground leading-tight font-sans">PT. Belift Amanah Indonesia</h1>
            <p className="text-[10px] text-sidebar-foreground/50">SPH Management System</p>
          </div>
        )}
        {/* Close button for mobile overlay */}
        {isMobileOverlay && onClose && (
          <button onClick={onClose} className="text-sidebar-foreground/70 hover:text-sidebar-foreground shrink-0">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const active = location.pathname === item.to ||
            (item.to !== '/' && item.to !== '/sph/new' && item.to !== '/spk/new' && location.pathname.startsWith(item.to));
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={`nav-item ${active ? 'nav-item-active' : ''}`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {(!collapsed || isMobileOverlay) && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      {(!collapsed || isMobileOverlay) && (
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0">
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

      {/* Collapse toggle — desktop only */}
      {!isMobileOverlay && (
        <button
          onClick={onCollapse}
          className="p-3 border-t border-sidebar-border text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors flex items-center justify-center"
        >
          {collapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Desktop sidebar (hidden on mobile) ─────────────────── */}
      <aside className="hidden md:flex shrink-0 border-r border-sidebar-border">
        <SidebarContent
          collapsed={collapsed}
          onCollapse={() => setCollapsed(!collapsed)}
        />
      </aside>

      {/* ── Mobile overlay backdrop ──────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer ────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent
          collapsed={false}
          onCollapse={() => {}}
          isMobileOverlay
          onClose={() => setMobileOpen(false)}
        />
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto">
        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-[hsl(var(--sidebar-background))] border-b border-sidebar-border">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-sidebar-foreground"
            aria-label="Buka menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 22, letterSpacing: '.06em', color: '#fff' }}
          >
            BEL<span style={{ color: '#D95103' }}>IFT</span>
          </span>
        </div>

        <div className="p-4 md:p-6 max-w-7xl mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
