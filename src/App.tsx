import { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { Header } from "./components/Header";
import { ActivityLog } from "./pages/ActivityLog";
import { AlertOverview, AlertsHome, ClientWorkspace } from "./pages/Alerts";
import { Inbox } from "./pages/Inbox";
import { UpcomingReviews } from "./pages/ReviewLog";
import { AppProvider } from "./state/AppContext";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function LegacyReviewRedirect() {
  const { clientId } = useParams();
  return <Navigate to={`/reviews/${clientId ?? ""}`} replace />;
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
            <Route path="/" element={<Inbox />} />
            <Route path="/alerts" element={<AlertsHome />} />
            <Route path="/alerts/:alertId" element={<AlertOverview />} />
            <Route path="/alerts/:alertId/client/:clientId" element={<ClientWorkspace />} />
            <Route path="/reviews" element={<UpcomingReviews />} />
            <Route path="/reviews/:clientId" element={<UpcomingReviews />} />
            {/* Earlier routes for the review log and the Portfolio Review view. */}
            <Route path="/review-log" element={<Navigate to="/reviews" replace />} />
            <Route path="/portfolio-review/:clientId" element={<LegacyReviewRedirect />} />
            <Route path="/log" element={<ActivityLog />} />
            {/* The brief page (update 3) and the Act page (update 2) were removed. Old links land on the inbox. */}
            <Route path="/brief" element={<Navigate to="/" replace />} />
            <Route path="/act" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </AppProvider>
    </HashRouter>
  );
}
