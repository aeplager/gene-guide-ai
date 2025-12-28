import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginScreen from "./pages/LoginScreen";
import IntroductoryScreen from "./pages/IntroductoryScreen";
import ConditionScreen from "./pages/ConditionScreen";
import ConsultationTypeScreen from "./pages/ConsultationTypeScreen";
import QAScreen from "./pages/QAScreen";
import AudioScreen from "./pages/AudioScreen";
import NotFound from "./pages/NotFound";
import LegacyForever from "./pages/LegacyForever";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginScreen />} />
          <Route path="/introduction" element={<IntroductoryScreen />} />
          <Route path="/conditions" element={<ConditionScreen />} />
          <Route path="/consultation-type" element={<ConsultationTypeScreen />} />
          <Route path="/qa" element={<QAScreen />} />
          <Route path="/audio" element={<AudioScreen />} />
          <Route path="/Legacy-Forever" element={<LegacyForever />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
