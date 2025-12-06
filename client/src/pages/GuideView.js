import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import API_BASE from "../config/api";
import "../styles/shared.css";
import "../styles/guide.css";

// Strip inline styles from generated HTML
const stripInlineStyles = (html) =>
  html.replace(/<style[\s\S]*?<\/style>/gi, "");

// Normalize the worst inline styles from the model for better readability
const normalizeGuide = (html) => {
  // strip embedded <style> blocks
  html = html.replace(/<style[\s\S]*?<\/style>/gi, "");
  // kill inline text-shadows
  html = html.replace(/text-shadow\s*:\s*[^;"']+;?/gi, "");
  // downgrade super low opacity text
  html = html.replace(/opacity\s*:\s*0\.[0-3]\d*;?/gi, "opacity:1;");
  // remove inline color styles that cause contrast issues
  html = html.replace(/\bcolor\s*:\s*(?:#[0-9a-fA-F]{3,8}|rgb[a]?\([^)]+\)|white|#fff|#ffffff)[^;"']*(;|(?=['"]))*/gi, "");
  // remove problematic background colors
  html = html.replace(/background(?:-color)?\s*:\s*(?:linear-gradient[^;]+|#[0-9a-fA-F]{3,8}|rgb[a]?\([^)]+\))[^;"']*(;|(?=['"]))*/gi, "");
  // remove filter effects that might dim text
  html = html.replace(/filter\s*:\s*[^;"']+;?/gi, "");
  // remove mix-blend-mode that can cause contrast issues
  html = html.replace(/mix-blend-mode\s*:\s*[^;"']+;?/gi, "");
  return html;
};

const GuideView = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [emailSending, setEmailSending] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);

  useEffect(() => {
    const fetchGuide = async () => {
      if (!user?.accessToken && !user?.token) {
        setError("Authentication required");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/guides/${id}`, {
          headers: {
            Authorization: `Bearer ${user.accessToken || user.token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            setError("Authentication failed. Please log in again.");
          } else if (response.status === 404) {
            setError("Guide not found");
          } else {
            setError(`Failed to load guide (HTTP ${response.status})`);
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        setGuide(data.guide);
      } catch (err) {
        console.error("Error fetching guide:", err);
        setError("Failed to load guide");
      } finally {
        setLoading(false);
      }
    };

    fetchGuide();
  }, [id, user]);

  const handleBack = () => {
    navigate("/account");
  };

  const handleEmailGuide = async () => {
    if (!user?.accessToken && !user?.token) {
      setError("Authentication required to email guide");
      return;
    }
    setEmailSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/guides/${id}/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.accessToken || user.token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message =
          data.error || `Failed to email guide (HTTP ${res.status})`;
        alert(message);
        return;
      }

      alert("Guide emailed to your account email address.");
    } catch (err) {
      console.error("Error emailing guide:", err);
      alert("Failed to email guide. Please try again later.");
    } finally {
      setEmailSending(false);
    }
  };

  const handlePrintGuide = () => {
    if (!guide?.generatedHtml) {
      alert("Guide content not available yet.");
      return;
    }

    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      alert("Popup blocked. Please allow popups to print your guide.");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${guide.characterName} - Prep101 Guide</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 24px; color: #1f2937; }
            h1 { color: #b45309; }
            h2 { color: #374151; }
            .section { margin-bottom: 24px; }
          </style>
        </head>
        <body>
          ${guide.generatedHtml}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleDownloadPdf = async () => {
    if (!user?.accessToken && !user?.token) {
      alert("Authentication required to download PDF.");
      return;
    }

    setPdfDownloading(true);
    try {
      const res = await fetch(`${API_BASE}/api/guides/${id}/pdf`, {
        headers: {
          Authorization: `Bearer ${user.accessToken || user.token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.error || `Failed to download PDF (HTTP ${res.status})`
        );
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${guide.characterName}_${guide.productionTitle}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading PDF:", err);
      alert(err.message || "Failed to download PDF.");
    } finally {
      setPdfDownloading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="page-dark">
          <div className="container">
            <div style={{ textAlign: "center", padding: "2rem" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
                Loading guide...
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar />
        <div className="page-dark">
          <div className="container">
            <div style={{ textAlign: "center", padding: "2rem" }}>
              <div
                style={{
                  fontSize: "1.5rem",
                  marginBottom: "1rem",
                  color: "#ef4444",
                }}
              >
                Error
              </div>
              <div style={{ marginBottom: "2rem" }}>{error}</div>
              <button onClick={handleBack} className="btn btnPrimary">
                Back to Account
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!guide) {
    return (
      <>
        <Navbar />
        <div className="page-dark">
          <div className="container">
            <div style={{ textAlign: "center", padding: "2rem" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
                Guide not found
              </div>
              <button onClick={handleBack} className="btn btnPrimary">
                Back to Account
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Sanitize the HTML before rendering
  const safeHtml = normalizeGuide(guide.generatedHtml);

  return (
    <>
      <Navbar />
      <div className="page-dark">
        <div className="container">
          <div
            style={{ padding: "2rem 0", maxWidth: "1400px", margin: "0 auto" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "1rem",
                marginBottom: "2rem",
                flexWrap: "wrap",
              }}
            >
              <button onClick={handleBack} className="btn btnSecondary">
                ← Back to Account
              </button>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button onClick={handlePrintGuide} className="btn btnGhost">
                  🖨️ Print Guide
                </button>
                <button
                  onClick={handleDownloadPdf}
                  className="btn btnGhost"
                  disabled={pdfDownloading}
                >
                  {pdfDownloading ? "Preparing PDF…" : "⬇️ Download PDF"}
                </button>
                <button
                  onClick={handleEmailGuide}
                  className="btn btnPrimary"
                  disabled={emailSending}
                >
                  {emailSending ? "Emailing…" : "Email This Guide"}
                </button>
              </div>
            </div>

            <div
              style={{
                background: "#1f2937",
                borderRadius: "0.75rem",
                padding: "2.5rem",
                marginBottom: "2rem",
                border: "1px solid #374151",
              }}
            >
              <h1
                style={{
                  fontSize: "2.5rem",
                  marginBottom: "1rem",
                  color: "#fbbf24",
                  fontWeight: "bold",
                  lineHeight: "1.2",
                }}
              >
                {guide.characterName}
              </h1>
              <div
                style={{
                  fontSize: "1.25rem",
                  marginBottom: "0.5rem",
                  color: "#f3f4f6",
                  fontWeight: "500",
                }}
              >
                {guide.productionTitle}
              </div>
              <div
                style={{
                  color: "#9ca3af",
                  marginBottom: "0",
                  fontSize: "1rem",
                }}
              >
                {guide.productionType} • {guide.roleSize} • {guide.genre}
              </div>
            </div>

            <div
              className="guide-html"
              dangerouslySetInnerHTML={{ __html: safeHtml }}
              style={{
                background: "#1f2937",
                borderRadius: "0.75rem",
                padding: "2.5rem",
                color: "#f3f4f6",
                lineHeight: "1.7",
                fontSize: "1rem",
                border: "1px solid #374151",
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default GuideView;
