import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

function MsLogo() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "10px 10px", gap: "2px" }}>
      <div style={{ width: 10, height: 10, background: "#f25022" }} />
      <div style={{ width: 10, height: 10, background: "#7fba00" }} />
      <div style={{ width: 10, height: 10, background: "#00a4ef" }} />
      <div style={{ width: 10, height: 10, background: "#ffb900" }} />
    </div>
  );
}

function Spinner() {
  return <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />;
}

const inputCls =
  "bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [mode, setMode]                   = useState("login");
  const [email, setEmail]                 = useState("");
  const [password, setPassword]           = useState("");
  const [displayName, setDisplayName]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError]                 = useState("");
  const [isLoading, setIsLoading]         = useState(false);

  function switchMode(m) {
    setMode(m);
    setError("");
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || "Login failed"); return; }
      login(data.access_token, data.user);
      navigate("/");
    } catch {
      setError("Network error — is the backend running?");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    setIsLoading(true);
    try {
      const res = await fetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, display_name: displayName }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || "Registration failed"); return; }
      // Auto-login after register
      const loginRes = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const loginData = await loginRes.json();
      login(loginData.access_token, loginData.user);
      navigate("/");
    } catch {
      setError("Network error — is the backend running?");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMicrosoft() {
    try {
      const res  = await fetch("/auth/microsoft");
      const data = await res.json();
      window.location.href = data.auth_url;
    } catch {
      setError("Failed to initiate Microsoft login");
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      {/* Title */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <span className="text-4xl">🐕</span>
          <h1 className="text-3xl font-bold text-white">WatchDog</h1>
        </div>
        <p className="text-gray-400 text-sm">Workstation Safety Monitor</p>
      </div>

      <div className="w-full max-w-3xl bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex flex-col md:flex-row">

          {/* ── Left: email/password ── */}
          <div className="flex-1 p-8">
            <h2 className="text-lg font-bold text-white mb-6">
              {mode === "login" ? "Sign in" : "Create account"}
            </h2>

            {mode === "login" ? (
              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <input type="email"    placeholder="Email"    value={email}    onChange={e => setEmail(e.target.value)}    required className={inputCls} />
                <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className={inputCls} />
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <button type="submit" disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
                  {isLoading && <Spinner />} Sign in
                </button>
                <p className="text-xs text-gray-400 text-center">
                  Don't have an account?{" "}
                  <button type="button" onClick={() => switchMode("register")} className="text-blue-400 hover:text-blue-300">Register</button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="flex flex-col gap-4">
                <input type="text"     placeholder="Display name"     value={displayName}     onChange={e => setDisplayName(e.target.value)}     required className={inputCls} />
                <input type="email"    placeholder="Email"            value={email}           onChange={e => setEmail(e.target.value)}           required className={inputCls} />
                <input type="password" placeholder="Password"         value={password}        onChange={e => setPassword(e.target.value)}        required className={inputCls} />
                <input type="password" placeholder="Confirm password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className={inputCls} />
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <button type="submit" disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
                  {isLoading && <Spinner />} Create account
                </button>
                <p className="text-xs text-gray-400 text-center">
                  Already have an account?{" "}
                  <button type="button" onClick={() => switchMode("login")} className="text-blue-400 hover:text-blue-300">Sign in</button>
                </p>
              </form>
            )}
          </div>

          {/* ── Divider ── */}
          <div className="hidden md:flex flex-col items-center py-8 px-2">
            <div className="flex-1 w-px bg-gray-800" />
            <span className="text-gray-500 text-xs py-2">or</span>
            <div className="flex-1 w-px bg-gray-800" />
          </div>
          <div className="flex md:hidden items-center gap-3 px-8 py-0">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-gray-500 text-xs">or</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          {/* ── Right: Microsoft ── */}
          <div className="flex-1 p-8 flex flex-col items-center justify-center gap-4">
            <button onClick={handleMicrosoft}
              className="w-full flex items-center justify-center gap-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-medium py-3 rounded-lg text-sm transition-colors">
              <MsLogo />
              Continue with Microsoft
            </button>
            <p className="text-xs text-gray-500 text-center">Sign in with your organization account</p>
          </div>
        </div>
      </div>
    </div>
  );
}
