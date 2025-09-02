import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import FileUpload from '../components/FileUpload';
import GuideForm from '../components/GuideForm';
import LoadingSpinner from '../components/LoadingSpinner';

import API_BASE from '../config/api';
import '../styles/shared.css';
import Navbar from '../components/Navbar';

// Simple progress bar
const ProgressBar = ({ value, max }) => {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  return (
    <div style={{ width: '100%', height: 10, background: '#e5e7eb', borderRadius: 999 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--gold)', borderRadius: 999 }} />
    </div>
  );
};

const nicePlan = (p) => {
  switch ((p || '').toLowerCase()) {
    case 'free': return 'Free';
    case 'basic': return 'Basic';
    case 'premium': return 'Premium';
    case 'starter': return 'Starter';
    case 'alacarte': return 'A la carte';
    case 'unlimited': return 'Unlimited';
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
        console.log('🔍 Dashboard API response:', json);
        if (!cancelled) {
          // Transform the complex backend response to the simple format expected by the UI
          const transformedUsage = {
            plan: json.user?.subscription || json.subscription?.currentPlan?.name,
            used: json.user?.guidesUsed || 0,
            limit: json.user?.guidesLimit || 1,
            renewsAt: json.subscription?.renewsAt || new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
          };
          console.log('🔍 Transformed usage data:', transformedUsage);
          setUsage(transformedUsage);
        }
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
  const openHtmlInNewTab = (htmlString, customTitle) => {
    const blob = new Blob([htmlString], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    setLastGuideUrl(url);
    // If customTitle is provided, it's a string for the window name
    if (typeof customTitle === 'string') {
      const w = window.open(url, customTitle, 'noopener,noreferrer');
      if (!w) toast('Popup blocked. Use the "Open last guide" link below.', { icon: '⚠️' });
    } else {
      const w = window.open(url, '_blank', 'noopener,noreferrer');
      if (!w) toast('Popup blocked. Use the "Open last guide" link below.', { icon: '⚠️' });
    }
  };

  // ====== GENERATE GUIDE ======
  const handleGenerateGuide = async (formData) => {
    if (!uploadData?.uploadId && !uploadData?.uploadIds) {
      toast.error('Please upload your sides (PDF) before generating.');
      return;
    }
    if (!canGenerate) {
      toast.error('You\'ve hit your guide limit. Upgrade for more this month.');
      return;
    }

    setIsGenerating(true);
    setLastGuideUrl(null);

    // Add timeout to prevent infinite hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes timeout

    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(user?.accessToken || user?.token
          ? { Authorization: `Bearer ${user.accessToken || user.token}` }
          : {})
      };

      const payload = { 
        uploadId: uploadData.uploadId || uploadData.uploadIds?.[0],
        uploadIds: uploadData.uploadIds || [uploadData.uploadId],
        ...formData 
      };

      console.log('🚀 Starting guide generation for:', formData.characterName);
      toast.loading('Generating your guide... this may take 2-5 minutes.');

      const res = await fetch(`${API_BASE}/api/guides/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        let message = `Failed to generate guide (HTTP ${res.status})`;
        try {
          const j = await res.json();
          message = j.error || message;
        } catch {
          const t = await res.text(); 
          if (t) message = t;
        }
        throw new Error(message);
      }

      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const data = await res.json();
        console.log('🎭 Guide generation response:', data);
        
        if (!data?.guideContent) throw new Error('No guide content returned.');
        
        // Open parent guide
        openHtmlInNewTab(data.guideContent);
        
        // If child guide was requested and completed, show both guides
        if (data.childGuideRequested && data.childGuideCompleted && data.childGuideContent) {
          console.log('🌟 Opening child guide in 1 second...');
          setTimeout(() => {
            openHtmlInNewTab(data.childGuideContent, 'Child Guide');
          }, 1000);
        }
      } else {
        const html = await res.text();
        if (!html || html.length < 50) throw new Error('Empty guide response.');
        openHtmlInNewTab(html);
      }

      toast.success('Guide generated successfully! Opening now...');

      // Optimistic usage increment
      if (usage?.limit != null) {
        setUsage((u) => ({ ...u, used: (u?.used || 0) + 1 }));
      }

    } catch (err) {
      console.error('Guide generation error:', err);
      
      if (err.name === 'AbortError') {
        toast.error('Guide generation timed out after 5 minutes. Please try again.');
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
    ? new Date(usage.renewsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

  return (
    <>
      <Navbar />
      <div className="page-dark">
        <div className="container-wide">
          {/* Header */}
          <div className="page-hero">
            <img src="/preplogo.png" alt="Prep101 logo" className="logo-hero" loading="lazy" />
            <h1 className="h1-hero">Dashboard</h1>
            <p className="h2-hero">Upload sides, fill role details, and generate your Prep101 guide.</p>
          </div>

          {/* Usage strip */}
          <div className="card-white">
            {usageLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <LoadingSpinner /><span style={{ color: '#6b7280' }}>Loading plan…</span>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <div style={{ fontWeight: 800, color: '#0f172a' }}>
                    Plan: {nicePlan(usage?.plan || user?.subscription)}
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
                    You've hit your monthly limit. Upgrade on the Pricing page for more guides.
                    <button
                      onClick={() => (window.location.href = '/pricing')}
                      className="btn btnPrimary"
                      style={{ marginLeft: 10, padding: '6px 10px', fontSize: '0.875rem' }}
                    >
                      See Plans
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Body */}
          <div className="card-white">
            {isGenerating ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <LoadingSpinner />
                <p style={{ marginTop: '1rem', color: '#6b7280' }}>
                  Crafting your guide… this usually takes 2-5 minutes.
                </p>
                <p style={{ marginTop: '0.5rem', color: '#9ca3af', fontSize: '0.875rem' }}>
                  Please don't close this page while we generate your guide.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                <FileUpload onUpload={handleFileUpload} />

                {uploadData && (
                  <div style={{
                    padding: 16,
                    background: '#f0fdfa',
                    borderRadius: 12,
                    border: '1px solid #2dd4bf',
                    color: '#065f46'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span>✅</span>
                      <strong>PDF uploaded successfully!</strong>
                    </div>
                    <div style={{ fontSize: '0.875rem' }}>
                      {uploadData.uploadIds ? 
                        `${uploadData.uploadIds.length} file(s) ready for guide generation` :
                        'File ready for guide generation'
                      }
                    </div>
                  </div>
                )}

                {uploadData && (
                  <div>
                    <h3 style={{ 
                      fontSize: '1.5rem', 
                      fontWeight: 'bold', 
                      color: '#374151',
                      marginBottom: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      🎭 Guide Details
                    </h3>
                    <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
                      Fill in the details below to generate your personalized audition guide.
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
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                    <p>Upload your audition sides (PDF) to get started.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
