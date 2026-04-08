import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";
import FileUpload from "../components/FileUpload";
import GuideForm from "../components/GuideForm";
import LoadingSpinner from "../components/LoadingSpinner";
import Footer from "../components/Footer";

import API_BASE from "../config/api";
import Navbar from "../components/Navbar";
import PromoCodeInput from "../components/PromoCodeInput";
import "../styles/shared.css";

// Simple progress bar
const ProgressBar = ({ value, max }) => {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  return (
    <div
      style={{
        width: "100%",
        height: 10,
        background: "#e5e7eb",
        borderRadius: 999,
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: "var(--gold)",
          borderRadius: 999,
        }}
      />
    </div>
  );
};

const nicePlan = (p) => {
  switch ((p || "").toLowerCase()) {
    case "free":
      return "Free";
    case "basic":
      return "Basic";
    case "premium":
      return "Premium";
    case "starter":
      return "Starter";
    case "alacarte":
      return "A la carte";
    case "unlimited":
      return "Unlimited";
    default:
      return "—";
  }
};

const Dashboard = () => {
  const [uploadData, setUploadData] = useState(() => {
    try {
      const saved = sessionStorage.getItem("prep101_upload_data");
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.warn("Could not restore cached upload data:", error);
      return null;
    }
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // usage state
  const [usage, setUsage] = useState(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState(null);
  const [lastGuideUrl, setLastGuideUrl] = useState(null);

  const { user } = useAuth();

  // ====== GUIDES LIBRARY ======
  const [guides, setGuides] = useState([]);
  const [guidesLoading, setGuidesLoading] = useState(false);
  const [guideFilter, setGuideFilter] = useState('all');

  // ====== USAGE FETCH ======
  useEffect(() => {
    let cancelled = false;

    const fetchUsage = async () => {
      setUsageLoading(true);
      setUsageError(null);

      try {
        const headers =
          user?.accessToken || user?.token
            ? { Authorization: `Bearer ${user.accessToken || user.token}` }
            : {};

        const res = await fetch(`${API_BASE}/api/auth/dashboard`, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        console.log("🔍 Dashboard API response:", json);
        if (!cancelled) {
          // Transform the complex backend response to the simple format expected by the UI
          const transformedUsage = {
            plan:
              json.user?.subscription || json.subscription?.currentPlan?.name,
            used: json.user?.guidesUsed || 0,
            limit: json.user?.guidesLimit || 1,
            renewsAt:
              json.subscription?.renewsAt ||
              new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
          };
          console.log("🔍 Transformed usage data:", transformedUsage);
          setUsage(transformedUsage);
        }
      } catch (err) {
        // Fallback mock so the UI still works in dev
        if (!cancelled) {
          setUsage({
            plan: user?.subscription || "free",
            used: user?.guidesUsed || 0,
            limit: user?.guidesLimit || 1,
            renewsAt: new Date(
              Date.now() + 1000 * 60 * 60 * 24 * 7
            ).toISOString(), // +7 days
          });
          setUsageError("Using fallback data until API is ready.");
        }
      } finally {
        if (!cancelled) setUsageLoading(false);
      }
    };

    fetchUsage();
    return () => { cancelled = true; };
  }, [user, refreshKey]);

  // Fetch guide library
  useEffect(() => {
    if (!user) return;
    setGuidesLoading(true);
    const token = user?.accessToken || user?.token;
    fetch(`${API_BASE}/api/guides`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(r => r.ok ? r.json() : { guides: [] })
      .then(data => setGuides(data.guides || []))
      .catch(() => {})
      .finally(() => setGuidesLoading(false));
  }, [user, refreshKey]);

  const remaining = useMemo(() => {
    if (!usage) return 0;
    if (usage.limit == null) return Infinity; // unlimited
    return Math.max(0, usage.limit - (usage.used || 0));
  }, [usage]);

  const canGenerate = useMemo(() => {
    if (!usage) return false;
    if (usage.limit == null) return true;
    return remaining > 0;
  }, [usage, remaining]);

  // ====== FILE UPLOAD ======
  const handleFileUpload = (data) => {
    setUploadData(data);
    try {
      sessionStorage.setItem("prep101_upload_data", JSON.stringify(data));
    } catch (error) {
      console.warn("Could not cache upload data for recovery:", error);
    }
    if (!data.uploadMessage) {
      toast.success("PDF processed — ready to generate!");
    }
  };

  // Open HTML in a new tab (Blob URL). Optionally reuse a pre-opened window.
  const openHtmlInNewTab = (htmlString, customTitle) => {
    const blob = new Blob([htmlString], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    setLastGuideUrl(url);
    // If customTitle is provided, it's a string for the window name
    if (typeof customTitle === "string") {
      const w = window.open(url, customTitle, "noopener,noreferrer");
      if (!w)
        toast('Popup blocked. Use the "Open last guide" link below.', {
          icon: "⚠️",
        });
    } else {
      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w)
        toast('Popup blocked. Use the "Open last guide" link below.', {
          icon: "⚠️",
        });
    }
  };

  // ====== GENERATE GUIDE ======
  const handleGenerateGuide = async (formData) => {
    if (!uploadData?.uploadId && !uploadData?.uploadIds) {
      toast.error("Please upload your sides (PDF) before generating.");
      return;
    }
    if (!canGenerate) {
      toast.error("You've hit your guide limit. Upgrade for more this month.");
      return;
    }

    setIsGenerating(true);
    setLastGuideUrl(null);

    // Add timeout to prevent infinite hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minute timeout

    try {
      const token = user?.accessToken || user?.token || localStorage.getItem('prep101_token');

      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const normalizedUploadIds = (
        uploadData.uploadIds || [uploadData.uploadId]
      ).filter(Boolean);
      const normalizedSceneText = uploadData.sceneText || uploadData.text || "";
      const normalizedFilename =
        uploadData.filename || uploadData.originalName || "uploaded-sides.pdf";
      const normalizedScenePayloads =
        uploadData.scenePayloads ||
        (normalizedUploadIds[0] && normalizedSceneText
          ? {
              [normalizedUploadIds[0]]: {
                filename: normalizedFilename,
                sceneText: normalizedSceneText,
                characterNames: uploadData.characterNames || [],
                extractionMethod: uploadData.extractionMethod || "upload",
                extractionConfidence:
                  uploadData.extractionConfidence || "unknown",
                wordCount: uploadData.wordCount || 0,
                fileType: uploadData.fileType || "sides",
                fallbackMode: Boolean(uploadData.fallbackMode),
                warnings: uploadData.warnings || [],
                source: uploadData.source || uploadData.extractionMethod || "text",
              },
            }
          : {});

      const payload = {
        uploadId: uploadData.uploadId || normalizedUploadIds[0],
        uploadIds: normalizedUploadIds,
        scenePayloads: normalizedScenePayloads,
        // Fallback data for stateless serverless environments
        sceneText: normalizedSceneText,
        filename: normalizedFilename,
        wordCount: uploadData.wordCount,
        characterNames: uploadData.characterNames,
        fallbackMode: uploadData.fallbackMode || false,
        warnings: uploadData.warnings || [],
        source: uploadData.source || uploadData.extractionMethod || "text",
        ...formData,
      };

      console.log("🚀 Starting guide generation for:", formData.characterName);
      toast.loading("Generating your guide... this may take about 3-6 minutes.");

      const res = await fetch(`${API_BASE}/api/guides/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const ct = res.headers.get("content-type") || "";
      let data;

      if (ct.includes("application/json")) {
        data = await res.json();
        console.log("🎭 Guide generation response:", data);

        // If we have guide content, show it even if auth failed (401)
        if (data?.guideContent) {
          // Show the guide regardless of success status
          openHtmlInNewTab(data.guideContent);

          // Warn user if guide wasn't saved
          if (data.savedToDatabase === false) {
            toast(
              "Guide created but not saved to your account. Please log in to save guides.",
              { icon: "⚠️" }
            );
          }

          if (data.childGuideMessage) {
            toast(data.childGuideMessage, { icon: "🌟" });
          } else if (data.childGuideQueued) {
            toast(
              "Child guide is being generated in the background and will appear on your dashboard shortly.",
              { icon: "🌟" }
            );
          }
        } else if (!res.ok) {
          // No guide content and request failed
          throw new Error(
            data?.error || `Failed to generate guide (HTTP ${res.status})`
          );
        } else {
          throw new Error("No guide content returned.");
        }
      } else {
        const html = await res.text();
        if (!html || html.length < 50) throw new Error("Empty guide response.");
        openHtmlInNewTab(html);
      }

      toast.success("Guide generated successfully! Opening now...");
      try {
        sessionStorage.setItem("prep101_upload_data", JSON.stringify(uploadData));
      } catch (error) {
        console.warn("Could not refresh cached upload data after guide generation:", error);
      }

      // Optimistic usage increment
      if (usage?.limit != null) {
        setUsage((u) => ({ ...u, used: (u?.used || 0) + 1 }));
      }
    } catch (err) {
      console.error("Guide generation error:", err);

      if (err.name === "AbortError") {
        toast.error(
          "Guide generation timed out after 5 minutes. Please try again."
        );
      } else {
        toast.error(`Failed to generate guide: ${err.message}`);
      }
    } finally {
      clearTimeout(timeoutId);
      setIsGenerating(false);
      toast.dismiss(); // Dismiss any loading toasts
    }
  };

  // ====== RENDER ======
  const renewText = usage?.renewsAt
    ? new Date(usage.renewsAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })
    : null;

  return (
    <>
      <Navbar />

      {/* Full-screen overlay while a guide is being generated */}
      {isGenerating && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.92)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 50,
          }}
        >
          <div
            style={{
              maxWidth: 560,
              padding: "2rem",
              textAlign: "center",
              color: "#e5e7eb",
            }}
          >
            <LoadingSpinner />
            <p
              style={{
                marginTop: "1.5rem",
                fontSize: "1rem",
                color: "#e5e7eb",
              }}
            >
              Crafting your Prep101 audition guide. This usually takes about
              3–6 minutes.
            </p>
            <p
              style={{
                marginTop: "0.5rem",
                fontSize: "0.875rem",
                color: "#9ca3af",
              }}
            >
              You can keep this tab open and review your guide as soon as it’s
              ready. Please don&apos;t close the page while we work.
            </p>
          </div>
        </div>
      )}

      <div className="page-dark">
        <div className="container-wide">
          {/* Header */}
          <div className="page-hero">
            <img
              src="/preplogo.png"
              alt="Prep101 logo"
              className="logo-hero"
              loading="lazy"
            />
            <h1 className="h1-hero">Dashboard</h1>
            <p className="h2-hero">
              Upload sides, fill role details, and generate your Prep101 guide.
            </p>
          </div>

          {/* Usage strip */}
          <div className="card-white">
            {usageLoading ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <LoadingSpinner />
                <span style={{ color: "#6b7280" }}>Loading plan…</span>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginBottom: 6,
                  }}
                >
                  <div style={{ fontWeight: 800, color: "#0f172a" }}>
                    Plan: {nicePlan(usage?.plan || user?.subscription)}
                    {usageError && (
                      <span style={{ color: "#f59e0b", marginLeft: 8 }}>
                        (demo)
                      </span>
                    )}
                  </div>
                  <div style={{ color: "#475569", fontWeight: 700 }}>
                    {usage?.limit == null
                      ? "Unlimited"
                      : `${usage.used || 0} / ${usage.limit} used`}
                  </div>
                </div>
                {usage?.limit != null && (
                  <>
                    <ProgressBar value={usage.used || 0} max={usage.limit} />
                    <div
                      style={{ color: "#64748b", marginTop: 6, fontSize: 13 }}
                    >
                      {remaining} remaining •{" "}
                      {renewText ? `renews ${renewText}` : "monthly"}
                    </div>
                  </>
                )}
                {!canGenerate && (
                  <div
                    style={{
                      marginTop: 10,
                      background: "#fffbeb",
                      border: "1px solid #f59e0b",
                      borderRadius: 10,
                      color: "#92400e",
                      padding: "8px 10px",
                    }}
                  >
                    You've hit your monthly limit. Upgrade on the Pricing page
                    for more guides.
                    <button
                      onClick={() => (window.location.href = "/pricing")}
                      className="btn btnPrimary"
                      style={{
                        marginLeft: 10,
                        padding: "6px 10px",
                        fontSize: "0.875rem",
                      }}
                    >
                      See Plans
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Promo Code Input */}
          <div style={{ marginBottom: '1.5rem' }}>
            <PromoCodeInput onRedeemSuccess={() => setRefreshKey((k) => k + 1)} />
          </div>

          {/* Body */}
          <div className="card-white">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1.1rem",
              }}
            >
              <FileUpload onUpload={handleFileUpload} />

              {uploadData && (
                <div
                  style={{
                    padding: 16,
                    background: "#f0fdfa",
                    borderRadius: 12,
                    border: "1px solid #2dd4bf",
                    color: "#065f46",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <span>✅</span>
                    <strong>PDF uploaded successfully!</strong>
                  </div>
                  <div style={{ fontSize: "0.875rem" }}>
                    {uploadData.uploadIds
                      ? `${uploadData.uploadIds.length} file(s) ready for guide generation`
                      : "File ready for guide generation"}
                  </div>
                </div>
              )}

              {uploadData && (
                <div>
                  <h3
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: "bold",
                      color: "#374151",
                      marginBottom: "1rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    🎭 Guide Details
                  </h3>
                  <p style={{ color: "#6b7280", marginBottom: "1.5rem" }}>
                    Fill in the details below to generate your personalized
                    audition guide.
                  </p>

                  <GuideForm
                    onSubmit={handleGenerateGuide}
                    hasFile={!!uploadData}
                    isSubmitting={isGenerating}
                    disabled={!canGenerate}
                  />
                </div>
              )}

              {!uploadData && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "2rem",
                    color: "#6b7280",
                  }}
                >
                  <p>Upload your audition sides (PDF) to get started.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── GUIDE LIBRARY ─────────────────────────────────────── */}
        <div className="card-white" style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>📂 Your Guides</h3>
            <div style={{ display: 'flex', gap: 6 }}>
              {['all', 'prep101', 'reader101', 'bold_choices'].map(f => (
                <button
                  key={f}
                  onClick={() => setGuideFilter(f)}
                  style={{
                    padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                    border: '1.5px solid',
                    cursor: 'pointer',
                    background: guideFilter === f ? '#0f172a' : 'transparent',
                    color: guideFilter === f ? '#fff' : '#64748b',
                    borderColor: guideFilter === f ? '#0f172a' : '#e2e8f0',
                  }}
                >
                  {f === 'all' ? 'All' : f === 'prep101' ? 'Prep101' : f === 'reader101' ? 'Reader101' : 'Bold Choices'}
                </button>
              ))}
            </div>
          </div>

          {guidesLoading ? (
            <p style={{ color: '#94a3b8', fontSize: 13 }}>Loading…</p>
          ) : guides.filter(g => guideFilter === 'all' || g.guideType === guideFilter).length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '2rem 0' }}>
              No guides yet. Generate one above!
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {guides
                .filter(g => guideFilter === 'all' || g.guideType === guideFilter)
                .map(g => {
                  const typeColors = { prep101: '#f59e0b', reader101: '#14b8a6', bold_choices: '#FF4D4D' };
                  const typeLabels = { prep101: 'Prep101', reader101: 'Reader101', bold_choices: 'Bold Choices' };
                  const color = typeColors[g.guideType] || '#94a3b8';
                  const token = user?.accessToken || user?.token;
                  return (
                    <div key={g.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 10,
                      border: '1px solid #e2e8f0', background: '#f8fafc',
                      gap: 12, flexWrap: 'wrap',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {g.characterName} — {g.productionTitle}
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                          {new Date(g.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999,
                        background: color + '18', color, border: `1px solid ${color}44`,
                        whiteSpace: 'nowrap',
                      }}>
                        {typeLabels[g.guideType] || g.guideType}
                      </span>
                      <a
                        href={`${API_BASE}${g.pdfUrl}${token ? `?token=${encodeURIComponent(token)}` : ''}`}
                        download
                        style={{
                          fontSize: 12, fontWeight: 700, color: '#0f172a',
                          background: 'var(--gold, #f59e0b)', borderRadius: 8,
                          padding: '5px 12px', textDecoration: 'none', whiteSpace: 'nowrap',
                        }}
                      >
                        ⬇ Download
                      </a>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
        {/* ── END GUIDE LIBRARY ─────────────────────────────────── */}

        {/* Footer */}
        <Footer />
      </div>
    </>
  );
};

export default Dashboard;
