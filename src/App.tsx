import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import AppLayout from "./components/AppLayout";
import Index from "./pages/Index";
import SPHForm from "./pages/SPHForm";
import SPHList from "./pages/SPHList";
import SPKList from "./pages/SPKList";
import SPKNew from "./pages/SPKNew";
import SPHPreview from "./pages/SPHPreview";
import MasterData from "./pages/MasterData";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import NotFound from "./pages/NotFound";
import EmergencyBackup from "./pages/EmergencyBackup";
import AdminUsers from "./pages/AdminUsers";
import Reports from "./pages/Reports";
import Kalkulator from "./pages/Kalkulator";
import LeadsList from "./pages/crm/LeadsList";
import LeadInput from "./pages/crm/LeadInput";
import Kanban from "./pages/crm/Kanban";
import IklanDashboard from "./pages/crm/IklanDashboard";
import DokumenPage from "./pages/crm/Dokumen";
import ApprovalDiskon from "./pages/crm/ApprovalDiskon";
import CrmMaster from "./pages/crm/CrmMaster";
import SurveyList from "./pages/survey/SurveyList";
import SurveyForm from "./pages/survey/SurveyForm";
import SurveyPilihLead from "./pages/survey/SurveyPilihLead";
import SurveyLacak from "./pages/survey/SurveyLacak";
import SurveyPreview from "./pages/survey/SurveyPreview";
import PoList from "./pages/po/PoList";
import PoDetail from "./pages/po/PoDetail";
import PoPreview from "./pages/po/PoPreview";
import PoPilihProyek from "./pages/po/PoPilihProyek";

// Renders SPKNew picker when no ?from= param, otherwise renders SPHForm pre-populated
function SPKNewOrForm() {
  const [searchParams] = useSearchParams();
  const fromId = searchParams.get('from');
  if (fromId) return <SPHForm defaultMode="SPK" />;
  return <SPKNew />;
}

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Memuat...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6">Memuat...</div>;
  return user?.role === 'admin' ? <>{children}</> : <Navigate to="/" replace />;
}
function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Memuat...</div>;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      {/* Publik: kalkulator harga per komponen — tanpa login */}
      <Route path="/kalkulator" element={<Kalkulator />} />
      {/* Generator: full-bleed, no AppLayout sidebar */}
      <Route path="/sph/new" element={<ProtectedRoute><SPHForm defaultMode="SPH" /></ProtectedRoute>} />
      <Route path="/sph/:id" element={<ProtectedRoute><SPHForm defaultMode="SPH" /></ProtectedRoute>} />
      <Route path="/sph/:id/edit" element={<ProtectedRoute><SPHForm defaultMode="SPH" /></ProtectedRoute>} />
      <Route path="/spk/new" element={<ProtectedRoute><SPKNewOrForm /></ProtectedRoute>} />
      <Route path="/spk/:id/edit" element={<ProtectedRoute><SPHForm defaultMode="SPK" /></ProtectedRoute>} />
      <Route path="*" element={
        <ProtectedRoute>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/sph" element={<SPHList />} />
              <Route path="/sph/:id/preview" element={<SPHPreview />} />
              <Route path="/spk/:id/preview" element={<SPHPreview />} />
              <Route path="/spk" element={<SPKList />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/master" element={<MasterData />} />
              <Route path="/crm/leads" element={<LeadsList />} />
              <Route path="/crm/leads/baru" element={<LeadInput />} />
              <Route path="/crm/leads/:id" element={<LeadInput />} />
              <Route path="/crm/kanban" element={<Kanban />} />
              <Route path="/crm/iklan" element={<IklanDashboard />} />
              <Route path="/crm/dokumen" element={<DokumenPage />} />
              <Route path="/crm/diskon" element={<ApprovalDiskon />} />
              <Route path="/crm/master" element={<CrmMaster />} />

              {/* ── Survey & PO — SEMENTARA HANYA ADMIN ──
                  Modul baru, masih ditinjau sebelum dibuka untuk semua peran.
                  Untuk membuka ke semua pengguna: hapus pembungkus <AdminOnly>
                  di bawah, dan hapus `adminOnly: true` pada grup 'Survey & PO'
                  di src/components/AppLayout.tsx. */}

              {/* ── Survey Sales ── */}
              <Route path="/survey/sales" element={<AdminOnly><SurveyList jenis="sales" /></AdminOnly>} />
              <Route path="/survey/sales/pilih" element={<AdminOnly><SurveyPilihLead jenis="sales" /></AdminOnly>} />
              <Route path="/survey/sales/baru" element={<AdminOnly><SurveyForm jenis="sales" /></AdminOnly>} />
              <Route path="/survey/sales/:id" element={<AdminOnly><SurveyForm jenis="sales" /></AdminOnly>} />
              <Route path="/survey/sales/:id/preview" element={<AdminOnly><SurveyPreview jenis="sales" /></AdminOnly>} />

              {/* ── Final Survey ── */}
              <Route path="/survey/final" element={<AdminOnly><SurveyList jenis="final" /></AdminOnly>} />
              <Route path="/survey/final/pilih" element={<AdminOnly><SurveyPilihLead jenis="final" /></AdminOnly>} />
              <Route path="/survey/final/baru" element={<AdminOnly><SurveyForm jenis="final" /></AdminOnly>} />
              <Route path="/survey/final/:id" element={<AdminOnly><SurveyForm jenis="final" /></AdminOnly>} />
              <Route path="/survey/final/:id/preview" element={<AdminOnly><SurveyPreview jenis="final" /></AdminOnly>} />

              {/* ── Lacak perubahan data teknis ── */}
              <Route path="/lacak/:idLead" element={<AdminOnly><SurveyLacak /></AdminOnly>} />

              {/* ── PO Pabrik ── */}
              <Route path="/po" element={<AdminOnly><PoList /></AdminOnly>} />
              <Route path="/po/pilih" element={<AdminOnly><PoPilihProyek /></AdminOnly>} />
              <Route path="/po/baru" element={<AdminOnly><PoDetail /></AdminOnly>} />
              <Route path="/po/:id" element={<AdminOnly><PoDetail /></AdminOnly>} />
              <Route path="/po/:id/preview" element={<AdminOnly><PoPreview /></AdminOnly>} />
              <Route path="/admin/users" element={<AdminOnly><AdminUsers /></AdminOnly>} />
              <Route path="/admin/user" element={<AdminOnly><AdminUsers /></AdminOnly>} />
              <Route path="/admin/emergency-backup" element={<AdminOnly><EmergencyBackup /></AdminOnly>} />
              <Route path="/emergency-backup" element={<AdminOnly><EmergencyBackup /></AdminOnly>} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
