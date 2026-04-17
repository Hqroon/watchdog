import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(null);
  const [token, setToken]       = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("watchdog_token");
    const storedUser  = localStorage.getItem("watchdog_user");
    if (storedToken && storedUser) {
      fetch("/auth/me", { headers: { Authorization: `Bearer ${storedToken}` } })
        .then((r) => {
          if (r.ok) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
          } else {
            localStorage.removeItem("watchdog_token");
            localStorage.removeItem("watchdog_user");
          }
        })
        .catch(() => {
          localStorage.removeItem("watchdog_token");
          localStorage.removeItem("watchdog_user");
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem("watchdog_token", newToken);
    localStorage.setItem("watchdog_user", JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("watchdog_token");
    localStorage.removeItem("watchdog_user");
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
