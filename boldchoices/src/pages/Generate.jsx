import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext.jsx';
import Navbar from '../components/Navbar.jsx';
import GuideResult from '../components/GuideResult.jsx';
import API_BASE from '../config/api.js';
import { withApiCredentials } from '../utils/apiAuth.js';

const isLegacyFallbackMessage = (value = '') =>
  /limited script text detected|upload clearer sides for line-specific detail/i.test(
    String(value || '')
  );

const sanitizeWarnings = (warnings = []) =>
  (Array.isArray(warnings) ? warnings : []).filter(
    (warning) => !isLegacyFallbackMessage(warning)
  );

// ── STYLES ──────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: '100vh',
    background: '#0a0a0f',
    color: '#F0EEF5',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '380px 1fr',
    minHeight: 'calc(100vh - 64px)',
  },
  sidebar: {
    borderRight: '1px solid rgba(255,255,255,0.07)',
    padding: '32px 28px',
    overflowY: 'auto',
    position: 'sticky',
    top: 64,
    height: 'calc(100vh - 64px)',
    background: 'rgba(255,255,255,0.015)',
  },
  main: {
    padding: '40px 48px',
    maxWidth: 900,
  },
  sideSection: {
    marginBottom: 28,
  },
  sideLabel: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'rgba(240,238,245,0.35)',
    marginBottom: 14,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: 'rgba(240,238,245,0.5)',
    marginBottom: 5,
    letterSpacing: '0.04em',
  },
  input: {
    width: '100%',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 14,
    color: '#F0EEF5',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13.5,
    color: '#F0EEF5',
    outline: 'none',
    resize: 'vertical',
    minHeight: 140,
    fontFamily: 'inherit',
    lineHeight: 1.6,
    boxSizing: 'border-box',
  },
  orDivider: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    margin: '12px 0',
    fontSize: 11,
    color: 'rgba(240,238,245,0.25)',
    letterSpacing: '0.06em',
  },
  orLine: {
    flex: 1,
    height: 1,
    background: 'rgba(255,255,255,0.07)',
  },
  uploadZone: {
    border: '1.5px dashed rgba(255,255,255,0.15)',
    borderRadius: 10,
    padding: '16px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'border-color 0.2s, background 0.2s',
    fontSize: 13,
    color: 'rgba(240,238,245,0.4)',
  },
  generateBtn: {
    width: '100%',
    background: 'linear-gradient(135deg, #FF4D4D 0%, #F5A623 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '14px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.02em',
    marginTop: 8,
    transition: 'opacity 0.2s',
    boxShadow: '0 4px 20px rgba(255,77,77,0.25)',
  },
  modeToggle: {
    display: 'flex',
    borderRadius: 10,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.1)',
    marginBottom: 20,
  },
  modeBtn: (active, color) => ({
    flex: 1,
    padding: '9px 6px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    border: 'none',
    cursor: 'pointer',
    background: active ? color : 'transparent',
    color: active ? '#fff' : 'rgba(240,238,245,0.4)',
    transition: 'all 0.2s',
  }),
  // Main area states
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 500,
    gap: 16,
    textAlign: 'center',
    color: 'rgba(240,238,245,0.3)',
  },
  emptyIcon: {
    fontSize: 56,
    opacity: 0.4,
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: 'Fraunces, serif',
    fontSize: '1.6rem',
    fontWeight: 700,
    color: 'rgba(240,238,245,0.2)',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 14,
    color: 'rgba(240,238,245,0.2)',
    maxWidth: 320,
    lineHeight: 1.6,
  },
  loadingOverlay: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 500,
    gap: 20,
  },
  spinner: {
    width: 48,
    height: 48,
    border: '3px solid rgba(255,255,255,0.1)',
    borderTop: '3px solid #FF4D4D',
    borderRadius: '50%',
    animation: 'spin 0.9s linear infinite',
  },
  loadingText: {
    fontFamily: 'Fraunces, serif',
    fontSize: '1.2rem',
    color: 'rgba(240,238,245,0.6)',
  },
  loadingSlogan: {
    fontSize: 13,
    color: 'rgba(240,238,245,0.3)',
    maxWidth: 280,
    textAlign: 'center',
    lineHeight: 1.6,
  },
};

// Loading slogans that rotate
const SLOGANS = [
  'Analyzing what makes this character specific...',
  'Identifying the choices 95% of actors will miss...',
  'Finding the emotional engine beneath the lines...',
  'Crafting the adjustment that changes everything...',
  'Building your Take 2 strategy...',
];

const describeBoldUsage = (usage) => {
  if (!usage) return 'Checking access...';
  if (usage.unlimited) return 'Unlimited monthly access is active.';
  if (usage.credits > 0) {
    return `${usage.credits} Bold Choices credit${usage.credits === 1 ? '' : 's'} remaining.`;
  }
  return 'Using the free monthly generation path.';
};

// ── COMPONENT ───────────────────────────────────────────────────────────────
export default function Generate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Form
  const [form, setForm] = useState({
    characterName: '',
    actorAge: '',
    productionTitle: '',
    productionType: '',
    roleSize: '',
    genre: '',
    storyline: '',
    characterDescription: '',
    sceneText: '',
  });



  const [isGenerating, setIsGenerating] = useState(false);
  const [sloganIdx, setSloganIdx] = useState(0);
  const [resultHtml, setResultHtml] = useState(null);
  const [resultMeta, setResultMeta] = useState(null);
  const [guideData, setGuideData] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState(null);
  const [uploadData, setUploadData] = useState(null);
  const [generationId, setGenerationId] = useState(null); // tracks current generation
  const resultRef = useRef(null);
  const activeActor = user?.account?.activeActor;
  const [boldUsage, setBoldUsage] = useState(() => user?.boldChoicesUsage || null);

  useEffect(() => {
    if (!activeActor) return;
    setForm((current) => ({
      ...current,
      actorAge: current.actorAge || activeActor.ageRange || '',
    }));
  }, [activeActor]);

  useEffect(() => {
    setBoldUsage(user?.boldChoicesUsage || null);
  }, [user]);

  const handleField = useCallback((e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }, []);

  // ── File upload ──────────────────────────────────────────────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }

    const toastId = toast.loading('Extracting text from PDF...');
    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        ...withApiCredentials({}, user),
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      if (data.sceneText || data.preview) {
        const sceneText = data.sceneText || data.text || '';
        const uploadIds = data.uploadIds || (data.uploadId ? [data.uploadId] : []);
        const primaryUploadId = data.uploadId || uploadIds[0] || null;
        const scenePayloads =
          data.scenePayloads ||
          (primaryUploadId && sceneText
            ? {
                [primaryUploadId]: {
                  filename: data.filename || data.originalName || file.name,
                  sceneText,
                  characterNames: data.characterNames || [],
                  extractionMethod: data.extractionMethod || 'upload',
                  extractionConfidence: data.extractionConfidence || 'unknown',
                  wordCount: data.wordCount || 0,
                  fileType: data.fileType || 'sides',
                  fallbackMode: Boolean(data.fallbackMode),
                  warnings: sanitizeWarnings(data.warnings),
                  source: data.source || data.extractionMethod || 'text',
                },
              }
            : {});
        const sanitizedUploadMessage = isLegacyFallbackMessage(data.uploadMessage)
          ? null
          : data.uploadMessage;

        setUploadData({
          ...data,
          uploadMessage: sanitizedUploadMessage,
          warnings: sanitizeWarnings(data.warnings),
          sceneText,
          uploadIds,
          scenePayloads,
        });
        setUploadedFileName(file.name);
        setForm(f => ({ ...f, sceneText: '' })); // clear out any pasted text to avoid confusion
        if (sanitizedUploadMessage) {
          toast(sanitizedUploadMessage, { id: toastId, icon: '🧠', duration: 5000 });
        } else {
          toast.success(`Extracted ${data.wordCount || '?'} words`, { id: toastId });
        }
      } else {
        toast.error('Could not extract text — try pasting directly', { id: toastId });
      }
    } catch (err) {
      toast.error(err.message, { id: toastId });
    }
  };

  // ── Core generate function ───────────────────────────────────────────────
  const doGenerate = useCallback(async (options = {}) => {
    const {
      modifier = null,    // null | 'wilder' | 'take2'
      isRetry = false,    // Spin Again
    } = options;

    if (!form.characterName.trim()) {
      toast.error('Character name is required');
      return;
    }
    const sceneText = uploadData?.sceneText ? uploadData.sceneText.trim() : form.sceneText.trim();
    if (!sceneText || sceneText.length < 20) {
      toast.error('Please enter scene text or upload your sides');
      return;
    }

    setIsGenerating(true);
    setResultHtml(null);
    setSloganIdx(0);

    // Rotate slogans every 3 seconds
    const sloganTimer = setInterval(() => {
      setSloganIdx(i => (i + 1) % SLOGANS.length);
    }, 3000);

    const toastId = toast.loading(
      modifier === 'wilder' ? 'Pushing the choices further...'
        : modifier === 'take2' ? 'Generating alternate Take 2 strategies...'
        : isRetry ? 'Spinning brand new choices...'
        : 'Generating your Bold Choices guide...'
    );

    try {
      const payload = {
        ...form,
        sceneText,
        preview: false,
        format: 'json',
        fallbackMode: Boolean(uploadData?.fallbackMode),
        warnings: uploadData?.warnings || [],
        ...(modifier ? { modifier } : {}),
        ...(isRetry ? { spinAgain: true, previousGenerationId: generationId } : {}),
      };

      const res = await fetch(`${API_BASE}/api/bold-choices/generate`, {
        method: 'POST',
        ...withApiCredentials({
          headers: {
            'Content-Type': 'application/json',
          },
        }, user),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Error ${res.status}`);

      // Store raw data and generation ID
      setGuideData(data.data);
      if (data.boldChoicesUsage) {
        setBoldUsage(data.boldChoicesUsage);
      }
      if (data.generationId) setGenerationId(data.generationId);
      setResultMeta({ ...form, isPreview: false });
      setResultHtml(null);

      toast.dismiss(toastId);
    } catch (err) {
      toast.error(err.message, { id: toastId });
      setIsGenerating(false);
      clearInterval(sloganTimer);
      return;
    } finally {
      clearInterval(sloganTimer);
    }

    // Simpler: do a single call that returns HTML
    try {
      const htmlRes = await fetch(`${API_BASE}/api/bold-choices/generate`, {
        method: 'POST',
        ...withApiCredentials({
          headers: {
            'Content-Type': 'application/json',
          },
        }, user),
        body: JSON.stringify({
          ...form,
          sceneText,
          preview: false,
          format: 'html',
          fallbackMode: Boolean(uploadData?.fallbackMode),
          warnings: uploadData?.warnings || [],
          ...(modifier ? { modifier } : {}),
          ...(isRetry ? { spinAgain: true, previousGenerationId: generationId } : {}),
        }),
      });

      const htmlData = await htmlRes.json();
      if (!htmlData.success) throw new Error(htmlData.error || 'Failed');

      setResultHtml(htmlData.html);
      // Keep generationId from the first (JSON) call, not this second call
      if (htmlData.generationId && !generationId) setGenerationId(htmlData.generationId);

      // Create blob URL for open-in-tab
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      const blob = new Blob([htmlData.html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);

      toast.success(
        modifier === 'wilder' ? 'Wilder choices ready — go take the risk.'
          : modifier === 'take2' ? 'Alternate Take 2 strategies ready.'
          : isRetry ? 'Fresh choices generated!'
          : 'Guide ready. Time to book.'
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsGenerating(false);
    }
  }, [form, blobUrl, user, uploadData, generationId]);

  const handleGenerate = () => doGenerate();
  const handleSpinAgain = () => doGenerate({ isRetry: true });
  const handleWilder = () => doGenerate({ modifier: 'wilder' });
  const handleTake2 = () => doGenerate({ modifier: 'take2' });

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .gen-input:focus { border-color: rgba(255,77,77,0.5) !important; }
        .upload-zone:hover { border-color: rgba(255,255,255,0.3) !important; background: rgba(255,255,255,0.03) !important; }
        .gen-btn:hover:not(:disabled) { opacity: 0.88; }
        .gen-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        @media (max-width: 768px) {
          .gen-layout { grid-template-columns: 1fr !important; }
          .gen-sidebar { position: static !important; height: auto !important; border-right: none !important; border-bottom: 1px solid rgba(255,255,255,0.07) !important; }
          .gen-main { padding: 24px 20px !important; }
        }
      `}</style>

      <Navbar />

      <div className="gen-layout" style={S.layout}>
        {/* ── SIDEBAR ── */}
        <div className="gen-sidebar" style={S.sidebar}>

          {activeActor && (
            <div style={{
              marginBottom: 22,
              padding: '14px 16px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.035)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div style={{ ...S.sideLabel, marginBottom: 8 }}>Active Actor</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#F0EEF5', marginBottom: 4 }}>
                {activeActor.actorName}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(240,238,245,0.45)', lineHeight: 1.6 }}>
                {activeActor.ageRange
                  ? `Using ${activeActor.ageRange} as your current account context.`
                  : 'Using your current Child Actor 101 account context for this guide.'}
              </div>
            </div>
          )}

          <div style={{
            marginBottom: 22,
            padding: '14px 16px',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.035)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ ...S.sideLabel, marginBottom: 8 }}>Access</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F0EEF5', marginBottom: 4 }}>
              {boldUsage?.unlimited ? 'Bold Choices Unlimited' : 'Bold Choices Access'}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(240,238,245,0.45)', lineHeight: 1.6 }}>
              {describeBoldUsage(boldUsage)}
            </div>
          </div>

          {/* Character */}
          <div style={S.sideSection}>
            <div style={S.sideLabel}>Character</div>

            <div style={S.field}>
              <label style={S.label}>Character Name <span style={{ color: '#FF4D4D' }}>*</span></label>
              <input
                className="gen-input"
                style={S.input}
                name="characterName"
                value={form.characterName}
                onChange={handleField}
                placeholder="e.g., CeCe Rodriguez"
              />
            </div>

            <div style={S.field}>
              <label style={S.label}>Actor's Age <span style={{ color: '#FF4D4D' }}>*</span></label>
              <input
                className="gen-input"
                style={S.input}
                name="actorAge"
                value={form.actorAge}
                onChange={handleField}
                placeholder="e.g., 8, 12, 15"
              />
            </div>
          </div>

          {/* Production */}
          <div style={S.sideSection}>
            <div style={S.sideLabel}>Production</div>

            <div style={S.field}>
              <label style={S.label}>Production Title <span style={{ color: '#FF4D4D' }}>*</span></label>
              <input
                className="gen-input"
                style={S.input}
                name="productionTitle"
                value={form.productionTitle}
                onChange={handleField}
                placeholder="e.g., How to Be a Drama Queen"
              />
            </div>

            <div style={S.field}>
              <label style={S.label}>Production Type <span style={{ color: '#FF4D4D' }}>*</span></label>
              <select
                className="gen-input"
                style={{ ...S.input, appearance: 'menulist' }}
                name="productionType"
                value={form.productionType}
                onChange={handleField}
              >
                <option value="" disabled>Select type...</option>
                <option value="Film">Film</option>
                <option value="Television">Television</option>
                <option value="Commercial">Commercial</option>
                <option value="Theatre">Theatre</option>
                <option value="New Media / Web">New Media / Web</option>
              </select>
            </div>

            <div style={S.field}>
              <label style={S.label}>Role Size <span style={{ color: '#FF4D4D' }}>*</span></label>
              <select
                className="gen-input"
                style={{ ...S.input, appearance: 'menulist' }}
                name="roleSize"
                value={form.roleSize}
                onChange={handleField}
              >
                <option value="" disabled>Select role size...</option>
                <option value="Lead">Lead</option>
                <option value="Supporting / Guest Star">Supporting / Guest Star</option>
                <option value="Co-Star / Day Player">Co-Star / Day Player</option>
                <option value="Series Regular">Series Regular</option>
                <option value="Recurring">Recurring</option>
              </select>
            </div>

            <div style={S.field}>
              <label style={S.label}>Genre <span style={{ color: '#FF4D4D' }}>*</span></label>
              <input
                className="gen-input"
                style={S.input}
                name="genre"
                value={form.genre}
                onChange={handleField}
                placeholder="e.g., Single-cam comedy, Medical drama, Teen romance"
              />
            </div>

            <div style={S.field}>
              <label style={S.label}>Storyline/Project Description (if available)</label>
              <textarea
                className="gen-input"
                style={{ ...S.textarea, minHeight: 70 }}
                name="storyline"
                value={form.storyline}
                onChange={handleField}
                placeholder="Brief description of the show/film's storyline or premise..."
              />
            </div>
          </div>

          {/* Breakdown */}
          <div style={S.sideSection}>
            <div style={S.sideLabel}>Breakdown</div>

            <div style={S.field}>
              <label style={S.label}>Character Breakdown (if available)</label>
              <textarea
                className="gen-input"
                style={{ ...S.textarea, minHeight: 80 }}
                name="characterDescription"
                value={form.characterDescription}
                onChange={handleField}
                placeholder="Paste any character description provided by casting..."
              />
            </div>
          </div>

          {/* Sides */}
          <div style={S.sideSection}>
            <div style={S.sideLabel}>
              Scene Text / Sides <span style={{ color: '#FF4D4D' }}>*</span>
            </div>

            {/* Upload */}
            <div
              className="upload-zone"
              style={S.uploadZone}
              onClick={() => fileInputRef.current?.click()}
            >
              <div style={{ fontSize: 20, marginBottom: 4 }}>📄</div>
              {uploadedFileName
                ? <><strong style={{ color: '#00D4C8' }}>{uploadedFileName}</strong><br /><span style={{ fontSize: 12 }}>Click to replace</span></>
                : <><strong>Upload PDF</strong><br /><span style={{ fontSize: 12 }}>or paste text below</span></>
              }
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            {uploadedFileName ? (
              <div style={{ marginTop: 14, padding: 14, background: 'rgba(0, 212, 200, 0.1)', borderRadius: 8, border: '1px solid rgba(0, 212, 200, 0.3)', color: '#00D4C8', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>✅ Extracted <strong>{uploadData?.wordCount || '?'}</strong> words</div>
                <button type="button" onClick={() => { setUploadedFileName(null); setUploadData(null); }} style={{ background: 'transparent', border: 'none', color: '#00D4C8', textDecoration: 'underline', cursor: 'pointer', fontSize: 12, padding: 0 }}>Remove</button>
              </div>
            ) : (
              <>
                <div style={S.orDivider}>
                  <div style={S.orLine} />
                  <span>or</span>
                  <div style={S.orLine} />
                </div>

                <textarea
                  className="gen-input"
                  style={S.textarea}
                  name="sceneText"
                  value={form.sceneText}
                  onChange={handleField}
                  placeholder="Paste your sides here..."
                />
                <div style={{ fontSize: 11, color: 'rgba(240,238,245,0.25)', marginTop: 4 }}>
                  {form.sceneText.trim().split(/\s+/).filter(Boolean).length} words
                </div>
              </>
            )}
          </div>

          <button
            className="gen-btn"
            style={S.generateBtn}
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating...' : 'Generate Bold Choices'}
          </button>
        </div>

        {/* ── MAIN ── */}
        <div className="gen-main" style={S.main}>
          {isGenerating ? (
            <div style={S.loadingOverlay}>
              <div style={S.spinner} />
              <div style={S.loadingText}>Working on it...</div>
              <div style={S.loadingSlogan}>{SLOGANS[sloganIdx]}</div>
            </div>
          ) : resultHtml ? (
          <GuideResult
              html={resultHtml}
              blobUrl={blobUrl}
              meta={resultMeta}
              isPreview={false}
              onSpinAgain={handleSpinAgain}
              onMakeWilder={handleWilder}
              onTake2={handleTake2}
              isGenerating={isGenerating}
              user={user}
              generationId={generationId}
            />
          ) : (
            <div style={S.emptyState}>
              <div style={S.emptyIcon}>🎯</div>
              <div style={S.emptyTitle}>Ready when you are.</div>
              <div style={S.emptyDesc}>
                Fill in your character info and paste your sides. Your bold choices are one click away.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
