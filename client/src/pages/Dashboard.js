import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";
import FileUpload from "../components/FileUpload";
import GuideForm from "../components/GuideForm";
import LoadingSpinner from "../components/LoadingSpinner";
import Footer from "../components/Footer";

import API_BASE from "../config/api";
import Navbar from "../components/Navbar";
import {
  ACCOUNT_LABEL,
  buildBoldChoicesUrl,
  buildReader101Url,
} from "../utils/ecosystemLinks";
import { withApiCredentials } from "../utils/apiAuth";
import "../styles/shared.css";

const PREP101_STRIPE_LINKS = {
  singleGuide: "https://buy.stripe.com/6oU3cv8Cb2jlbYN0tQ2wU3Z",
  threePack: "https://buy.stripe.com/7sYaEX4lV9LN3sh90m2wV0d",
};

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

const SectionHeader = ({ eyebrow, title, description, align = "left" }) => (
  <div
    style={{
      textAlign: align,
      marginBottom: "1.25rem",
    }}
  >
    {eyebrow && (
      <div
        style={{
          fontSize: 12,
          fontWeight: 900,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#8b5e3c",
          marginBottom: 8,
        }}
      >
        {eyebrow}
      </div>
    )}
    <h2
      style={{
        color: "#0f172a",
        fontSize: "clamp(1.35rem, 2.2vw, 2rem)",
        lineHeight: 1.1,
        margin: 0,
      }}
    >
      {title}
    </h2>
    {description && (
      <p
        style={{
          color: "#475569",
          fontSize: "1rem",
          lineHeight: 1.7,
          margin: "0.65rem 0 0",
        }}
      >
        {description}
      </p>
    )}
  </div>
);

const StepHint = ({ number, title, description }) => (
  <div
    style={{
      display: "flex",
      gap: 12,
      alignItems: "flex-start",
      padding: "0.95rem",
      borderRadius: 16,
      background: "#f8fafc",
      border: "1px solid #e2e8f0",
    }}
  >
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: "#0f172a",
        color: "#fff",
        display: "grid",
        placeItems: "center",
        fontWeight: 900,
        flex: "0 0 auto",
        fontSize: 13,
      }}
    >
      {number}
    </div>
    <div>
      <div style={{ color: "#0f172a", fontWeight: 800, marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ color: "#64748b", lineHeight: 1.5, fontSize: 14 }}>
        {description}
      </div>
    </div>
  </div>
);

const nicePlan = (p) => {
  switch ((p || "").toLowerCase()) {
    case "free":
      return "Free";
    case "basic":
      return "Starter";
    case "premium":
      return "Premium";
    case "starter":
      return "Starter";
    case "alacarte":
      return "A la carte";
    case "unlimited":
      return "Unlimited";
    case "bundle":
      return "Bundle";
    case "reader101_monthly":
      return "Reader101 Monthly";
    case "boldchoices_monthly":
      return "Bold Choices Monthly";
    default:
      return "—";
  }
};

const DASHBOARD_CONTEXT = {
  all: {
    eyebrow: "Shared Account Hub",
    title: `Your ${ACCOUNT_LABEL}`,
    subtitle: "One account for Prep101, Reader101, and Bold Choices.",
  },
  prep101: {
    eyebrow: "Prep101 Workspace",
    title: `Prep101 inside ${ACCOUNT_LABEL}`,
    subtitle:
      "Upload sides, generate guides, and manage Prep101 credits from the same account.",
  },
  reader101: {
    eyebrow: "Reader101 Workspace",
    title: `Reader101 inside ${ACCOUNT_LABEL}`,
    subtitle:
      "Manage Reader101 access in your shared account hub, then jump back into Reader101 with the same actor context.",
  },
  bold_choices: {
    eyebrow: "Bold Choices Workspace",
    title: `Bold Choices inside ${ACCOUNT_LABEL}`,
    subtitle:
      "Jump into actor-first choice work with the same shared account and active actor.",
  },
};

const getProductContext = (key) =>
  DASHBOARD_CONTEXT[key] || DASHBOARD_CONTEXT.all;

const formatPrepAccess = (usage) => {
  if (!usage) return "Checking access...";
  if (usage.monthlyLimit == null) return "Unlimited Prep101";

  const pieces = [`${usage.monthlyRemaining ?? 0} monthly left`];
  if (Number(usage.topUpCredits || 0) > 0) {
    pieces.push(
      `${usage.topUpCredits} top-up ${
        usage.topUpCredits === 1 ? "credit" : "credits"
      }`
    );
  }
  return pieces.join(" • ");
};

const formatReaderAccess = (usage) => {
  if (!usage) return "Checking access...";
  if (usage.unlimited) return "Unlimited Reader101";
  if (usage.credits > 0) {
    return `${usage.credits} Reader101 ${
      usage.credits === 1 ? "credit" : "credits"
    }`;
  }
  return "No Reader101 credits yet";
};

const formatBoldAccess = (usage) => {
  if (!usage) return "Checking access...";
  if (usage.unlimited) return "Unlimited Bold Choices";
  if (usage.credits > 0) {
    return `${usage.credits} Bold Choices ${
      usage.credits === 1 ? "credit" : "credits"
    }`;
  }
  return "Free monthly access only";
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

  const { user } = useAuth();
  const token = user?.accessToken || user?.token;
  const activeActor = user?.account?.activeActor;
  const onboardingRequired = Boolean(user?.account?.onboardingRequired);
  const needsActorSelection = Boolean(user?.account?.needsActorSelection);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const product = params.get("product");
    if (product === "reader101" || product === "bold_choices" || product === "prep101") {
      setGuideFilter(product);
    }
  }, []);

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
        const res = await fetch(
          `${API_BASE}/api/auth/dashboard`,
          withApiCredentials({}, user)
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        console.log("🔍 Dashboard API response:", json);
        if (!cancelled) {
          const prep101Usage = json.user?.prep101Usage || {};
          const transformedUsage = {
            plan:
              prep101Usage.plan ||
              json.user?.subscription ||
              json.subscription?.currentPlan?.name,
            used: prep101Usage.monthlyUsed ?? json.user?.guidesUsed ?? 0,
            limit: prep101Usage.monthlyLimit ?? json.user?.guidesLimit ?? 1,
            remaining: prep101Usage.totalRemaining,
            monthlyRemaining: prep101Usage.monthlyRemaining,
            topUpCredits:
              prep101Usage.topUpCredits ?? json.user?.prep101TopUpCredits ?? 0,
            renewsAt:
              prep101Usage.renewsAt ||
              json.subscription?.renewsAt ||
              new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
            prep101: prep101Usage,
            reader101: json.user?.reader101Usage || {
              unlimited: false,
              credits: json.user?.reader101Credits || 0,
              canGenerate: (json.user?.reader101Credits || 0) > 0,
            },
            boldChoices: json.user?.boldChoicesUsage || {
              unlimited: false,
              credits: json.user?.boldChoicesCredits || 0,
              canGenerate: (json.user?.boldChoicesCredits || 0) > 0,
            },
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
            remaining: user?.prep101Usage?.totalRemaining,
            monthlyRemaining: user?.prep101Usage?.monthlyRemaining,
            topUpCredits:
              user?.prep101Usage?.topUpCredits ||
              user?.prep101TopUpCredits ||
              0,
            prep101: user?.prep101Usage,
            reader101: user?.reader101Usage || {
              unlimited: false,
              credits: user?.reader101Credits || 0,
              canGenerate: (user?.reader101Credits || 0) > 0,
            },
            boldChoices: user?.boldChoicesUsage || {
              unlimited: false,
              credits: user?.boldChoicesCredits || 0,
              canGenerate: (user?.boldChoicesCredits || 0) > 0,
            },
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
    fetch(`${API_BASE}/api/guides`, {
      ...withApiCredentials({}, user)
    })
      .then(r => r.ok ? r.json() : { guides: [] })
      .then(data => setGuides(data.guides || []))
      .catch(() => {})
      .finally(() => setGuidesLoading(false));
  }, [user, refreshKey]);

  const remaining = useMemo(() => {
    if (!usage) return 0;
    if (typeof usage.remaining === "number") return Math.max(0, usage.remaining);
    if (usage.limit == null) return Infinity; // unlimited
    return Math.max(0, usage.limit - (usage.used || 0));
  }, [usage]);

  const canGenerate = useMemo(() => {
    if (!usage) return false;
    if (usage.limit == null) return true;
    return remaining > 0;
  }, [usage, remaining]);
  const isPrep101StarterPlan = useMemo(() => {
    const plan = String(usage?.plan || user?.subscription || "").toLowerCase();
    return plan === "starter" || plan === "basic";
  }, [usage?.plan, user?.subscription]);
  const dashboardContext = useMemo(
    () =>
      getProductContext(
        ["prep101", "reader101", "bold_choices"].includes(guideFilter)
          ? guideFilter
          : "all"
      ),
    [guideFilter]
  );
  const scrollToPrep101Builder = () => {
    setGuideFilter("prep101");
    window.history.replaceState({}, "", "/dashboard?product=prep101");
    document
      .getElementById("prep101-builder")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
      toast.error(
        isPrep101StarterPlan
          ? "You've used your 5 Prep101 guides. Buy 1 more guide or a 3-pack to keep going."
          : "You've hit your guide limit. Visit pricing for more options."
      );
      return;
    }

    setIsGenerating(true);

    // Add timeout to prevent infinite hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minute timeout

    try {
      const headers = {
        "Content-Type": "application/json",
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
        ...withApiCredentials({ headers }, user),
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
      setRefreshKey((k) => k + 1);

      if (data?.prep101Usage) {
        setUsage((u) => ({
          ...u,
          plan: data.prep101Usage.plan || u?.plan,
          used: data.prep101Usage.monthlyUsed ?? u?.used ?? 0,
          limit: data.prep101Usage.monthlyLimit ?? u?.limit ?? null,
          remaining: data.prep101Usage.totalRemaining,
          monthlyRemaining: data.prep101Usage.monthlyRemaining,
          topUpCredits: data.prep101Usage.topUpCredits ?? u?.topUpCredits ?? 0,
          renewsAt: data.prep101Usage.renewsAt || u?.renewsAt,
          prep101: data.prep101Usage,
        }));
      } else if (usage?.limit != null) {
        setUsage((u) => ({
          ...u,
          used: (u?.used || 0) + 1,
          remaining:
            typeof u?.remaining === "number"
              ? Math.max(0, u.remaining - 1)
              : u?.remaining,
          prep101: u?.prep101
            ? {
                ...u.prep101,
                monthlyUsed: (u.prep101.monthlyUsed || 0) + 1,
                monthlyRemaining:
                  typeof u.prep101.monthlyRemaining === "number"
                    ? Math.max(0, u.prep101.monthlyRemaining - 1)
                    : u.prep101.monthlyRemaining,
                totalRemaining:
                  typeof u.prep101.totalRemaining === "number"
                    ? Math.max(0, u.prep101.totalRemaining - 1)
                    : u.prep101.totalRemaining,
              }
            : u?.prep101,
        }));
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
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#8b5e3c",
                marginBottom: 10,
              }}
            >
              {dashboardContext.eyebrow}
            </div>
            <h1 className="h1-hero">{dashboardContext.title}</h1>
            <p className="h2-hero">{dashboardContext.subtitle}</p>
            {activeActor && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 14,
                padding: '8px 14px',
                borderRadius: 999,
                background: 'rgba(15,23,42,0.08)',
                color: '#0f172a',
                fontWeight: 700,
              }}>
                Active Actor: {activeActor.actorName}
                {activeActor.ageRange ? ` (${activeActor.ageRange})` : ''}
              </div>
            )}
          </div>

          {onboardingRequired && (
            <div className="card-white" style={{ marginBottom: '1.5rem', border: '1px solid #f59e0b' }}>
              <div style={{ fontWeight: 800, color: '#92400e', marginBottom: 6 }}>
                Finish setting up your Child Actor 101 account
              </div>
              <div style={{ color: '#78350f', marginBottom: 12 }}>
                Choose whether you are here as an actor, a parent, or both, then set your active actor context.
              </div>
              <button
                className="btn btnPrimary"
                onClick={() => (window.location.href = '/onboarding')}
              >
                Continue Setup
              </button>
            </div>
          )}

          {!onboardingRequired && needsActorSelection && (
            <div className="card-white" style={{ marginBottom: '1.5rem', border: '1px solid #0f172a' }}>
              <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
                Choose the actor this work is for
              </div>
              <div style={{ color: '#475569', marginBottom: 12 }}>
                Your account has actor profiles, but none is selected as the active context yet.
              </div>
              <button
                className="btn btnPrimary"
                onClick={() => (window.location.href = '/select-actor')}
              >
                Choose Active Actor
              </button>
            </div>
          )}

          <div className="card-white">
            <SectionHeader
              eyebrow="Start Here"
              title="What would you like to work on?"
              description={`Use this shared account hub to choose a product, confirm ${activeActor?.actorName || "the active actor"}, and keep your guides in one place.`}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
                gap: "1rem",
              }}
            >
              {[
                {
                  label: "Prep101",
                  color: "#f59e0b",
                  description: "Upload sides here when you want a full audition guide.",
                  status: formatPrepAccess(usage?.prep101 || user?.prep101Usage || null),
                  action: scrollToPrep101Builder,
                  cta: "Build a Prep101 Guide",
                },
                {
                  label: "Reader101",
                  color: "#14b8a6",
                  description: "Jump back to Reader101 when you need reader notes and tape support.",
                  status: formatReaderAccess(usage?.reader101 || user?.reader101Usage || null),
                  action: () => {
                    window.location.href = buildReader101Url({ token, useBridge: Boolean(user) });
                  },
                  cta: "Return to Reader101",
                },
                {
                  label: "Bold Choices",
                  color: "#FF4D4D",
                  description: "Open actor-first choice work for sharper, more specific decisions.",
                  status: formatBoldAccess(usage?.boldChoices || user?.boldChoicesUsage || null),
                  action: () => {
                    window.location.href = buildBoldChoicesUrl({ token, useBridge: Boolean(user) });
                  },
                  cta: "Open Bold Choices",
                },
              ].map((workspace) => (
                <div
                  key={workspace.label}
                  style={{
                    border: `1px solid ${workspace.color}33`,
                    borderRadius: 18,
                    padding: "1.1rem",
                    background: `${workspace.color}10`,
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 220,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 900,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: workspace.color,
                      marginBottom: 8,
                    }}
                  >
                    {workspace.label}
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      color: "#334155",
                      lineHeight: 1.6,
                      marginBottom: 12,
                    }}
                  >
                    {workspace.description}
                  </div>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 800,
                      borderRadius: 999,
                      background: "#fff",
                      color: "#0f172a",
                      padding: "6px 10px",
                      margin: "auto 0 14px",
                      width: "fit-content",
                    }}
                  >
                    {workspace.status}
                  </div>
                  <button
                    onClick={workspace.action}
                    className="btn btnPrimary"
                    style={{
                      width: "100%",
                      background: workspace.color,
                      border: "none",
                      color: workspace.label === "Reader101" ? "#041311" : "#fff",
                    }}
                  >
                    {workspace.cta}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Usage strip */}
          <div className="card-white">
            <SectionHeader
              eyebrow="Your Access"
              title="What you can use right now"
              description="This is your current access across all three tools, including monthly access and any remaining credits."
            />
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
                {Number(usage?.topUpCredits || 0) > 0 && (
                  <div
                    style={{
                      color: "#0f766e",
                      fontWeight: 700,
                      marginBottom: 8,
                    }}
                  >
                    {usage.topUpCredits} Prep101 top-up credit
                    {usage.topUpCredits === 1 ? "" : "s"} remaining
                  </div>
                )}
                {usage?.limit != null && (
                  <>
                    <ProgressBar value={usage.used || 0} max={usage.limit} />
                    <div
                      style={{ color: "#64748b", marginTop: 6, fontSize: 13 }}
                    >
                      {remaining} total remaining •{" "}
                      {renewText ? `renews ${renewText}` : "monthly"}
                    </div>
                  </>
                )}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 10,
                    marginTop: 14,
                  }}
                >
                  {[
                    {
                      label: "Prep101",
                      tone: "#f59e0b",
                      value: formatPrepAccess(usage?.prep101 || null),
                    },
                    {
                      label: "Reader101",
                      tone: "#14b8a6",
                      value: formatReaderAccess(usage?.reader101 || null),
                    },
                    {
                      label: "Bold Choices",
                      tone: "#ef4444",
                      value: formatBoldAccess(usage?.boldChoices || null),
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      style={{
                        border: `1px solid ${item.tone}33`,
                        borderRadius: 12,
                        padding: "0.8rem 0.9rem",
                        background: `${item.tone}10`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: item.tone,
                          marginBottom: 6,
                        }}
                      >
                        {item.label}
                      </div>
                      <div
                        style={{
                          color: "#1e293b",
                          fontWeight: 700,
                          lineHeight: 1.5,
                        }}
                      >
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
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
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>
                      {isPrep101StarterPlan
                        ? "You've used your 5 Prep101 Starter guides."
                        : "You've hit your monthly limit."}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {isPrep101StarterPlan ? (
                        <>
                          <button
                            onClick={() => (window.location.href = PREP101_STRIPE_LINKS.singleGuide)}
                            className="btn"
                            style={{
                              padding: "6px 10px",
                              fontSize: "0.875rem",
                              background: "#0f172a",
                              color: "#fff",
                              border: "none",
                            }}
                          >
                            Buy Single A La Carte — $11.99
                          </button>
                          <button
                            onClick={() => (window.location.href = PREP101_STRIPE_LINKS.threePack)}
                            className="btn btnPrimary"
                            style={{
                              padding: "6px 10px",
                              fontSize: "0.875rem",
                            }}
                          >
                            Buy 3-Pack — $21.99
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => (window.location.href = "/pricing")}
                          className="btn btnPrimary"
                          style={{
                            padding: "6px 10px",
                            fontSize: "0.875rem",
                          }}
                        >
                          See Plans
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Body */}
          <div className="card-white" id="prep101-builder">
            <SectionHeader
              eyebrow="Prep101 Builder"
              title="Build a full audition guide"
              description="Start by uploading your sides. After the PDF is processed, we’ll ask for the role details and generate the guide."
            />
            {!uploadData && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                  gap: 12,
                  marginBottom: "1.25rem",
                }}
              >
                <StepHint
                  number="1"
                  title="Upload sides"
                  description="Drop in the PDF for the audition scene."
                />
                <StepHint
                  number="2"
                  title="Confirm the role"
                  description="Tell us the character and production details."
                />
                <StepHint
                  number="3"
                  title="Generate the guide"
                  description="Get a Prep101 guide saved to this account."
                />
              </div>
            )}
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

          {/* ── GUIDE LIBRARY ─────────────────────────────────────── */}
          <div className="card-white">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: '1rem', flexWrap: 'wrap' }}>
            <SectionHeader
              eyebrow="Saved Work"
              title="Your guides"
              description="Open, download, or filter the guides saved to this account."
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['all', 'prep101', 'reader101', 'bold_choices'].map(f => (
                <button
                  key={f}
                  onClick={() => {
                    setGuideFilter(f);
                    const nextUrl = f === 'all' ? '/dashboard' : `/dashboard?product=${encodeURIComponent(f)}`;
                    window.history.replaceState({}, '', nextUrl);
                  }}
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
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <a
                          href={g.viewUrl || `/guide/${g.id}`}
                          style={{
                            fontSize: 12, fontWeight: 700, color: '#0f172a',
                            background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8,
                            padding: '5px 12px', textDecoration: 'none', whiteSpace: 'nowrap',
                          }}
                        >
                          Open
                        </a>
                        <a
                          href={`${API_BASE}${g.htmlUrl || `/api/guides/${g.id}/html`}`}
                          download
                          style={{
                            fontSize: 12, fontWeight: 700, color: '#0f172a',
                            background: '#e2e8f0', borderRadius: 8,
                            padding: '5px 12px', textDecoration: 'none', whiteSpace: 'nowrap',
                          }}
                        >
                          HTML
                        </a>
                        <a
                          href={`${API_BASE}${g.pdfUrl || `/api/guides/${g.id}/pdf`}`}
                          download
                          style={{
                            fontSize: 12, fontWeight: 700, color: '#0f172a',
                            background: 'var(--gold, #f59e0b)', borderRadius: 8,
                            padding: '5px 12px', textDecoration: 'none', whiteSpace: 'nowrap',
                          }}
                        >
                          PDF
                        </a>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
          </div>
          {/* ── END GUIDE LIBRARY ─────────────────────────────────── */}
        </div>

        {/* Footer */}
        <Footer />
      </div>
    </>
  );
};

export default Dashboard;
