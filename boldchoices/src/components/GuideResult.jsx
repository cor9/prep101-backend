import React, { useRef, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

/**
 * GuideResult
 *
 * Renders the generated guide HTML in an iframe, plus the action bar:
 *   Spin Again | Make It Wilder | Take 2 | Open in Tab | Unlock Full / Prep101 Bridge
 *
 * Improvements:
 *  - Auto-scroll to result on mount (#9)
 *  - Saved-state toggle on Save buttons (#7)
 *  - Generation ID threaded through for Prep101 bridge (#4, #5)
 *  - Analytics calls for upgrade_clicked / upgrade_completed (#8)
 *  - Harder paywall copy in upgrade modal (#3)
 */
export default function GuideResult({
  html,
  blobUrl,
  meta,
  isPreview,
  onSpinAgain,
  onMakeWilder,
  onTake2,
  onUnlock,
  isGenerating,
  user,
  generationId,      // NEW: uuid from backend
}) {
  const iframeRef = useRef(null);
  const wrapperRef = useRef(null);
  const [iframeHeight, setIframeHeight] = useState(900);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [savedChoices, setSavedChoices] = useState(new Set()); // track saved choice keys

  const isPro = user && (user.subscription === 'pro' || user.isPro);
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  // ── #9: Auto-scroll to result ─────────────────────────────────────────────
  useEffect(() => {
    if (!html || !wrapperRef.current) return;
    setTimeout(() => {
      wrapperRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }, [html]);

  // Auto-resize iframe to content
  useEffect(() => {
    if (!iframeRef.current || !html) return;
    const iframe = iframeRef.current;
    const updateHeight = () => {
      try {
        const h = iframe.contentDocument?.body?.scrollHeight;
        if (h && h > 400) setIframeHeight(h + 40);
      } catch (_) {}
    };
    iframe.onload = updateHeight;
    const t = setTimeout(updateHeight, 600);
    return () => clearTimeout(t);
  }, [html]);

  // Write HTML into iframe
  useEffect(() => {
    if (!iframeRef.current || !html) return;
    const iframe = iframeRef.current;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
    }
  }, [html]);

  // ── Handle BOLD_CHOICES_SAVE messages from iframe ─────────────────────────
  useEffect(() => {
    const handleMessage = async (e) => {
      if (e.data?.type !== 'BOLD_CHOICES_SAVE') return;

      const choiceKey = e.data.choice?.substring(0, 60) || 'unknown';
      const toastId = toast.loading('Saving choice...');

      try {
        const res = await fetch(`${API_BASE}/api/bold-choices/save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user?.accessToken || user?.token}`,
          },
          body: JSON.stringify({
            choice: e.data.choice,
            character: meta?.characterName,
            show: meta?.show,
            generationId: generationId || null,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setSavedChoices(prev => new Set([...prev, choiceKey]));
          toast.success('⭐ Added to your playbook', { id: toastId });
        } else {
          toast.error('Failed to save: ' + (data.error || 'Unknown error'), { id: toastId });
        }
      } catch (err) {
        toast.error('Failed to save', { id: toastId });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [meta, user, generationId, API_BASE]);

  // ── Analytics helper ──────────────────────────────────────────────────────
  const trackEvent = async (event, extraMeta = {}) => {
    try {
      await fetch(`${API_BASE}/api/bold-choices/analytics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.accessToken || user?.token}`,
        },
        body: JSON.stringify({
          event,
          meta: { characterName: meta?.characterName, show: meta?.show, generationId, ...extraMeta },
        }),
      });
    } catch (_) {}
  };

  const disabled = isGenerating;

  const actionBtnStyle = (color, bg, disabledVisual) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '10px 18px',
    borderRadius: 10,
    border: `1.5px solid ${color}`,
    background: bg,
    color: color,
    fontSize: 13.5,
    fontWeight: 700,
    cursor: disabledVisual ? 'not-allowed' : 'pointer',
    opacity: disabledVisual ? 0.45 : 1,
    transition: 'all 0.18s',
    whiteSpace: 'nowrap',
    fontFamily: 'DM Sans, sans-serif',
    letterSpacing: '0.02em',
  });

  const handleProtectedAction = (action, eventName) => {
    if (!isPro) {
      trackEvent('upgrade_clicked', { trigger: eventName });
      setShowUpgradeModal(true);
    } else {
      action();
    }
  };

  // ── #4: Build rich Prep101 bridge URL ────────────────────────────────────
  const buildPrep101Url = (path = '/dashboard') => {
    const params = new URLSearchParams({
      from: 'boldchoices',
      char: meta?.characterName || '',
      show: meta?.show || '',
      ...(generationId ? { seed: generationId } : {}),
    });
    return `https://prep101.site${path}?${params}`;
  };

  return (
    <div ref={wrapperRef}>
      <style>{`
        .action-btn:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
        .prep101-bridge { animation: slideUp 0.4s ease; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .saved-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; color: #00D4C8; background: rgba(0,212,200,0.1); border: 1px solid rgba(0,212,200,0.3); border-radius: 6px; padding: 3px 8px; margin-left: 8px; }
      `}</style>

      {/* ── ACTION BAR ── */}
      <div style={{
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        marginBottom: 24,
        alignItems: 'center',
      }}>
        {/* Spin Again */}
        <button
          className="action-btn"
          style={actionBtnStyle('rgba(245,166,35,0.9)', 'rgba(245,166,35,0.08)', isGenerating)}
          onClick={() => handleProtectedAction(onSpinAgain, 'spin_again')}
          disabled={isGenerating}
          title="Same sides, brand new set of choices"
        >
          🔄 Spin Again
        </button>

        {/* Make It Wilder */}
        <button
          className="action-btn"
          style={actionBtnStyle('rgba(255,77,77,0.9)', 'rgba(255,77,77,0.08)', isGenerating)}
          onClick={() => handleProtectedAction(onMakeWilder, 'make_wilder')}
          disabled={isGenerating}
          title="Escalate the risk — more unexpected, more memorable"
        >
          🔥 Make It Wilder
        </button>

        {/* Take 2 */}
        <button
          className="action-btn"
          style={actionBtnStyle('rgba(0,212,200,0.9)', 'rgba(0,212,200,0.08)', isGenerating)}
          onClick={() => handleProtectedAction(onTake2, 'take2')}
          disabled={isGenerating}
          title="Generate alternate Take 2 strategies"
        >
          🎬 Take 2
        </button>

        {/* Divider */}
        <div style={{ flex: 1 }} />

        {/* Build Full Performance */}
        <button
          className="action-btn"
          style={{
            ...actionBtnStyle('#F0EEF5', 'rgba(255,255,255,0.06)', isGenerating),
            border: '1.5px solid rgba(255,255,255,0.15)',
          }}
          onClick={() => {
            trackEvent('build_performance_clicked');
            window.open(buildPrep101Url('/dashboard'), '_blank');
          }}
          disabled={isGenerating}
        >
          ✨ Build Full Performance (Prep101)
        </button>
      </div>

      {/* ── IFRAME PREVIEW ── */}
      <div style={{
        borderRadius: 14,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.08)',
        background: '#FAFAF5',
      }}>
        <iframe
          ref={iframeRef}
          title="Bold Choices Guide"
          style={{
            width: '100%',
            height: iframeHeight,
            border: 'none',
            display: 'block',
          }}
          sandbox="allow-same-origin allow-popups"
        />
      </div>

      {/* ── UPGRADE MODAL ── */}
      {showUpgradeModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}>
          <div style={{
            background: '#1a1a1f', padding: '48px 44px', borderRadius: 24,
            border: '1px solid rgba(255,255,255,0.1)', maxWidth: 460, width: '100%',
            textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
            animation: 'slideUp 0.25s ease',
          }}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>🎬</div>
            <h2 style={{
              color: '#F0EEF5', marginBottom: 12,
              fontFamily: 'Fraunces, serif', fontSize: '1.9rem', lineHeight: 1.1,
            }}>
              This is where actors<br />start to stand out.
            </h2>
            <p style={{
              color: 'rgba(240,238,245,0.55)', marginBottom: 10,
              lineHeight: 1.7, fontSize: '0.95rem',
            }}>
              Most submissions stop at one take.
            </p>
            <p style={{
              color: 'rgba(240,238,245,0.75)', marginBottom: 32,
              lineHeight: 1.7, fontSize: '1rem', fontWeight: 600,
            }}>
              The second version is what gets remembered.
            </p>
            <button
              style={{
                background: 'linear-gradient(135deg, #FF4D4D 0%, #F5A623 100%)',
                color: '#fff', padding: '15px 24px', border: 'none',
                borderRadius: 12, fontSize: 16, fontWeight: 700,
                cursor: 'pointer', width: '100%', marginBottom: 14,
                boxShadow: '0 6px 20px rgba(255,77,77,0.35)',
                letterSpacing: '0.01em',
              }}
              onClick={() => {
                trackEvent('upgrade_completed', { from: 'modal' });
                window.location.href = buildPrep101Url('/upgrade');
              }}
            >
              👉 Unlock Unlimited Variations
            </button>
            <button
              onClick={() => setShowUpgradeModal(false)}
              style={{
                background: 'transparent', color: 'rgba(255,255,255,0.35)',
                border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              }}
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
