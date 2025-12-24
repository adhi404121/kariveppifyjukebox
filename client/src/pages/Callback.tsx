import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { exchangeCodeForToken } from "@/lib/spotify";

export default function Callback() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState("Authenticating...");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const errorParam = urlParams.get("error");

    if (errorParam) {
      console.error("Spotify auth error:", errorParam);
      setError(`Spotify error: ${errorParam}`);
      setTimeout(() => setLocation("/"), 3000);
      return;
    }

    if (code) {
      setStatus("Connecting to Spotify...");
      console.log("Got auth code, exchanging for tokens...");
      
      exchangeCodeForToken(code)
        .then((result) => {
          if (result) {
            console.log("Auth successful, tokens stored!");
            setStatus("Connected successfully!");
            setSuccess(true);
            // Wait a bit longer to ensure server has saved tokens
            setTimeout(() => setLocation("/"), 2500);
          } else {
            console.error("Token exchange failed - no access token returned");
            setError("Connection failed. Please try again.");
            setTimeout(() => setLocation("/"), 3000);
          }
        })
        .catch((err) => {
          console.error("Auth failed:", err);
          setError(err.message || "Authentication failed. Please try again.");
          setTimeout(() => setLocation("/"), 3000);
        });
    } else {
      console.log("No code in callback URL");
      setLocation("/");
    }
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="flex flex-col items-center gap-4">
        {success ? (
          <>
            <div className="w-12 h-12 rounded-full bg-[#1DB954] flex items-center justify-center">
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-[#1DB954] font-semibold text-lg">{status}</p>
            <p className="text-white/30 text-sm">Redirecting to jukebox...</p>
          </>
        ) : error ? (
          <>
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-red-400 text-center max-w-xs">{error}</p>
            <p className="text-white/30 text-sm">Redirecting...</p>
          </>
        ) : (
          <>
            <div className="w-8 h-8 border-2 border-white/20 border-t-[#1DB954] rounded-full animate-spin" />
            <p className="text-white/50 animate-pulse">{status}</p>
          </>
        )}
      </div>
    </div>
  );
}
