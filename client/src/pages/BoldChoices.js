import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import FileUpload from "../components/FileUpload";
import API_BASE from "../config/api";

// ────────────────────────────────────────────────────────────────────────────
// Styles (all inline so this page is self-contained)
// ────────────────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f0c29 0%, #1a1040 50%, #0d1b2a 100%)",
    color: "#f1f5f9",
    fontFamily: "'DM Sans', 'Inter', sans-serif",
  },
  hero: {
    textAlign: "center",
    padding: "72px 24px 48px",
    maxWidth: 760,
    margin: "0 auto",
  },
  badge: {
    display: "inline-block",
    background: "rgba(245, 166, 35, 0.15)",
    border: "1px solid rgba(245, 166, 35, 0.4)",
    color: "#F5A623",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.13em",
    textTransform: "uppercase",
    padding: "6px 14px",
    borderRadius: 999,
    marginBottom: 24,
  },
  h1: {
    fontSize: "clamp(2rem, 5vw, 3.2rem)",
    fontWeight: 900,
    lineHeight: 1.1,
    marginBottom: 16,
    background: "linear-gradient(135deg, #ffffff 0%, #FF4D4D 60%, #F5A623 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  subtitle: {
    fontSize: 17,
    color: "rgba(255,255,255,0.65)",
    lineHeight: 1.7,
    maxWidth: 600,
    margin: "0 auto 40px",
  },
  container: {
    maxWidth: 780,
    margin: "0 auto",
    padding: "0 24px 80px",
  },
  card: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: "32px 36px",
    marginBottom: 20,
    backdropFilter: "blur(12px)",
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#F5A623",
    marginBottom: 20,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    marginBottom: 16,
  },
  formRowFull: {
    marginBottom: 16,
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "rgba(255,255,255,0.6)",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 10,
    padding: "12px 14px",
    fontSize: 15,
    color: "#f1f5f9",
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 10,
    padding: "12px 14px",
    fontSize: 15,
    color: "#f1f5f9",
    outline: "none",
    resize: "vertical",
    minHeight: 160,
    fontFamily: "inherit",
    lineHeight: 1.6,
    boxSizing: "border-box",
  },
  btnPrimary: {
    background: "linear-gradient(135deg, #FF4D4D 0%, #F5A623 100%)",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "16px 40px",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    width: "100%",
    letterSpacing: "0.03em",
    transition: "opacity 0.2s, transform 0.15s",
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  previewToggle: {
    display: "flex",
    gap: 12,
    marginBottom: 24,
  },
  toggleBtn: {
    flex: 1,
    padding: "12px",
    borderRadius: 10,
    border: "1.5px solid",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    transition: "all 0.2s",
    textAlign: "center",
  },
  infoBox: {
    background: "rgba(0, 180, 166, 0.1)",
    border: "1px solid rgba(0, 180, 166, 0.3)",
    borderRadius: 12,
    padding: "14px 18px",
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
    marginBottom: 24,
    lineHeight: 1.6,
  },
  resultActions: {
    display: "flex",
    gap: 12,
    marginTop: 16,
    flexWrap: "wrap",
  },
  actionBtn: {
    padding: "10px 22px",
    borderRadius: 10,
    border: "1.5px solid",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    transition: "opacity 0.2s",
  },
};

// ────────────────────────────────────────────────────────────────────────────
const BoldChoices = () => {
  const { user } = useAuth();

  // Form state
  const [form, setForm] = useState({
    characterName: "",
    role: "",
    show: "",
    network: "",
    castingDirectors: "",
    castingOppositeOf: "",
    roleSize: "",
    characterDescription: "",
    storyline: "",
    sceneText: "",
  });

  // File upload state
  const [uploadData, setUploadData] = useState(null);

  // UI state
  const [isPreview, setIsPreview] = useState(true); // default to preview
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultHtml, setResultHtml] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);

  const handleField = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleFileUpload = (data) => {
    setUploadData(data);
    // Auto-populate sceneText if extracted
    if (data?.sceneText) {
      setForm((f) => ({ ...f, sceneText: data.sceneText }));
    }

    if (data.fallbackMode) {
      toast("We couldn't fully read your sides — but we'll build your guide using character and tone!", { 
        icon: "🧠",
        duration: 6000
      });
    } else {
      toast.success("Sides uploaded — scene text ready!");
    }
  };

  const openGuideInTab = (html) => {
    // Clean up old blob
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) toast("Popup blocked — use the Open button below.", { icon: "⚠️" });
  };

  const handleGenerate = async () => {
    if (!form.characterName.trim()) {
      toast.error("Character name is required.");
      return;
    }
    const sceneText = form.sceneText.trim() || uploadData?.sceneText?.trim() || "";
    if (!sceneText || sceneText.length < 20) {
      toast.error("Please enter or upload scene text (sides).");
      return;
    }

    const token = user?.accessToken || user?.token;
    if (!token) {
      toast.error("You must be logged in to generate a guide.");
      return;
    }

    setIsGenerating(true);
    setResultHtml(null);
    const toastId = toast.loading(
      `Generating your Bold Choices guide… this usually takes 30–90 seconds.`
    );

    try {
      const payload = {
        ...form,
        sceneText,
        preview: isPreview,
        format: "html",
        fallbackMode: uploadData?.fallbackMode || false,
      };

      const res = await fetch(`${API_BASE}/api/bold-choices/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || `Server error (${res.status})`);
      }

      setResultHtml(data.html);
      openGuideInTab(data.html);
      toast.success(
        isPreview
          ? "Preview guide ready! Upgrade to unlock all 5 choices."
          : "Full Bold Choices guide generated!",
        { id: toastId }
      );
    } catch (err) {
      console.error("[BoldChoices] Error:", err);
      toast.error(`Failed: ${err.message}`, { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  // ─── What's included in each mode ──────────────────────────────────────────
  const previewFeatures = ["Character POV Snapshot", "2 of 5 Bold Acting Choices", "1 Moment Play", "2 Character References (locked preview)"];
  const fullFeatures = ["Character POV Snapshot", "All 5 Bold Acting Choices", "2–3 Full Moment Plays (3 takes each)", "All Character References", "Complete Take 2 Strategy", "Personalized Coach Pep Talk"];

  return (
    <div style={S.page}>
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <Navbar />

      {/* ── HERO ── */}
      <div style={S.hero}>
        <div style={S.badge}>New — Bold Choices Strategy</div>
        <h1 style={S.h1}>
          Stop Playing It Safe.<br />Start Booking.
        </h1>
        <p style={S.subtitle}>
          Bold, specific, playable acting choices generated in seconds. 
          Not generic advice — exact adjustments for your character, your scenes, your audition.
        </p>
      </div>

      <div style={S.container}>

        {/* ── GUIDE TYPE TOGGLE ── */}
        <div style={S.card}>
          <div style={S.cardTitle}>
            <span>🎯</span> Choose Your Guide
          </div>

          <div style={S.previewToggle}>
            <button
              style={{
                ...S.toggleBtn,
                borderColor: isPreview ? "#F5A623" : "rgba(255,255,255,0.15)",
                background: isPreview ? "rgba(245,166,35,0.1)" : "transparent",
                color: isPreview ? "#F5A623" : "rgba(255,255,255,0.5)",
              }}
              onClick={() => setIsPreview(true)}
            >
              Preview (Free)
            </button>
            <button
              style={{
                ...S.toggleBtn,
                borderColor: !isPreview ? "#FF4D4D" : "rgba(255,255,255,0.15)",
                background: !isPreview ? "rgba(255,77,77,0.1)" : "transparent",
                color: !isPreview ? "#FF4D4D" : "rgba(255,255,255,0.5)",
              }}
              onClick={() => setIsPreview(false)}
            >
              Full Guide
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <div
              style={{
                background: isPreview
                  ? "rgba(245,166,35,0.08)"
                  : "rgba(255,255,255,0.03)",
                border: `1.5px solid ${isPreview ? "rgba(245,166,35,0.3)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 12,
                padding: "16px 18px",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#F5A623",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 10,
                }}
              >
                Preview includes:
              </div>
              {previewFeatures.map((f) => (
                <div
                  key={f}
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.65)",
                    marginBottom: 6,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 6,
                  }}
                >
                  <span style={{ color: "#F5A623", flexShrink: 0 }}>✓</span>
                  {f}
                </div>
              ))}
            </div>
            <div
              style={{
                background: !isPreview
                  ? "rgba(255,77,77,0.08)"
                  : "rgba(255,255,255,0.03)",
                border: `1.5px solid ${!isPreview ? "rgba(255,77,77,0.3)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 12,
                padding: "16px 18px",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#FF4D4D",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 10,
                }}
              >
                Full guide includes:
              </div>
              {fullFeatures.map((f) => (
                <div
                  key={f}
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.65)",
                    marginBottom: 6,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 6,
                  }}
                >
                  <span style={{ color: "#FF4D4D", flexShrink: 0 }}>✓</span>
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── SIDES UPLOAD ── */}
        <div style={S.card}>
          <div style={S.cardTitle}>
            <span>📄</span> Upload Sides (Optional)
          </div>
          <div style={S.infoBox}>
            Upload your sides PDF and scene text will be extracted automatically.
            Or paste the text directly in the Scene Text field below.
          </div>
          <FileUpload onUpload={handleFileUpload} />
          {uploadData && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 14px",
                background: "rgba(0,180,166,0.1)",
                border: "1px solid rgba(0,180,166,0.3)",
                borderRadius: 10,
                fontSize: 14,
                color: "#2dd4bf",
              }}
            >
              ✅ &nbsp;Sides extracted — {uploadData.wordCount || "?"} words ready
            </div>
          )}
        </div>

        {/* ── CHARACTER INFO ── */}
        <div style={S.card}>
          <div style={S.cardTitle}>
            <span>🎭</span> Character Information
          </div>

          <div style={{ ...S.formRow, gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <label style={S.label}>
                Character Name <span style={{ color: "#FF4D4D" }}>*</span>
              </label>
              <input
                style={S.input}
                name="characterName"
                value={form.characterName}
                onChange={handleField}
                placeholder="e.g. RILEY"
              />
            </div>
            <div>
              <label style={S.label}>Role / Breakdown Label</label>
              <input
                style={S.input}
                name="role"
                value={form.role}
                onChange={handleField}
                placeholder="e.g. RILEY — Heidi's daughter"
              />
            </div>
          </div>

          <div style={{ ...S.formRow, gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <label style={S.label}>Show / Production</label>
              <input
                style={S.input}
                name="show"
                value={form.show}
                onChange={handleField}
                placeholder="e.g. MAVIS (aka She's Fine)"
              />
            </div>
            <div>
              <label style={S.label}>Network / Studio</label>
              <input
                style={S.input}
                name="network"
                value={form.network}
                onChange={handleField}
                placeholder="e.g. 20th Television / Hulu"
              />
            </div>
          </div>

          <div style={{ ...S.formRow, gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <label style={S.label}>Casting Directors</label>
              <input
                style={S.input}
                name="castingDirectors"
                value={form.castingDirectors}
                onChange={handleField}
                placeholder="e.g. Mary Vernieu, Bret Howe"
              />
            </div>
            <div>
              <label style={S.label}>Cast Opposite</label>
              <input
                style={S.input}
                name="castingOppositeOf"
                value={form.castingOppositeOf}
                onChange={handleField}
                placeholder="e.g. Elizabeth Banks as Mom"
              />
            </div>
          </div>

          <div style={{ ...S.formRow, gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <label style={S.label}>Role Size</label>
              <input
                style={S.input}
                name="roleSize"
                value={form.roleSize}
                onChange={handleField}
                placeholder="e.g. Series Regular, Recurring, Guest Star"
              />
            </div>
            <div>
              {/* spacer */}
            </div>
          </div>

          <div style={S.formRowFull}>
            <label style={S.label}>Character Description</label>
            <textarea
              style={{ ...S.textarea, minHeight: 90 }}
              name="characterDescription"
              value={form.characterDescription}
              onChange={handleField}
              placeholder="e.g. Smart, earnest, positive-minded, encouraging, very together, observant and mature. Riley is a sweet, resilient kid who knows her mom is struggling..."
            />
          </div>

          <div style={S.formRowFull}>
            <label style={S.label}>Storyline</label>
            <textarea
              style={{ ...S.textarea, minHeight: 80 }}
              name="storyline"
              value={form.storyline}
              onChange={handleField}
              placeholder="e.g. While grappling with her recent divorce, Heidi is coping with raising three kids..."
            />
          </div>
        </div>

        {/* ── SCENE TEXT ── */}
        <div style={S.card}>
          <div style={S.cardTitle}>
            <span>📝</span> Scene Text / Sides{" "}
            <span style={{ color: "#FF4D4D" }}>*</span>
          </div>
          <textarea
            style={S.textarea}
            name="sceneText"
            value={form.sceneText}
            onChange={handleField}
            placeholder="Paste your sides or the character's lines here. The more specific the text, the more targeted the guide..."
          />
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.4)",
              marginTop: 8,
            }}
          >
            {form.sceneText.trim().split(/\s+/).filter(Boolean).length} words
          </div>
        </div>

        {/* ── GENERATE BUTTON ── */}
        <button
          style={{
            ...S.btnPrimary,
            ...(isGenerating ? S.btnDisabled : {}),
          }}
          disabled={isGenerating}
          onClick={handleGenerate}
        >
          {isGenerating
            ? "Generating… Hang tight"
            : isPreview
            ? "Generate Free Preview"
            : "Generate Full Bold Choices Guide"}
        </button>

        {/* ── RESULT ── */}
        {resultHtml && (
          <div
            style={{
              ...S.card,
              marginTop: 28,
              borderColor: "rgba(0,180,166,0.3)",
              background: "rgba(0,180,166,0.08)",
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#2dd4bf",
                marginBottom: 8,
              }}
            >
              ✅ Guide ready!
            </div>
            <p
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,0.65)",
                marginBottom: 12,
              }}
            >
              Your guide should have opened in a new tab. If it didn't, use the
              button below.
            </p>
            <div style={S.resultActions}>
              {blobUrl && (
                <a
                  href={blobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    ...S.actionBtn,
                    borderColor: "#2dd4bf",
                    color: "#2dd4bf",
                    background: "rgba(0,180,166,0.12)",
                    textDecoration: "none",
                  }}
                >
                  Open Guide in New Tab
                </a>
              )}
              {isPreview && (
                <button
                  style={{
                    ...S.actionBtn,
                    borderColor: "#FF4D4D",
                    color: "#FF4D4D",
                    background: "rgba(255,77,77,0.1)",
                  }}
                  onClick={() => {
                    setIsPreview(false);
                    setResultHtml(null);
                    window.scrollTo(0, 0);
                  }}
                >
                  Unlock Full Guide →
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default BoldChoices;
