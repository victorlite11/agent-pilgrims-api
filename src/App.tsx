import { Toaster } from "@/components/ui/toaster";
import "../src/i18n";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/AdminLogin";
import AgentLogin from "./pages/AgentLogin";
import PilgrimLogin from "./pages/PilgrimLogin";
import AgentDashboardPage from "./pages/AgentDashboardPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import PilgrimDashboardPage from "./pages/PilgrimDashboardPage";
import SignUpPage from "./pages/SignUpPage";
import SignupConfirmation from "./pages/SignupConfirmation";
import AdminEntryPage from "./pages/AdminEntryPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/agent-login" element={<AgentLogin />} />
          <Route path="/pilgrim-login" element={<PilgrimLogin />} />
          <Route path="/agent-dashboard" element={<AgentDashboardPage />} />
          <Route path="/admin-dashboard" element={<AdminDashboardPage />} />
          <Route path="/pilgrim-dashboard" element={<PilgrimDashboardPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/signup-confirmation" element={<SignupConfirmation />} />
          {/* Direct routes for admin and agents */}
          // ...existing code...
            <Route path="/admin" element={<AdminEntryPage />} />
          <Route path="/agents" element={<AgentDashboardPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
