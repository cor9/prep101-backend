import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import FileUpload from '../components/FileUpload';
import GuideForm from '../components/GuideForm';
import LoadingSpinner from '../components/LoadingSpinner';

import API_BASE from '../config/api';
import '../styles/shared.css';

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
  const [guides, setGuides] = useState([]);


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

  // ====== GUIDES FETCH ======
  useEffect(() => {
    if (!user?.accessToken && !user?.token) return;

    let cancelled = false;

    const fetchGuides = async () => {
      try {
        const headers = {
          Authorization: `Bearer ${user.accessToken || user.token}`
        };

        const res = await fetch(`${API_BASE}/api/guides`, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        if (!cancelled && json.success) {
          setGuides(json.guides || []);
        }
      } catch (err) {
        console.error('Failed to fetch guides:', err);
        if (!cancelled) setGuides([]);
      }
    };

    fetchGuides();
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
      if (!w) toast('Popup blocked. Use the “Open last guide” link below.', { icon: '⚠️' });
    }
  };

  // ====== GENERATE GUIDE ======
  const handleGenerateGuide = async (formData) => {
    if (!uploadData?.uploadId && !uploadData?.uploadIds) {
      toast.error('Please upload your sides (PDF) before generating.');
      return;
    }
    if (!canGenerate) {
      toast.error('You’ve hit your guide limit. Upgrade for more this month.');
      // Optional: window.location.href = '/pricing';
      return;
    }

    try {
      setIsGenerating(true);
      setLastGuideUrl(null);

      const headers = {
        'Content-Type': 'application/json',
        ...(user?.accessToken || user?.token
          ? { Authorization: `Bearer ${user.accessToken || user.token}` }
          : {})
      };

      const payload = { 
        uploadId: uploadData.uploadId || uploadData.uploadIds?.[0], // For backward compatibility
        uploadIds: uploadData.uploadIds || [uploadData.uploadId], // New multiple file support
        ...formData 
      };
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
        console.log('🎭 Guide generation response:', data);
        console.log('🌟 Child guide details:', {
          requested: data.childGuideRequested,
          completed: data.childGuideCompleted,
          hasContent: !!data.childGuideContent,
          contentLength: data.childGuideContent ? data.childGuideContent.length : 0
        });
        
        if (!data?.guideContent) throw new Error('No guide content returned.');
        
        // Open parent guide
        openHtmlInNewTab(data.guideContent);
        
        // If child guide was requested and completed, show both guides
        if (data.childGuideRequested && data.childGuideCompleted && data.childGuideContent) {
          console.log('🌟 Opening child guide in 1 second...');
          setTimeout(() => {
            openHtmlInNewTab(data.childGuideContent, 'Child Guide');
          }, 1000); // Small delay to avoid overwhelming the user
        } else {
          console.log('❌ Child guide not shown because:', {
            requested: data.childGuideRequested,
            completed: data.childGuideCompleted,
            hasContent: !!data.childGuideContent
          });
        }
      } else {
        const html = await res.text();
        if (!html || html.length < 50) throw new Error('Empty guide response.');
        openHtmlInNewTab(html);
      }

      toast.success('Guide generated. Opening now!');

      // Optimistic usage increment
      if (usage?.limit != null) {
        setUsage((u) => ({ ...u, used: (u?.used || 0) + 1 }));
      }

      // Refresh guides list
      if (user?.accessToken || user?.token) {
        const headers = { Authorization: `Bearer ${user.accessToken || user.token}` };
        try {
          const guidesRes = await fetch(`${API_BASE}/api/guides`, { headers });
          if (guidesRes.ok) {
            const guidesData = await guidesRes.json();
            if (guidesData.success) {
              setGuides(guidesData.guides || []);
            }
          }
        } catch (err) {
          console.error('Failed to refresh guides:', err);
        }
      }
          } catch (err) {
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
                  Crafting your guide… this usually takes 2-5 minutes.
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
                      <span style={{ fontSize: '1.2rem' }}>✅</span>
                      <span style={{ fontWeight: 'bold' }}>
                        {uploadData.fileCount > 1 ? `${uploadData.fileCount} PDFs` : 'PDF'} ready for guide generation
                      </span>
                    </div>
                    <div style={{ color: '#047857', fontSize: '0.9rem' }}>
                      {uploadData.fileCount > 1 ? (
                        <>
                          <strong>{uploadData.filenames.join(', ')}</strong>
                          <br />
                          Combined: {uploadData.textLength || 0} characters, {uploadData.wordCount || 0} words
                        </>
                      ) : (
                        <>
                          <strong>{uploadData.filename}</strong> ({uploadData.textLength || 0} chars extracted)
                        </>
                      )}
                    </div>
                  </div>
                )}

                {lastGuideUrl && (
                  <div style={{
                    padding: 20,
                    background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                    borderRadius: 15,
                    border: '2px solid #22c55e',
                    color: '#166534',
                    textAlign: 'center',
                    marginBottom: '1rem'
                  }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: 'bold' }}>
                      🎉 Guide Generated Successfully!
                    </h3>
                    <p style={{ margin: '0 0 1.5rem 0', fontSize: '1rem' }}>
                      Your personalized audition guide is ready and should have opened in a new tab.
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <a 
                        href={lastGuideUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        style={{
                          background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                          color: 'white',
                          padding: '12px 24px',
                          borderRadius: 10,
                          textDecoration: 'none',
                          fontWeight: 'bold',
                          display: 'inline-block'
                        }}
                      >
                        📖 Open Guide
                      </a>
                      <button
                        onClick={() => {
                          setLastGuideUrl(null);
                          setUploadData(null);
                        }}
                        style={{
                          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                          color: 'white',
                          padding: '12px 24px',
                          borderRadius: 10,
                          border: 'none',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        🆕 Create New Guide
                      </button>
                      <button
                        onClick={() => window.location.href = '/account'}
                        style={{
                          background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                          color: 'white',
                          padding: '12px 24px',
                          borderRadius: 10,
                          border: 'none',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        👤 View Account
                      </button>
                    </div>
                                    </div>
                )}

                {/* Guide History */}
                {guides.length > 0 && (
                  <div style={{
                    background: '#f8fafc',
                    borderRadius: 15,
                    padding: '1.5rem',
                    border: '1px solid #e2e8f0'
                  }}>
                    <h3 style={{ 
                      fontSize: '1.25rem', 
                      fontWeight: 'bold', 
                      color: '#1e293b',
                      margin: '0 0 1rem 0'
                    }}>
                      📚 Your Guide History
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {guides.slice(0, 5).map((guide) => (
                        <div key={guide.id} style={{
                          background: 'white',
                          padding: '1rem',
                          borderRadius: 10,
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div>
                            <div style={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
                              {guide.characterName} - {guide.productionTitle}
                            </div>
                            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                              {guide.productionType} • {guide.genre} • {new Date(guide.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              // Open guide in new tab
                              const guideUrl = `${API_BASE}/api/guides/${guide.id}`;
                              window.open(guideUrl, '_blank', 'noopener,noreferrer');
                            }}
                            style={{
                              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                              color: 'white',
                              padding: '8px 16px',
                              borderRadius: 8,
                              border: 'none',
                              fontWeight: '600',
                              cursor: 'pointer',
                              fontSize: '0.875rem'
                            }}
                          >
                            View
                          </button>
                        </div>
                      ))}
                    </div>
                    {guides.length > 5 && (
                      <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                        <button
                          onClick={() => window.location.href = '/account'}
                          style={{
                            background: 'transparent',
                            color: '#3b82f6',
                            border: '1px solid #3b82f6',
                            padding: '8px 16px',
                            borderRadius: 8,
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          View All {guides.length} Guides
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {!lastGuideUrl && (
                  <GuideForm
                    onSubmit={handleGenerateGuide}
                    hasFile={!!uploadData}
                    isSubmitting={isGenerating || usageLoading}
                    disabled={!canGenerate}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;