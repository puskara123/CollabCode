import { useState } from "react";

import { useNavigate } from "react-router-dom";

export default function RegisterPage() {
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    async function handleRegister(e) {
        e.preventDefault();
        setError("");
        const response = await fetch(
            "http://localhost:8080/auth/register",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username,
                    displayName,
                    password
                })
            }
        );
        const data = await response.json();
        if (!response.ok) {
            setError(data.error);
            return;
        }
        navigate("/login");
    }

    return (
        <div>
            <h2>Register</h2>
            <form onSubmit={handleRegister}>
                <input
                    placeholder="Username"
                    value={username}
                    onChange={(e) =>
                        setUsername(e.target.value)
                    }
                />
                <br />
                <input
                    placeholder="Display Name"
                    value={displayName}
                    onChange={(e) =>
                        setDisplayName(e.target.value)
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
                    Register
                </button>
            </form>
            <p style={{color:"red"}}>
                {error}
            </p>
        </div>
    );
}