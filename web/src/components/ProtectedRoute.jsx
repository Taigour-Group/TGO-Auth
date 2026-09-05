import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import { Spinner } from './ui.jsx';

// Guards the account console. While the session check is in flight we show a
// spinner; if there's no session we send the user to sign in.
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="grid min-h-full place-items-center">
        <Spinner />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}
