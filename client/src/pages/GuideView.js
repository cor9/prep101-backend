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
  // CRITICAL: remove ALL inline color styles - let CSS handle it
  html = html.replace(/\bcolor\s*:\s*[^;"']+[;]?/gi, "");
  // CRITICAL: remove ALL inline background colors and gradients - let CSS handle it
  html = html.replace(/background(?:-color)?\s*:\s*[^;"']+[;]?/gi, "");
  html = html.replace(/background-image\s*:\s*[^;"']+[;]?/gi, "");
  // remove filter effects that might dim text
  html = html.replace(/filter\s*:\s*[^;"']+;?/gi, "");
  // remove mix-blend-mode that can cause contrast issues
  html = html.replace(/mix-blend-mode\s*:\s*[^;"']+;?/gi, "");
  // remove any -webkit-text-stroke that makes text hard to read
  html = html.replace(/-webkit-text-stroke\s*:\s*[^;"']+;?/gi, "");
  
  // CRITICAL: Remove any style attributes that contain light colors
  // This regex matches style="..." and removes light color values
  html = html.replace(/style\s*=\s*["']([^"']*background[^"']*#[fFeEdDcCbBaA987654321][^"']*)["']/gi, (match, content) => {
    // Remove background-related properties but keep other styles
    const cleaned = content.replace(/background[^;]*;?/gi, "");
    return cleaned.trim() ? `style="${cleaned}"` : "";
  });
  
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
    const token = user?.accessToken || user?.token || localStorage.getItem('prep101_token');
    if (!token) {
      setError("Please log in to email guide");
      return;
    }
    setEmailSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/guides/${id}/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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

    // Normalize HTML to remove problematic inline styles
    let html = guide.generatedHtml;
    html = html.replace(/<style[\s\S]*?<\/style>/gi, "");
    html = html.replace(/text-shadow\s*:\s*[^;"']+;?/gi, "");
    html = html.replace(/\bcolor\s*:\s*[^;"']+[;]?/gi, "");
    html = html.replace(/background(?:-color)?\s*:\s*[^;"']+[;]?/gi, "");

    const printContent = `
      <html>
        <head>
          <title>${guide.characterName} - Prep101 Guide</title>
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: 'Inter', -apple-system, sans-serif;
              padding: 24px;
              color: #1f2937 !important;
              background: white !important;
              line-height: 1.6;
            }
            h1, h2, h3, h4, h5, h6 { color: #b45309 !important; margin-top: 1.5em; }
            p, li, span, div { color: #1f2937 !important; }
            .section { margin-bottom: 24px; padding: 16px; border-left: 4px solid #f59e0b; background: #fffbeb; }
            .highlight-box, .tip-box { background: #fef3c7 !important; color: #1f2937 !important; padding: 16px; border-radius: 8px; margin: 16px 0; }
            ul, ol { padding-left: 24px; }
            li { margin: 8px 0; }
            strong { color: #92400e !important; }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `;

    // Use iframe instead of popup to avoid popup blockers
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.left = '-9999px';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow || iframe.contentDocument;
    const doc = iframeDoc.document || iframeDoc;
    doc.open();
    doc.write(printContent);
    doc.close();

    // Wait for content to load then print
    iframe.onload = () => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.error("Print error:", e);
      }
      // Remove iframe after printing
      setTimeout(() => document.body.removeChild(iframe), 1000);
    };
  };

  const handleDownloadPdf = () => {
    // Use browser print dialog - user can select "Save as PDF"
    handlePrintGuide();
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
                >
                  📄 Save as PDF
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
