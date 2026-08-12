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

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Memuat...</div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/signup" element={user ? <Navigate to="/" replace /> : <SignupPage />} />
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
              <Route path="/master" element={<MasterData />} />
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
