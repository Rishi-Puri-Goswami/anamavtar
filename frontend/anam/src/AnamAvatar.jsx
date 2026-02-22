import { useEffect, useState, useRef } from "react";
import { createClient, AnamEvent } from "@anam-ai/js-sdk";
import { 
  Play, 
  Square, 
  VideoOff, 
  PanelRight, 
  Disc,
  User,
  Bot
} from "lucide-react";

export default function AnamInterviewLayout() {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [status, setStatus] = useState("Ready to Begin Your Interview");
  const [messages, setMessages] = useState([]);
  const [currentUserTranscript, setCurrentUserTranscript] = useState("");
  const [currentAvatarTranscript, setCurrentAvatarTranscript] = useState("");
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const [error, setError] = useState(null);

  const clientRef = useRef(null);
  const userVideoRef = useRef(null);
  const avatarVideoRef = useRef(null); // Added ref for better DOM control
  const userStreamRef = useRef(null);
  const chatEndRef = useRef(null); // Added ref for auto-scrolling

  // Auto-scroll chat to bottom when messages update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentUserTranscript, currentAvatarTranscript]);

  // Clean up on unmount to prevent ghost audio/video
  useEffect(() => {
    return () => stopSession();
  }, []);

  async function getSessionToken() {
    const res = await fetch("http://localhost:5000/api/anam/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    if (!res.ok) throw new Error("Failed to fetch session token from backend.");
    const data = await res.json();
    return data.sessionToken;
  }

  const startUserCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true // Anam needs audio to hear the user
      });
      userStreamRef.current = stream;
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      throw new Error("Could not access camera/microphone. Please check permissions.");
    }
  };

  const stopUserCamera = () => {
    if (userStreamRef.current) {
      userStreamRef.current.getTracks().forEach(track => track.stop());
      userStreamRef.current = null;
    }
    if (userVideoRef.current) userVideoRef.current.srcObject = null;
  };

  async function startSession() {
    if (isConnecting || isActive) return;
    
    setIsConnecting(true);
    setError(null);
    setStatus("Accessing Camera...");

    try {
      await startUserCamera();
      
      setStatus("Initializing AI...");
      const token = await getSessionToken();
      
      const client = createClient(token);
      clientRef.current = client;

      // Event Listeners
      client.addListener(AnamEvent.MESSAGE_STREAM_EVENT_RECEIVED, (event) => {
        if (event.role === "user") {
          setCurrentUserTranscript(event.content);
          setIsUserSpeaking(!event.endOfSpeech);
          if (event.endOfSpeech) setCurrentUserTranscript("");
        } else if (event.role === "persona") {
          setCurrentAvatarTranscript(event.content);
          setIsAvatarSpeaking(!event.endOfSpeech);
          if (event.endOfSpeech) setCurrentAvatarTranscript("");
        }
      });

      client.addListener(AnamEvent.MESSAGE_HISTORY_UPDATED, (history) => {
        setMessages(history.map((msg) => ({
          id: msg.id,
          from: msg.role === "user" ? "user" : "avatar",
          text: msg.content,
        })));
      });

      // Instead of a blind setTimeout, trigger the greeting when connection is actually established
      client.addListener(AnamEvent.CONNECTION_ESTABLISHED, () => {
        setIsConnecting(false);
        setIsActive(true);
        setStatus("Interview in Progress");
        
        // Wait a brief moment after connection to ensure audio context is ready, then speak
        setTimeout(() => {
          clientRef.current?.talk("Hello! Welcome to your technical interview. I'm your AI interviewer today. Are you ready to begin?");
        }, 500); 
      });

      client.addListener(AnamEvent.ERROR, (err) => {
        console.error("Anam Client Error:", err);
        setError("Connection lost or AI error occurred.");
        stopSession();
      });

      // Pass the actual DOM element ID
      await client.streamToVideoElement("avatar-video");

    } catch (err) {
      setError(err.message);
      stopSession();
    }
  }

  function stopSession() {
    if (clientRef.current) {
      try { clientRef.current.stopStreaming(); } catch (e) { console.error(e); }
      clientRef.current = null;
    }
    stopUserCamera();
    setIsActive(false);
    setIsConnecting(false);
    setStatus("Ready to Begin Your Interview");
    setCurrentUserTranscript("");
    setCurrentAvatarTranscript("");
    setMessages([]);
  }

  return (
    <div style={styles.pageContainer}>
      <div style={styles.header}>
        <h2 style={styles.headerTitle}>{status}</h2>
        <p style={styles.headerSubtitle}>
          Please do not change browser tabs or reload the screen during the interview.
        </p>
      </div>

      <div style={styles.mainContent}>
        <div style={styles.leftSection}>
          <div style={styles.videosRow}>
            {/* USER VIDEO */}
            <div style={styles.videoCard}>
              {(isActive || isConnecting) ? (
                <div style={{ position: "relative", width: "100%", height: "100%" }}>
                  <video ref={userVideoRef} autoPlay playsInline muted style={styles.videoElement} />
                  {isActive && (
                    <div style={styles.recBadge}>
                      <Disc size={10} color="#ff4444" fill="#ff4444" className="blink" />
                      <span>REC</span>
                    </div>
                  )}
                  <div style={styles.nameTag}><User size={12} /> You</div>
                </div>
              ) : (
                <div style={styles.placeholderState}>
                   <VideoOff size={64} color="#9ca3af" strokeWidth={1.5} />
                </div>
              )}
            </div>

            {/* AVATAR VIDEO */}
            <div style={styles.videoCard}>
              <video 
                id="avatar-video" 
                ref={avatarVideoRef}
                autoPlay 
                playsInline 
                style={{ ...styles.videoElement, display: (isActive || isConnecting) ? "block" : "none" }} 
              />
              {!isActive && !isConnecting && (
                <div style={styles.placeholderState}>
                  <span style={styles.startWithText}>Startwith_</span>
                </div>
              )}
              {isConnecting && (
                <div style={styles.connectingOverlay}>
                  <div className="loader"></div>
                  <span style={styles.connectingText}>Connecting AI...</span>
                </div>
              )}
              {isActive && (
                <div style={styles.nameTag}><Bot size={12} /> AI Interviewer</div>
              )}
            </div>
          </div>

          <div style={styles.controlsContainer}>
            {!isActive && !isConnecting ? (
              <button onClick={startSession} style={styles.startButton}>
                <Play size={18} fill="white" style={{ marginRight: "8px" }} /> Start
              </button>
            ) : isConnecting ? (
              <button disabled style={{...styles.startButton, opacity: 0.7, cursor: "not-allowed"}}>
                <div style={styles.spinner}></div> Connecting...
              </button>
            ) : (
              <button onClick={stopSession} style={styles.stopButton}>
                <Square size={18} fill="white" style={{ marginRight: "8px" }} /> End
              </button>
            )}
          </div>
        </div>

        {/* CHAT PANEL */}
        <div style={styles.rightSection}>
          <div style={styles.sidebarHeader}>
            <span>Conversation</span>
            <PanelRight size={20} color="#374151" />
          </div>

          <div style={styles.chatFeed}>
            {messages.length === 0 && !isActive && (
              <div style={styles.emptyState}>Start the interview to begin chatting</div>
            )}

            {messages.map((msg, i) => (
              <div key={i} style={styles.chatBubble(msg.from)}>
                <strong>{msg.from === "user" ? "You" : "AI"}</strong>
                <div style={{ marginTop: "4px" }}>{msg.text}</div>
              </div>
            ))}

            {isUserSpeaking && currentUserTranscript && (
              <div style={{ ...styles.chatBubble("user"), opacity: 0.6 }}>
                <em>Listening... {currentUserTranscript}</em>
              </div>
            )}
            {isAvatarSpeaking && currentAvatarTranscript && (
              <div style={{ ...styles.chatBubble("avatar"), opacity: 0.6 }}>
                <em>Speaking... {currentAvatarTranscript}</em>
              </div>
            )}
            <div ref={chatEndRef} /> {/* Invisible div to anchor auto-scroll */}
          </div>
        </div>
      </div>

      {error && <div style={styles.errorToast}>{error}</div>}

      <style>{`
        .blink { animation: blinker 1.5s linear infinite; }
        @keyframes blinker { 50% { opacity: 0; } }
        .loader {
          width: 48px; height: 48px; border: 4px solid #10b981;
          border-bottom-color: transparent; border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// Keep your exact styles object here unchanged



// --- UPDATED STYLES FOR FULL SCREEN ---


const styles = {
  pageContainer: {
    height: "100vh", 
    width: "100vw",  
    backgroundColor: "#ffffff",
    display: "flex",
    flexDirection: "column",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    overflow: "hidden" 
  },
  header: {
    textAlign: "center",
    padding: "20px 0",
    flexShrink: 0 
  },
  headerTitle: {
    fontSize: "16px",
    color: "#9ca3af", 
    margin: "0 0 6px 0",
    fontWeight: "500"
  },
  headerSubtitle: {
    fontSize: "14px",
    color: "#374151",
    margin: 0,
    fontWeight: "500"
  },
 mainContent: {
    display: "flex",
    flexDirection: "row",
    padding: "0 20px 20px 20px",
    gap: "24px", 
    width: "100%",
    
    maxWidth: "1400px", 
    margin: "auto", // <-- CHANGED FROM "0 auto" TO "auto". Centers vertically & horizontally.
    
    height: "60vh",       
    maxHeight: "550px",   
    minHeight: "400px",   
    
    boxSizing: "border-box"
  },
  
  
  // --- LEFT SECTION (Videos) ---
  leftSection: {
    flex: 2, 
    display: "flex",
    flexDirection: "column",
    gap: "20px"
  },
  videosRow: {
    flex: 1, 
    display: "flex",
    gap: "20px",
    width: "100%",
    minHeight: 0 
  },
  videoCard: {
    flex: 1, 
    backgroundColor: "#d1d5db", 
    borderRadius: "16px",
    position: "relative",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%" 
  },
  placeholderState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%"
  },
  startWithText: {
    fontSize: "24px",
    fontWeight: "bold",
    color: "#000",
    letterSpacing: "-0.5px"
  },
  controlsContainer: {
    display: "flex",
    justifyContent: "center",
    paddingBottom: "10px",
    flexShrink: 0 
  },
  startButton: {
    backgroundColor: "#10b981", 
    color: "white",
    border: "none",
    padding: "14px 48px",
    borderRadius: "30px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    boxShadow: "0 4px 6px rgba(16, 185, 129, 0.2)",
    transition: "transform 0.1s"
  },
  stopButton: {
    backgroundColor: "#ef4444",
    color: "white",
    border: "none",
    padding: "14px 48px",
    borderRadius: "30px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    boxShadow: "0 4px 6px rgba(239, 68, 68, 0.2)"
  },
  
  // --- RIGHT SECTION (Sidebar) ---
  rightSection: {
    flex: 1, 
    minWidth: "350px", 
    backgroundColor: "#d1d5db", 
    borderRadius: "16px",
    display: "flex",
    flexDirection: "column",
    padding: "20px",
    height: "100%", 
    position: "relative"
  },
  sidebarHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
    fontWeight: "bold",
    fontSize: "16px",
    color: "#000"
  },
  chatFeed: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    paddingRight: "5px" 
  },
  emptyState: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    color: "#6b7280",
    fontSize: "14px",
    textAlign: "center",
    width: "100%"
  },
  
  // --- COMMON ELEMENTS ---
  videoElement: {
    width: "100%",
    height: "100%",
    objectFit: "contain", // Changed from "cover" to prevent face-cropping
    backgroundColor: "#000"
  },
  recBadge: {
    position: "absolute",
    top: "16px",
    left: "16px",
    backgroundColor: "rgba(0,0,0,0.6)",
    color: "#fff",
    padding: "6px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backdropFilter: "blur(4px)"
  },
  nameTag: {
    position: "absolute",
    bottom: "16px",
    left: "16px",
    backgroundColor: "rgba(0,0,0,0.6)",
    color: "white",
    padding: "6px 12px",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: "500",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backdropFilter: "blur(4px)"
  },
  chatBubble: (from) => ({
    alignSelf: from === "user" ? "flex-end" : "flex-start",
    backgroundColor: from === "user" ? "#ffffff" : "#f3f4f6",
    padding: "12px 16px",
    borderRadius: "12px",
    maxWidth: "90%",
    fontSize: "14px",
    color: "#1f2937",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
    lineHeight: "1.4"
  }),
  errorToast: {
    position: "fixed",
    top: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    backgroundColor: "#fee2e2",
    color: "#991b1b",
    padding: "10px 20px",
    borderRadius: "8px",
    zIndex: 100,
    fontWeight: "500",
    border: "1px solid #f87171"
  },
  connectingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    zIndex: 10
  },
  connectingText: {
    color: "#fff",
    fontSize: "14px",
    fontWeight: "500"
  },
  spinner: {
    width: "18px",
    height: "18px",
    border: "2px solid #fff",
    borderBottomColor: "transparent",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    marginRight: "8px"
  }
};