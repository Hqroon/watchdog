import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function AuthCallback() {
  const [error, setError] = useState(false);
  const { login }         = useAuth();
  const navigate          = useNavigate();

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) { setError(true); return; }

    fetch(`/auth/microsoft/callback?code=${encodeURIComponent(code)}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => { login(data.access_token, data.user); navigate("/"); })
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">Authentication failed. Please try again.</p>
        <a href="/login" className="text-blue-400 hover:text-blue-300 text-sm">Back to login</a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="flex items-center gap-3 text-gray-300">
        <span className="h-5 w-5 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
        Completing sign in…
      </div>
    </div>
  );
}
