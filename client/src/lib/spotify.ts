const SCOPES = [
  "user-read-private",
  "user-read-email",
  "streaming",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-library-read",
  "user-library-modify",
];

function getRedirectUri() {
  const origin = window.location.origin;
  console.log("Using redirect URI:", `${origin}/callback`);
  return `${origin}/callback`;
}

async function getClientId(): Promise<string> {
  const res = await fetch("/api/spotify/client-id");
  if (!res.ok) {
    throw new Error("Failed to get Spotify Client ID from server");
  }
  const data = await res.json();
  return data.clientId;
}

export async function redirectToAuthCodeFlow() {
  const redirectUri = getRedirectUri();
  const clientId = await getClientId();
  
  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("response_type", "code");
  params.append("redirect_uri", redirectUri);
  params.append("scope", SCOPES.join(" "));
  params.append("show_dialog", "true");

  document.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<string | null> {
  const redirectUri = getRedirectUri();

  console.log("Sending code to server for token exchange...");

  try {
    const res = await fetch("/api/spotify/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        code, 
        redirectUri 
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: "Token exchange failed" }));
      throw new Error(errorData.error || "Token exchange failed");
    }

    const responseData = await res.json();
    console.log("Server authenticated with Spotify successfully!");
    
    return "server-authenticated";
  } catch (error: any) {
    console.error("Token exchange failed:", error.message);
    throw error;
  }
}

export async function checkAuthStatus(): Promise<boolean> {
  try {
    const res = await fetch("/api/spotify/status");
    if (res.ok) {
      const data = await res.json();
      return data.authenticated === true;
    }
  } catch (e) {
    console.error("Failed to check auth status:", e);
  }
  return false;
}

export async function searchTrack(query: string): Promise<any[]> {
  const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Search failed" }));
    throw new Error(error.error || "Search failed");
  }
  return await res.json();
}

export async function playSong(uri: string): Promise<void> {
  const res = await fetch("/api/spotify/queue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uri }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to add to queue" }));
    throw new Error(error.error?.message || error.error || "Failed to add to queue. Is Spotify open on host's device?");
  }
}

export async function resumePlayback(): Promise<void> {
  const res = await fetch("/api/spotify/play", { method: "POST" });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Play failed" }));
    throw new Error(error.error || "Play failed");
  }
}

export async function pausePlayback(): Promise<void> {
  const res = await fetch("/api/spotify/pause", { method: "POST" });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Pause failed" }));
    throw new Error(error.error || "Pause failed");
  }
}

export async function nextTrack(): Promise<void> {
  const res = await fetch("/api/spotify/next", { method: "POST" });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Skip failed" }));
    throw new Error(error.error || "Skip failed");
  }
}

export async function adjustVolume(delta: number): Promise<number | undefined> {
  const res = await fetch("/api/spotify/volume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ delta }),
  });
  if (res.ok) {
    const data = await res.json();
    return data.volume;
  }
  return undefined;
}

export async function clearQueue(): Promise<void> {
  const res = await fetch("/api/spotify/clear-queue", { method: "POST" });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to clear queue" }));
    throw new Error(error.error || "Failed to clear queue");
  }
}

export async function checkActiveDevice(): Promise<any> {
  try {
    const res = await fetch("/api/spotify/devices");
    if (res.ok) {
      const data = await res.json();
      return data.device;
    }
  } catch {
  }
  return null;
}

export interface QueueTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    images: { url: string }[];
  };
  uri: string;
}

export interface QueueData {
  currently_playing: QueueTrack | null;
  queue: QueueTrack[];
}

export async function getQueue(): Promise<QueueData> {
  const res = await fetch("/api/spotify/get-queue");
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to get queue" }));
    throw new Error(error.error || "Failed to get queue");
  }
  return await res.json();
}

export async function deleteFromQueue(trackUri: string): Promise<void> {
  const res = await fetch("/api/spotify/delete-from-queue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trackUri }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to delete from queue" }));
    throw new Error(error.error || "Failed to delete from queue");
  }
}
