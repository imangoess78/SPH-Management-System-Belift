import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, PlusCircle, Database, Settings, ChevronLeft, Menu, LogOut, User, X, BarChart3, ShieldCheck, Calculator, Target, KanbanSquare, Clock3, BadgePercent, Table2, TrendingUp, ClipboardList, ClipboardCheck, Factory, GitCompare, Ruler } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { KunciHalaman } from '../../shared/akses';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Grup menu — disusun MENGIKUTI ALUR KERJA (permintaan klien, lihat PRD baris 271):
//   CRM/Leads → Survey Sales → SPH → SPK → Final Survey → PO Pabrik
// Menu pendukung (Laporan, Master, Kalkulator, Pengaturan) diletakkan paling bawah.
// `izin` = halaman yang berwenang membuka menu ini. Menu disembunyikan bila
// akun tidak punya izinnya. Ini hanya kerapian — API tetap menolak sendiri.
const NAV_GROUPS: { judul: string | null; item: { to: string; icon: typeof LayoutDashboard; label: string; izin?: KunciHalaman }[] }[] = [
  {
    judul: null,
    item: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    judul: 'CRM Sales',
    item: [
      { to: '/crm/leads', icon: Target, label: 'Leads', izin: 'crm' },
      { to: '/crm/kanban', icon: KanbanSquare, label: 'Papan Kanban', izin: 'crm' },
      { to: '/crm/diskon', icon: BadgePercent, label: 'Approval Diskon', izin: 'crm' },
      { to: '/crm/dokumen', icon: Clock3, label: 'Meja Dokumen', izin: 'crm' },
      { to: '/crm/iklan', icon: TrendingUp, label: 'Efektivitas Iklan', izin: 'crm' },
      { to: '/crm/master', icon: Table2, label: 'Master CRM', izin: 'master' },
    ],
  },
  {
    // Tahap 1–4 alur kerja setelah lead masuk
    judul: 'Alur Proyek',
    item: [
      // Sementara hanya admin: modul baru, sedang ditinjau sebelum dibuka
      // untuk semua peran. Hapus adminOnly untuk membuka ke semua pengguna.
      { to: '/survey/sales', icon: ClipboardList, label: '1. Survey Sales', izin: 'survey_sales' },
      { to: '/sph/new', icon: PlusCircle, label: '2a. Buat SPH Baru' },
      { to: '/sph', icon: FileText, label: '2b. Riwayat SPH' },
      { to: '/spk/new', icon: PlusCircle, label: '3a. Buat SPK Baru' },
      { to: '/spk', icon: FileText, label: '3b. Riwayat SPK' },
      { to: '/survey/final', icon: ClipboardCheck, label: '4. Final Survey', izin: 'survey_final' },
      { to: '/po', icon: Factory, label: '5. PO Pabrik', izin: 'po' },
    ],
  },
  {
    judul: null,
    item: [
      { to: '/reports', icon: BarChart3, label: 'Laporan', izin: 'laporan' },
      { to: '/master', icon: Database, label: 'Master Data', izin: 'master' },
      { to: '/kalkulator', icon: Calculator, label: 'Kalkulator' },
      { to: '/settings', icon: Settings, label: 'Pengaturan' },
      { to: '/admin/emergency-backup', icon: ShieldCheck, label: 'Emergency Backup', izin: 'backup' },
      { to: '/admin/users', icon: ShieldCheck, label: 'Manajemen Akun', izin: 'akun' },
    ],
  },
];

// Item lama (dipakai untuk pengecekan menu aktif)
const NAV_ITEMS = NAV_GROUPS.flatMap(g => g.item);

// Path khusus CRM: harus persis /crm/leads, bukan ikut aktif saat di /crm/leads/123
const PATH_PERSIS = new Set(['/sph/new', '/spk/new', '/crm/leads', '/crm/kanban', '/crm/diskon', '/crm/dokumen', '/crm/iklan', '/crm/master', '/survey/sales', '/survey/final', '/po']);
// Path induk yang tetap aktif saat halaman anak dibuka
const PATH_INDUK = new Set(['/sph', '/spk']);
// Path yang boleh aktif berdampingan dengan sub-path CRM
const PATH_TANPA_AKTIF_ANAK = new Set(['/']);

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
  const { fullName, role, signOut, izin: daftarIzin } = useAuth();

  return (
    <TooltipProvider delayDuration={0}>
      <div className={`${isMobileOverlay ? 'w-64' : collapsed ? 'w-16' : 'w-64'} bg-sidebar flex flex-col h-full transition-all duration-300`}>
      {/* Logo */}
      <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0">
          <img src="/favicon.ico" alt="Belift" className="h-[23px] w-[23px] object-contain" />
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
        {NAV_GROUPS.map((grup, gi) => {
          const item = grup.item.filter(i => !i.izin || daftarIzin.includes(i.izin) || daftarIzin.includes('*'));
          if (item.length === 0) return null;
          return (
            <div key={gi} className={grup.judul ? 'pt-2' : ''}>
              {grup.judul && (!collapsed || isMobileOverlay) && (
                <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  {grup.judul}
                </p>
              )}
              {grup.judul && collapsed && !isMobileOverlay && (
                <div className="mx-2 mb-1 border-t border-sidebar-border" />
              )}
              <div className="space-y-1">
                {item.map(it => {
                  // Menu induk tetap harus aktif saat halaman anak dibuka
                  const anakDariPath = PATH_INDUK.has(it.to) || it.to === '/survey/sales' || it.to === '/survey/final';
                  const active = location.pathname === it.to ||
                    (!PATH_PERSIS.has(it.to) && !PATH_TANPA_AKTIF_ANAK.has(it.to) && location.pathname.startsWith(it.to)) ||
                    (anakDariPath && location.pathname.startsWith(it.to + '/'));
                  return (
                    <Tooltip key={it.to}>
                      <TooltipTrigger asChild>
                        <Link
                          to={it.to}
                          onClick={onClose}
                          aria-label={it.label}
                          className={`nav-item ${active ? 'nav-item-active' : ''}`}
                        >
                          <it.icon className="w-4 h-4 shrink-0" />
                          {(!collapsed || isMobileOverlay) && <span>{it.label}</span>}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent
                        side="right"
                        align="center"
                        sideOffset={8}
                        hidden={!collapsed || isMobileOverlay}
                      >
                        {it.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
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
    </TooltipProvider>
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
          <img src="/BELIFT-Logo-White.webp" alt="Belift" className="h-[23px] w-auto object-contain" />
        </div>

        <div className="p-4 md:p-6 max-w-7xl mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
