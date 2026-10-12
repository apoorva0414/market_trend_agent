import { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Header } from "./components/Header";
import { Act } from "./pages/Act";
import { ActivityLog } from "./pages/ActivityLog";
import { Brief } from "./pages/Brief";
import { EmailLanding } from "./pages/EmailLanding";
import { Stub } from "./pages/Stub";
import { AppProvider } from "./state/AppContext";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    // HashRouter keeps every route under index.html, so deep links work on GitHub Pages without server rewrites.
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppProvider>
        <ScrollToTop />
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<EmailLanding />} />
            <Route path="/brief" element={<Brief />} />
            <Route path="/act" element={<Act />} />
            <Route path="/portfolio-review/:handoffId" element={<Stub kind="portfolio-review" />} />
            <Route path="/proposal/:handoffId" element={<Stub kind="proposal" />} />
            <Route path="/log" element={<ActivityLog />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </AppProvider>
    </HashRouter>
  );
}
