import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import AppErrorBoundary from './components/AppErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import ResultsPage from './pages/ResultsPage';
import SignupPage from './pages/SignupPage';
import StudioPage from './pages/StudioPage';
import WorkflowReviewPage from './pages/WorkflowReviewPage';

function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <Router>
          <div className="app-colorwash min-h-screen text-white selection:bg-primary/30">
            <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route
                path="/studio"
                element={
                  <ProtectedRoute>
                    <StudioPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/studio/review"
                element={<Navigate to="/studio/review/0" replace />}
              />
              <Route
                path="/studio/review/:step"
                element={
                  <ProtectedRoute>
                    <WorkflowReviewPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/studio/results"
                element={
                  <ProtectedRoute>
                    <ResultsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </AppErrorBoundary>
  );
}

export default App;
