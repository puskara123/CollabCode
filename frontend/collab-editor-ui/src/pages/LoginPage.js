import { useState } from "react";

import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const destination = location.state?.from?.pathname || "/doc/default";

    async function handleLogin(e) {
        e.preventDefault();
        setError("");
        const response = await fetch(
            "http://localhost:8080/auth/login",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username,
                    password
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            setError(data.error);
            return;
        }

        login({
            token: data.token,
            userId: null,
            displayName: null,
            color: null
        });
        navigate(destination, {replace : true});
    }

    return (
        <div>
            <h2>Login</h2>
            <form onSubmit={handleLogin}>
                <input
                    placeholder="Username"
                    value={username}
                    onChange={(e) =>
                        setUsername(e.target.value)
                    }
                />
                <br />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) =>
                        setPassword(e.target.value)
                    }
                />
                <br />
                <button type="submit">
                    Login
                </button>
            </form>
            <p style={{color:"red"}}>
                {error}
            </p>
        </div>
    );
}