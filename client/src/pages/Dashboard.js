import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import FileUpload from '../components/FileUpload';
import GuideForm from '../components/GuideForm';
import LoadingSpinner from '../components/LoadingSpinner';

const API_BASE =
  (import.meta?.env?.VITE_API_BASE_URL) ||
  process.env.REACT_APP_API_BASE_URL ||
  'https://childactor101.sbs';

// Simple progress bar
const ProgressBar = ({ value, max }) => {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  return (
    <div style={{ width: '100%', height: 10, background: '#e5e7eb', borderRadius: 999 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: '#06b6d4', borderRadius: 999 }} />
    </div>
  );
};

const nicePlan = (p) => {
  switch ((p || '').toLowerCase()) {
    case 'free': return 'Free';
    case 'starter': return 'Starter';
    case 'premium': return 'Premium';
    case 'alacarte': return 'A la carte';
    default: return '—';
  }
};

const Dashboard = () => {
  const [uploadData, setUploadData] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // usage state
  const [usage, setUsage] = useState(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState(null);
  const [lastGuideUrl, setLastGuideUrl] = useState(null);

  const { user } = useAuth();

  // ====== USAGE FETCH ======
  useEffect(() => {
    let cancelled = false;

    const fetchUsage = async () => {
      setUsageLoading(true);
      setUsageError(null);

      try {
        const headers = user?.accessToken || user?.token
          ? { Authorization: `Bearer ${user.accessToken || user.token}` }
          : {};

        const res = await fetch(`${API_BASE}/api/auth/dashboard`, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        if (!cancelled) setUsage(json);
      } catch (err) {
        // Fallback mock so the UI still works in dev
        if (!cancelled) {
          setUsage({
            plan: user?.subscription || 'free',
            used: user?.guidesUsed || 0,
            limit: user?.guidesLimit || 1,
            renewsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString() // +7 days
          });
          setUsageError('Using fallback data until API is ready.');
        }
      } finally {
        if (!cancelled) setUsageLoading(false);
      }
    };

    fetchUsage();
    return () => { cancelled = true; };
  }, [user]);

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
    toast.success('PDF processed — ready to generate!');
  };

  // Open HTML in a new tab (Blob URL). Optionally reuse a pre-opened window.
  const openHtmlInNewTab = (htmlString, preOpenedWindow) => {
    const blob = new Blob([htmlString], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    setLastGuideUrl(url);
    if (preOpenedWindow) {
      preOpenedWindow.location.href = url;
      preOpenedWindow.focus();
    } else {
      const w = window.open(url, '_blank', 'noopener,noreferrer');
      if (!w) toast('Popup blocked. Use the “Open last guide” link below.', { icon: '⚠️' });
    }
  };

  // ====== GENERATE GUIDE ======
  const handleGenerateGuide = async (formData) => {
    if (!uploadData?.uploadId) {
      toast.error('Please upload your sides (PDF) before generating.');
      return;
    }
    if (!canGenerate) {
      toast.error('You’ve hit your guide limit. Upgrade for more this month.');
      // Optional: window.location.href = '/pricing';
      return;
    }

    const preWin = window.open('about:blank', '_blank', 'noopener,noreferrer');

    try {
      setIsGenerating(true);
      setLastGuideUrl(null);

      const headers = {
        'Content-Type': 'application/json',
        ...(user?.accessToken || user?.token
          ? { Authorization: `Bearer ${user.accessToken || user.token}` }
          : {})
      };

      const payload = { uploadId: uploadData.uploadId, ...formData };
      const res = await fetch(`${API_BASE}/api/guides/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        let message = `Failed to generate guide (HTTP ${res.status})`;
        try {
          const j = await res.json();
          message = j.error || message;
        } catch {
          const t = await res.text(); if (t) message = t;
        }
        throw new Error(message);
      }

      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const data = await res.json();
        if (!data?.guideContent) throw new Error('No guide content returned.');
        openHtmlInNewTab(data.guideContent, preWin);
      } else {
        const html = await res.text();
        if (!html || html.length < 50) throw new Error('Empty guide response.');
        openHtmlInNewTab(html, preWin);
      }

      toast.success('Guide generated. Opening now!');

      // Optimistic usage increment
      if (usage?.limit != null) {
        setUsage((u) => ({ ...u, used: (u?.used || 0) + 1 }));
      }
    } catch (err) {
      try { preWin?.close(); } catch {}
      console.error('Guide generation error:', err);
      toast.error(`Failed to generate: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // ====== RENDER ======
  const renewText = usage?.renewsAt
    ? new Date(usage.renewsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #2dd4bf 0%, #06b6d4 50%, #1d4ed8 100%)',
      paddingTop: 80,
      paddingBottom: '2rem'
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1rem' }}>
        <div style={{
          background: 'white',
          borderRadius: '1.5rem',
          boxShadow: '0 25px 80px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
            padding: '1.1rem 1.5rem',
            borderBottom: '1px solid #e5e7eb'
          }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Dashboard
            </h1>
            <p style={{ color: '#475569', margin: '6px 0 0' }}>
              Upload sides, fill role details, and generate your Prep101 guide.
            </p>
          </div>

          {/* Usage strip */}
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
            {usageLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <LoadingSpinner /><span style={{ color: '#6b7280' }}>Loading plan…</span>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <div style={{ fontWeight: 800, color: '#0f172a' }}>
                    Plan: {nicePlan(usage?.plan)}
                    {usageError && <span style={{ color: '#f59e0b', marginLeft: 8 }}>(demo)</span>}
                  </div>
                  <div style={{ color: '#475569', fontWeight: 700 }}>
                    {usage?.limit == null ? 'Unlimited' : `${usage.used || 0} / ${usage.limit} used`}
                  </div>
                </div>
                {usage?.limit != null && (
                  <>
                    <ProgressBar value={usage.used || 0} max={usage.limit} />
                    <div style={{ color: '#64748b', marginTop: 6, fontSize: 13 }}>
                      {remaining} remaining • {renewText ? `renews ${renewText}` : 'monthly'}
                    </div>
                  </>
                )}
                {!canGenerate && (
                  <div style={{
                    marginTop: 10,
                    background: '#fffbeb',
                    border: '1px solid #f59e0b',
                    borderRadius: 10,
                    color: '#92400e',
                    padding: '8px 10px'
                  }}>
                    You’ve hit your monthly limit. Upgrade on the Pricing page for more guides.
                    <button
                      onClick={() => (window.location.href = '/pricing')}
                      style={{
                        marginLeft: 10,
                        background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
                        color: 'white',
                        padding: '6px 10px',
                        border: 'none',
                        borderRadius: 8,
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      See Plans
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Body */}
          <div style={{ padding: '1.5rem' }}>
            {isGenerating ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <LoadingSpinner />
                <p style={{ marginTop: '1rem', color: '#6b7280' }}>
                  Crafting your guide… this usually takes under a minute.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                <FileUpload onUpload={handleFileUpload} />

                {uploadData && (
                  <div style={{
                    padding: 12,
                    background: '#f0fdfa',
                    borderRadius: 10,
                    border: '1px solid #2dd4bf',
                    color: '#065f46'
                  }}>
                    ✅ Script ready: <strong>{uploadData.filename}</strong>{' '}
                    <span style={{ color: '#047857' }}>
                      ({uploadData.textLength || 0} chars extracted)
                    </span>
                  </div>
                )}

                {lastGuideUrl && (
                  <div style={{
                    padding: 12,
                    background: '#fffbeb',
                    borderRadius: 10,
                    border: '1px solid #f59e0b',
                    color: '#92400e'
                  }}>
                    Couldn’t open automatically?{' '}
                    <a href={lastGuideUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700 }}>
                      Open last guide
                    </a>
                  </div>
                )}

                <GuideForm
                  onSubmit={handleGenerateGuide}
                  hasFile={!!uploadData}
                  isSubmitting={isGenerating || usageLoading}
                  disabled={!canGenerate}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;