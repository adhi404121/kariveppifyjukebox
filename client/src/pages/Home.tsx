import { useEffect, useState, useCallback } from "react";
import { 
  redirectToAuthCodeFlow, 
  searchTrack, 
  playSong, 
  checkAuthStatus,
  resumePlayback,
  pausePlayback,
  nextTrack,
  adjustVolume,
  checkActiveDevice,
  clearQueue,
  getQueue,
  deleteFromQueue,
  type QueueTrack
} from "@/lib/spotify";
import { ThreeBackground } from "@/components/ThreeBackground";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Search, Play, SkipForward, Pause, Volume2, 
  Volume1, Lock, Unlock, ShieldCheck,
  Trash2, Music, Plus, Check, ListMusic
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentlyQueued, setRecentlyQueued] = useState<Set<string>>(new Set());
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [activeDevice, setActiveDevice] = useState<boolean>(false);
  const [queueTracks, setQueueTracks] = useState<QueueTrack[]>([]);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<QueueTrack | null>(null);
  const [isQueueDialogOpen, setIsQueueDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [trackToDelete, setTrackToDelete] = useState<QueueTrack | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    const checkStatus = async () => {
      const authenticated = await checkAuthStatus();
      setIsAuthenticated(authenticated);
      if (authenticated) {
        const device = await checkActiveDevice();
        if (device) setActiveDevice(true);
      }
    };
    
    checkStatus();
    const initialDelay = setTimeout(checkStatus, 500);
    const interval = setInterval(checkStatus, 30000);
    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchQueue = async () => {
      try {
        const data = await getQueue();
        setCurrentlyPlaying(data.currently_playing);
        // Remove duplicate songs by URI
        const uniqueTracks = Array.from(
          new Map(data.queue.map(track => [track.uri, track])).values()
        );
        setQueueTracks(uniqueTracks);
      } catch (error) {
        console.error("Failed to fetch queue:", error);
      }
    };

    fetchQueue();
    const queueInterval = setInterval(fetchQueue, 5000);
    return () => clearInterval(queueInterval);
  }, [isAuthenticated]);

  const handleLogin = async () => {
    await redirectToAuthCodeFlow();
  };

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    if (!isAuthenticated) {
      return;
    }

    setIsSearching(true);
    try {
      const tracks = await searchTrack(searchQuery);
      // Remove duplicates by track ID
      const uniqueTracks = Array.from(
        new Map(tracks.map(track => [track.id, track])).values()
      );
      setResults(uniqueTracks);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSearching(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [query, performSearch]);

  const handleQueue = async (uri: string, name: string, trackId: string) => {
    // Check if song is already in queue or recently queued
    const isAlreadyQueued = recentlyQueued.has(trackId) || queueTracks.some(qTrack => qTrack.id === trackId);
    if (isAlreadyQueued) {
      toast({
        title: "Already in Queue",
        description: `"${name}" is already queued!`,
        variant: "default",
      });
      return;
    }

    try {
      // Add to recently queued immediately to prevent double-clicks
      setRecentlyQueued(prev => new Set(prev).add(trackId));
      
      await playSong(uri);
      toast({
        title: "Added to Queue",
        description: `"${name}" has been added to the jukebox.`,
      });
      
      setTimeout(() => {
        setRecentlyQueued(prev => {
          const next = new Set(prev);
          next.delete(trackId);
          return next;
        });
      }, 3000);
    } catch (error: any) {
      console.error(error);
      // Remove from recently queued if there was an error
      setRecentlyQueued(prev => {
        const next = new Set(prev);
        next.delete(trackId);
        return next;
      });
      toast({
        title: "Queue Failed",
        description: error.message || "Is Spotify open and playing on a device?",
        variant: "destructive",
      });
    }
  };

  const handleVolume = async (delta: number) => {
    try {
      const newVol = await adjustVolume(delta);
      if (newVol !== undefined) {
        toast({
          title: `Volume: ${newVol}%`,
          duration: 1000,
        });
      }
    } catch (e) {
      console.error("Volume Error", e);
    }
  };

  const handleClearQueue = async () => {
    try {
      await clearQueue();
      toast({ title: "Queue Cleared", description: "Removed all upcoming songs." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to clear queue.", variant: "destructive" });
    }
  };

  const handleAdminLogin = () => {
    if (adminPassword === "A") { 
      setIsAdmin(true);
      setIsPasswordModalOpen(false);
      toast({ title: "Admin Access Granted", description: "You now have playback controls." });
    } else {
      toast({ title: "Access Denied", description: "Incorrect password.", variant: "destructive" });
    }
  };

  const handleDeleteFromQueueClick = (track: QueueTrack) => {
    setTrackToDelete(track);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deletePassword !== "A" || !trackToDelete) {
      toast({ title: "Access Denied", description: "Incorrect password.", variant: "destructive" });
      return;
    }

    try {
      // Remove from UI immediately
      setQueueTracks(prev => prev.filter(track => track.uri !== trackToDelete.uri));
      
      // Then confirm with backend
      await deleteFromQueue(trackToDelete.uri);
      toast({ title: "Deleted", description: `"${trackToDelete.name}" removed from queue.` });
      setIsDeleteModalOpen(false);
      setDeletePassword("");
      setTrackToDelete(null);
    } catch (e: any) {
      // Refresh queue if deletion fails
      const data = await getQueue();
      setCurrentlyPlaying(data.currently_playing);
      setQueueTracks(data.queue);
      toast({ title: "Error", description: e.message || "Failed to delete from queue.", variant: "destructive" });
    }
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-white/50 animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full overflow-y-auto text-white font-sans selection:bg-green-500/30">
      <ThreeBackground />

      <div className="relative z-10 flex flex-col items-center justify-start min-h-screen p-4 pt-8 pb-32">
        
        <div className="absolute top-4 right-4 z-50">
          {!isAdmin ? (
            <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" className="bg-black/40 border-white/20 text-white hover:bg-white/10 hover:text-white transition-colors backdrop-blur-md">
                  <Lock className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-black/80 border-white/10 backdrop-blur-xl text-white">
                <DialogHeader>
                  <DialogTitle>Admin Access</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <Input 
                    type="password" 
                    placeholder="Enter Password" 
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  />
                  <Button onClick={handleAdminLogin} className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold">
                    Unlock Controls
                  </Button>
                  {!isAuthenticated && (
                    <div className="pt-4 border-t border-white/10">
                      <p className="text-white/50 text-sm mb-3 text-center">Are you the host?</p>
                      <Button 
                        onClick={handleLogin}
                        variant="outline"
                        className="w-full border-[#1DB954]/50 text-[#1DB954] hover:bg-[#1DB954]/10"
                      >
                        Connect Spotify
                      </Button>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          ) : (
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => setIsAdmin(false)}
              className="bg-black/40 border-[#1DB954]/50 text-[#1DB954] hover:bg-[#1DB954]/10 transition-colors backdrop-blur-md"
            >
              <Unlock className="w-4 h-4" />
            </Button>
          )}
        </div>

        <div className="mb-8 text-center animate-in fade-in slide-in-from-top-10 duration-1000">
          <span className="text-6xl mb-4 block animate-bounce">🌿</span>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-[#90EE90] via-white to-[#98FB98] drop-shadow-[0_0_15px_rgba(144,238,144,0.5)]">
            KARIVEPPILA
          </h1>
          <p className="mt-2 text-lg md:text-xl text-white/60 tracking-widest uppercase">
            Jukebox Controller
          </p>
          {isAuthenticated && (
            <div className="mt-2 flex items-center justify-center gap-2 text-xs text-[#1DB954]">
              <span className="w-2 h-2 rounded-full bg-[#1DB954] animate-pulse" />
              {activeDevice ? "KARIVEPPILA is Live" : "Spotify Connected"}
            </div>
          )}
        </div>

        <div className="w-full max-w-xl space-y-4 animate-in fade-in zoom-in-95 duration-500">
          
          {isAdmin && (
            <div className="p-4 rounded-2xl bg-transparent border border-white/10 backdrop-blur-sm animate-in slide-in-from-top-4">
              <div className="flex items-center justify-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-[#1DB954]" />
                <span className="text-xs text-white/50 uppercase tracking-wider">Admin Controls</span>
              </div>
              <div className="flex items-center justify-center gap-3">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => handleVolume(-10)} 
                  className="w-10 h-10 text-white/60 hover:text-white hover:bg-white/10 rounded-full"
                  title="Volume Down"
                >
                  <Volume1 className="w-5 h-5" />
                </Button>
                
                <Button 
                  size="icon" 
                  onClick={pausePlayback}
                  className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/10"
                  title="Pause"
                >
                  <Pause className="w-5 h-5" />
                </Button>

                <Button 
                  size="icon" 
                  onClick={resumePlayback}
                  className="w-14 h-14 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black shadow-lg hover:scale-105 transition-transform"
                  title="Play"
                >
                  <Play className="w-6 h-6 ml-0.5" />
                </Button>

                <Button 
                  size="icon" 
                  onClick={nextTrack}
                  className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/10"
                  title="Next Track"
                >
                  <SkipForward className="w-5 h-5" />
                </Button>

                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => handleVolume(10)} 
                  className="w-10 h-10 text-white/60 hover:text-white hover:bg-white/10 rounded-full"
                  title="Volume Up"
                >
                  <Volume2 className="w-5 h-5" />
                </Button>

                <div className="w-px h-8 bg-white/10 mx-1" />

                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="px-3 h-10 rounded-full text-red-400 hover:bg-red-500/20 border border-red-500/30 text-xs"
                      title="Clear Queue"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clear All Queue
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-black/80 border-white/10 backdrop-blur-xl text-white">
                    <DialogHeader>
                      <DialogTitle>Clear Queue?</DialogTitle>
                    </DialogHeader>
                    <p className="text-white/70">This will remove all upcoming songs from the queue. The current song will continue playing.</p>
                    <div className="flex gap-3 pt-4">
                      <DialogClose asChild>
                        <Button variant="outline" className="flex-1 border-white/10 hover:bg-white/5">Cancel</Button>
                      </DialogClose>
                      <Button 
                        onClick={handleClearQueue}
                        className="flex-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
                      >
                        Clear All
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          )}

          <div className="relative group z-20">
            <div className="absolute inset-0 bg-white/5 blur-xl rounded-full transition-all group-hover:bg-white/10" />
            <div className="relative flex items-center gap-3">
              <Input
                type="text"
                placeholder="Search for a song..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 h-14 pl-14 pr-6 rounded-full bg-white/5 border-white/10 text-lg text-white placeholder:text-white/30 focus:bg-white/10 focus:border-white/20 transition-all backdrop-blur-md shadow-inner"
              />
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              {isSearching && (
                <div className="absolute right-24 top-1/2 -translate-y-1/2">
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
              )}
              
              <Dialog open={isQueueDialogOpen} onOpenChange={setIsQueueDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon"
                    className="shrink-0 w-14 h-14 rounded-full bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all backdrop-blur-md relative"
                  >
                    <ListMusic className="w-5 h-5" />
                    {queueTracks.length > 0 && (
                      <span className="absolute -top-2 -right-2 bg-[#1DB954] text-black text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                        {queueTracks.length > 99 ? "99+" : queueTracks.length}
                      </span>
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-black/80 border-white/10 backdrop-blur-xl text-white max-h-[80vh] overflow-hidden flex flex-col">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <ListMusic className="w-5 h-5 text-[#1DB954]" />
                      Queue
                    </DialogTitle>
                  </DialogHeader>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1DB954 transparent' }}>
                    {currentlyPlaying && (
                      <div className="mb-4 pb-4 border-b border-white/10">
                        <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Now Playing</p>
                        <div className="flex items-center gap-3">
                          <img 
                            src={currentlyPlaying.album.images[2]?.url || currentlyPlaying.album.images[0]?.url} 
                            alt={currentlyPlaying.name}
                            className="w-12 h-12 rounded-md object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white font-medium truncate">{currentlyPlaying.name}</p>
                            <p className="text-xs text-white/50 truncate">
                              {currentlyPlaying.artists.map(a => a.name).join(", ")}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {queueTracks.length > 0 ? (
                      queueTracks.map((track, index) => (
                        <div 
                          key={track.uri}
                          className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
                        >
                          <div className="w-6 h-6 flex items-center justify-center text-xs text-white/40 font-medium shrink-0">
                            {index + 1}
                          </div>
                          <img 
                            src={track.album.images[2]?.url || track.album.images[0]?.url} 
                            alt={track.name}
                            className="w-10 h-10 rounded object-cover shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white font-medium truncate">{track.name}</p>
                            <p className="text-xs text-white/40 truncate">
                              {track.artists.map(a => a.name).join(", ")}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleDeleteFromQueueClick(track)}
                            className="shrink-0 bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 px-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-white/40 py-8">No songs in queue. Start adding songs!</p>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {results.length > 0 && (
            <Card className="bg-black/60 border-white/5 backdrop-blur-xl p-2 rounded-2xl overflow-hidden animate-in slide-in-from-top-2">
              <div className="max-h-[350px] overflow-y-auto space-y-1 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1DB954 transparent' }}>
                {results.map((track) => {
                  const isRecentlyQueued = recentlyQueued.has(track.id);
                  const isInQueue = queueTracks.some(qTrack => qTrack.id === track.id);
                  const isQueued = isRecentlyQueued || isInQueue;
                  return (
                    <div
                      key={track.id}
                      onClick={() => !isQueued && handleQueue(track.uri, track.name, track.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-all group ${
                        isQueued 
                          ? "bg-[#1DB954]/20 cursor-default" 
                          : "hover:bg-white/10 cursor-pointer"
                      }`}
                    >
                      <img 
                        src={track.album.images[2]?.url || track.album.images[0]?.url} 
                        alt={track.name} 
                        className="w-12 h-12 rounded-md object-cover shadow-lg group-hover:scale-105 transition-transform"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium truncate">{track.name}</h4>
                        <p className="text-white/50 text-sm truncate">
                          {track.artists.map((a: any) => a.name).join(", ")}
                        </p>
                      </div>
                      <Button 
                        size="sm" 
                        className={`shrink-0 transition-all font-semibold px-4 ${
                          isQueued 
                            ? "bg-[#1DB954] text-black" 
                            : "bg-[#1DB954] hover:bg-[#1ed760] text-black"
                        }`}
                        disabled={isQueued}
                      >
                        {isQueued ? <><Check className="w-4 h-4 mr-1" /> {isInQueue ? "In Queue" : "Added"}</> : "ADD"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {isAuthenticated && results.length === 0 && !isSearching && query.length === 0 && (
            <div className="text-center py-8">
              <p className="text-white/30 text-sm">Start typing to search for songs</p>
            </div>
          )}

          {isAuthenticated && results.length === 0 && !isSearching && query.length >= 1 && (
            <div className="text-center py-8">
              <p className="text-white/30 text-sm">No songs found. Try a different search.</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="bg-black/80 border-white/10 backdrop-blur-xl text-white">
          <DialogHeader>
            <DialogTitle>Delete from Queue</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-white/70">Enter admin password to delete "{trackToDelete?.name}"</p>
            <Input 
              type="password" 
              placeholder="Enter Password" 
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDeleteConfirm()}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
            <div className="flex gap-2">
              <Button onClick={() => { setIsDeleteModalOpen(false); setDeletePassword(""); }} className="flex-1 bg-white/10 hover:bg-white/20 text-white">Cancel</Button>
              <Button onClick={handleDeleteConfirm} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold">Delete</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="fixed bottom-6 left-0 right-0 text-center text-white/20 text-xs pointer-events-none flex justify-center items-center gap-2">
        <span>POWERED BY SPOTIFY</span>
        {isAdmin && <ShieldCheck className="w-3 h-3 text-[#1DB954]" />}
      </div>
    </div>
  );
}
