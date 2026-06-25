import { createContext, useContext, useState } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [jwt, setJwt] = useState(null);
    const [userId, setUserId] = useState(null);
    const [displayName, setDisplayName] = useState(null);
    const [color, setColor] = useState(null);
    function login(authData) {
        setJwt(authData.token);
        setUserId(authData.userId);
        setDisplayName(authData.displayName);
        setColor(authData.color);
    }
    function logout() {
        setJwt(null);
        setUserId(null);
        setDisplayName(null);
        setColor(null);
    }
    return (
        <AuthContext.Provider
            value={{
                jwt,
                userId,
                displayName,
                color,
                login,
                logout
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}