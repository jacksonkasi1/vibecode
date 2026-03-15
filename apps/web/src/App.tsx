// ** import lib
import { Routes, Route, Navigate } from "react-router-dom";
import { SignedIn, SignedOut } from "@daveyplate/better-auth-ui";

// ** import pages
import AuthPage from "@/pages/auth/AuthPage";
import ResetPassword from "@/pages/auth/ResetPassword";
import Apps from "@/pages/Apps";
import Project from "@/pages/Project";
import Settings from "@/pages/Settings";
import AIModelSettings from "@/pages/AIModelSettings";

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <>
            <SignedIn>
              <Navigate to="/apps" replace />
            </SignedIn>
            <SignedOut>
              <Navigate to="/auth/sign-in" replace />
            </SignedOut>
          </>
        }
      />
      <Route path="/auth/:pathname" element={<AuthPage />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/apps" element={<Apps />} />
      <Route path="/projects/:id" element={<Project />} />
      <Route path="/account/settings" element={<Settings />} />
      <Route path="/account/ai-model-settings" element={<AIModelSettings />} />
    </Routes>
  );
}
