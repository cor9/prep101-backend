import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import API_BASE from "../config/api";
import { withApiCredentials } from "../utils/apiAuth";
import { LINECUE_FEATURE } from "../config/betaFeatures";

// LineCue (private beta): upload sides, pick your role, and an AI scene
// partner reads every other line aloud, pausing on yours.

// Vercel rejects request bodies over ~4.5MB before they reach the API.
const MAX_PDF_BYTES = 4 * 1024 * 1024;
// Lines of audio to fetch ahead of the current one, so playback doesn't stall.
const PREFETCH_AHEAD = 2;
// A zero-length WAV used to unlock audio playback on the Start tap (iOS/Safari
// only allow later programmatic play() on an element first played in a gesture).
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

const S = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f0c29 0%, #1a1040 50%, #0d1b2a 100%)",
    color: "#f1f5f9",
    fontFamily: "'DM Sans', 'Inter', sans-serif",
  },
  // Top padding clears the fixed navbar (68px desktop, 84px on phones).
  hero: { textAlign: "center", padding: "120px 20px 32px", maxWidth: 760, margin: "0 auto" },
  badge: {
    display: "inline-block",
    background: "rgba(20, 184, 166, 0.15)",
    border: "1px solid rgba(20, 184, 166, 0.4)",
    color: "#2dd4bf",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.13em",
    textTransform: "uppercase",
    padding: "6px 14px",
    borderRadius: 999,
    marginBottom: 20,
  },
  h1: {
    fontSize: "clamp(2rem, 5vw, 3rem)",
    fontWeight: 900,
    lineHeight: 1.1,
    margin: "0 0 14px",
    background: "linear-gradient(135deg, #ffffff 0%, #2dd4bf 60%, #F5A623 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  subtitle: { fontSize: 17, color: "rgba(255,255,255,0.65)", lineHeight: 1.7, margin: 0 },
  container: { maxWidth: 780, margin: "0 auto", padding: "0 20px 80px", textAlign: "left" },
  card: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
  },
  cardTitle: { fontSize: 18, fontWeight: 800, margin: "0 0 6px" },
  muted: { color: "rgba(255,255,255,0.6)", fontSize: 14, lineHeight: 1.6, margin: 0 },
  drop: {
    display: "block",
    marginTop: 16,
    padding: "28px 16px",
    textAlign: "center",
    border: "2px dashed rgba(255,255,255,0.2)",
    borderRadius: 12,
    cursor: "pointer",
    color: "rgba(255,255,255,0.75)",
  },
  btnPrimary: {
    background: "linear-gradient(135deg, #14b8a6 0%, #F5A623 100%)",
    color: "#0f0c29",
    border: "none",
    borderRadius: 12,
    padding: "14px 22px",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
  },
  btnGhost: {
    background: "rgba(255,255,255,0.07)",
    color: "#f1f5f9",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 12,
    padding: "12px 18px",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
  disabled: { opacity: 0.5, cursor: "not-allowed" },
  roleGrid: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 },
  role: (selected) => ({
    padding: "12px 16px",
    borderRadius: 12,
    border: `1.5px solid ${selected ? "#2dd4bf" : "rgba(255,255,255,0.18)"}`,
    background: selected ? "rgba(45, 212, 191, 0.15)" : "rgba(255,255,255,0.04)",
    color: "#f1f5f9",
    fontWeight: 700,
    cursor: "pointer",
    textAlign: "left",
  }),
  controls: (navHeight) => ({
    position: "sticky",
    top: navHeight,
    zIndex: 5,
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
    padding: "14px 0",
    background: "rgba(15, 12, 41, 0.92)",
    backdropFilter: "blur(6px)",
  }),
  status: { fontSize: 14, color: "rgba(255,255,255,0.7)", marginLeft: "auto" },
  line: (state, mine) => ({
    padding: "14px 16px",
    borderRadius: 12,
    marginBottom: 10,
    border: `1px solid ${
      state === "current" ? (mine ? "#F5A623" : "#2dd4bf") : "rgba(255,255,255,0.08)"
    }`,
    background:
      state === "current"
        ? mine
          ? "rgba(245, 166, 35, 0.12)"
          : "rgba(45, 212, 191, 0.12)"
        : "rgba(255,255,255,0.03)",
    opacity: state === "done" ? 0.55 : 1,
    transition: "all 0.2s",
  }),
  speaker: (mine) => ({
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.08em",
    color: mine ? "#F5A623" : "#2dd4bf",
    marginBottom: 4,
  }),
  lineText: { fontSize: 17, lineHeight: 1.55, margin: 0 },
  hidden: { fontSize: 15, fontStyle: "italic", color: "rgba(255,255,255,0.5)", cursor: "pointer" },
  toggle: { display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 15, cursor: "pointer" },
};

function hasLineCueAccess(user) {
  return Array.isArray(user?.betaFeatures) && user.betaFeatures.includes(LINECUE_FEATURE);
}

export default function LineCue() {
  const { user } = useAuth();
  const [phase, setPhase] = useState("upload"); // upload | processing | role | rehearse
  const [file, setFile] = useState(null);
  const [lines, setLines] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [myCharacter, setMyCharacter] = useState("");
  const [showMyLines, setShowMyLines] = useState(true);
  const [revealed, setRevealed] = useState(() => new Set());
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [navHeight, setNavHeight] = useState(68);

  const audioElRef = useRef(null);
  const audioCacheRef = useRef(new Map());
  const lineRefs = useRef({});

  const lineCounts = useMemo(() => {
    const counts = {};
    lines.forEach((line) => {
      counts[line.character] = (counts[line.character] || 0) + 1;
    });
    return counts;
  }, [lines]);

  const currentLine = lines[index];
  const isMyTurn = Boolean(currentLine && currentLine.character === myCharacter);
  const finished = phase === "rehearse" && index >= lines.length;

  const clearAudioCache = useCallback(() => {
    audioCacheRef.current.forEach((promise) =>
      promise.then((url) => URL.revokeObjectURL(url)).catch(() => {})
    );
    audioCacheRef.current = new Map();
  }, []);

  useEffect(() => () => clearAudioCache(), [clearAudioCache]);

  const fetchLineAudio = useCallback(
    (line) => {
      const cache = audioCacheRef.current;
      if (!cache.has(line.id)) {
        const promise = fetch(
          `${API_BASE}/api/rehearsal/line-audio`,
          withApiCredentials(
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: line.tts_text, emotion: line.emotion }),
            },
            user
          )
        ).then(async (response) => {
          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || `Could not load audio (${response.status})`);
          }
          return URL.createObjectURL(await response.blob());
        });
        // Let a failed line be retried on the next attempt.
        promise.catch(() => cache.delete(line.id));
        cache.set(line.id, promise);
      }
      return cache.get(line.id);
    },
    [user]
  );

  // Drive playback: partner lines play and auto-advance; your lines wait.
  useEffect(() => {
    if (phase !== "rehearse" || !playing) return undefined;
    if (index >= lines.length) {
      setPlaying(false);
      return undefined;
    }

    let fetched = 0;
    for (let i = index + 1; i < lines.length && fetched < PREFETCH_AHEAD; i += 1) {
      if (lines[i].character !== myCharacter) {
        fetchLineAudio(lines[i]).catch(() => {});
        fetched += 1;
      }
    }

    const line = lines[index];
    if (line.character === myCharacter) return undefined;

    let cancelled = false;
    const audio = audioElRef.current;
    setLoadingAudio(true);
    fetchLineAudio(line)
      .then((url) => {
        if (cancelled) return;
        setLoadingAudio(false);
        audio.onended = () => {
          if (!cancelled) setIndex((i) => i + 1);
        };
        // Same line as before (a pause, then Resume): keep its position.
        if (audio.src !== url) audio.src = url;
        return audio.play().catch(() => {
          if (cancelled) return;
          setPlaying(false);
          toast("Tap Resume to let the browser play audio.");
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadingAudio(false);
        setPlaying(false);
        toast.error(error.message);
      });

    return () => {
      cancelled = true;
      audio.onended = null;
      audio.pause();
    };
  }, [phase, playing, index, lines, myCharacter, fetchLineAudio]);

  // The navbar is position: fixed; pin the controls bar just below it.
  useEffect(() => {
    const measure = () => setNavHeight(document.querySelector(".nav")?.offsetHeight || 68);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Keep the current line in view.
  useEffect(() => {
    if (phase !== "rehearse") return;
    const el = lineRefs.current[index];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [index, phase]);

  const advanceMyLine = useCallback(() => {
    if (isMyTurn) setIndex((i) => i + 1);
  }, [isMyTurn]);

  // Space bar = "I said my line".
  useEffect(() => {
    if (phase !== "rehearse") return undefined;
    const onKey = (event) => {
      if (event.code !== "Space" || /INPUT|TEXTAREA|BUTTON/.test(event.target.tagName)) return;
      event.preventDefault();
      advanceMyLine();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, advanceMyLine]);

  const unlockAudio = () => {
    if (!audioElRef.current) audioElRef.current = new Audio();
    const audio = audioElRef.current;
    audio.src = SILENT_WAV;
    audio.play().catch(() => {});
  };

  const handleFile = (event) => {
    const picked = event.target.files?.[0];
    if (!picked) return;
    if (picked.type !== "application/pdf") {
      toast.error("Please choose a PDF.");
      return;
    }
    if (picked.size > MAX_PDF_BYTES) {
      toast.error("That PDF is over 4MB. Upload just the pages for your scene.");
      return;
    }
    setFile(picked);
  };

  const processScript = async () => {
    if (!file) return;
    setPhase("processing");
    const form = new FormData();
    form.append("file", file);
    try {
      const response = await fetch(
        `${API_BASE}/api/rehearsal/process-script`,
        withApiCredentials({ method: "POST", body: form }, user)
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || `Something went wrong (${response.status})`);
      }
      clearAudioCache();
      setLines(data.dialogue_lines);
      setCharacters(data.characters);
      setMyCharacter("");
      setRevealed(new Set());
      setPhase("role");
      (data.extraction?.warnings || []).forEach((warning) => toast(warning));
    } catch (error) {
      toast.error(error.message);
      setPhase("upload");
    }
  };

  const startRehearsal = () => {
    if (!myCharacter) return;
    unlockAudio();
    setIndex(0);
    setPhase("rehearse");
    setPlaying(true);
  };

  const togglePlay = () => {
    if (finished) {
      unlockAudio();
      setIndex(0);
      setPlaying(true);
      return;
    }
    // Resuming reuses the element unlocked on Start; re-unlocking would swap
    // out a half-played line and restart it.
    if (!playing && !audioElRef.current) unlockAudio();
    setPlaying((p) => !p);
  };

  const goBack = () => setIndex((i) => Math.max(0, i - 1));

  const statusText = finished
    ? "Scene complete!"
    : !playing
    ? "Paused"
    : isMyTurn
    ? "Your line — say it, then press Next (or Space)"
    : loadingAudio
    ? "Loading your scene partner…"
    : `${currentLine?.character || ""} is speaking…`;

  if (!hasLineCueAccess(user)) {
    return (
      <div style={S.page}>
        <Navbar />
        <div style={S.hero}>
          <div style={S.badge}>Private beta</div>
          <h1 style={S.h1}>LineCue</h1>
          <p style={S.subtitle}>This feature isn't turned on for your account yet.</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div style={S.page}>
      <Navbar />
      <div style={S.hero}>
        <div style={S.badge}>Private beta</div>
        <h1 style={S.h1}>LineCue</h1>
        <p style={S.subtitle}>
          Upload your sides, pick your role, and run the scene. Your scene partner reads every
          other line out loud and waits for you on yours.
        </p>
      </div>

      <div style={S.container}>
        {(phase === "upload" || phase === "processing") && (
          <div style={S.card}>
            <h2 style={S.cardTitle}>1. Upload your sides</h2>
            <p style={S.muted}>A PDF of just your scene works best (under 4MB).</p>
            <label style={S.drop}>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFile}
                disabled={phase === "processing"}
                style={{ display: "none" }}
              />
              {file ? `📄 ${file.name}` : "Tap to choose a PDF"}
            </label>
            <div style={{ marginTop: 16 }}>
              <button
                type="button"
                onClick={processScript}
                disabled={!file || phase === "processing"}
                style={{ ...S.btnPrimary, ...(!file || phase === "processing" ? S.disabled : {}) }}
              >
                {phase === "processing" ? "Reading your script… (about 30 seconds)" : "Read my script"}
              </button>
            </div>
          </div>
        )}

        {phase === "role" && (
          <div style={S.card}>
            <h2 style={S.cardTitle}>2. Which role are you playing?</h2>
            <p style={S.muted}>
              Found {lines.length} lines and {characters.length} characters.
            </p>
            <div style={S.roleGrid}>
              {characters.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setMyCharacter(name)}
                  style={S.role(myCharacter === name)}
                >
                  {name}
                  <div style={{ fontSize: 12, fontWeight: 500, opacity: 0.7 }}>
                    {lineCounts[name] || 0} lines
                  </div>
                </button>
              ))}
            </div>
            <label style={S.toggle}>
              <input
                type="checkbox"
                checked={!showMyLines}
                onChange={(event) => setShowMyLines(!event.target.checked)}
              />
              Memory mode: hide my lines (tap one to peek)
            </label>
            <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={startRehearsal}
                disabled={!myCharacter}
                style={{ ...S.btnPrimary, ...(!myCharacter ? S.disabled : {}) }}
              >
                Start rehearsal
              </button>
              <button type="button" onClick={() => setPhase("upload")} style={S.btnGhost}>
                Upload a different script
              </button>
            </div>
          </div>
        )}

        {phase === "rehearse" && (
          <>
            <div style={S.controls(navHeight)}>
              <button type="button" onClick={togglePlay} style={S.btnPrimary}>
                {finished ? "Run it again" : playing ? "Pause" : "Resume"}
              </button>
              <button
                type="button"
                onClick={advanceMyLine}
                disabled={!isMyTurn || !playing}
                style={{ ...S.btnGhost, ...(!isMyTurn || !playing ? S.disabled : {}) }}
              >
                Next ▶
              </button>
              <button type="button" onClick={goBack} style={S.btnGhost}>
                ◀ Back
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlaying(false);
                  setPhase("role");
                }}
                style={S.btnGhost}
              >
                Change role
              </button>
              <span style={S.status}>{statusText}</span>
            </div>

            {lines.map((line, i) => {
              const mine = line.character === myCharacter;
              const state = i === index ? "current" : i < index ? "done" : "upcoming";
              const hideText = mine && !showMyLines && !revealed.has(line.id);
              return (
                <div
                  key={line.id}
                  ref={(el) => {
                    lineRefs.current[i] = el;
                  }}
                  style={S.line(state, mine)}
                >
                  <div style={S.speaker(mine)}>
                    {line.character}
                    {mine ? " (YOU)" : ""}
                  </div>
                  {hideText ? (
                    <p
                      style={S.hidden}
                      onClick={() => setRevealed((prev) => new Set(prev).add(line.id))}
                    >
                      Your line — tap to peek
                    </p>
                  ) : (
                    <p style={S.lineText}>{line.display_text}</p>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}
