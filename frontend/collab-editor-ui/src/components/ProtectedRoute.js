import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
    const { jwt } = useAuth();
    const location = useLocation();
    if (!jwt) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }
    return children;
}