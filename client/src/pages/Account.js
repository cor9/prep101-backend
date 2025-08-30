import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import API_BASE from '../config/api';
import '../styles/shared.css';

const Account = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [guides, setGuides] = useState([]);
  const [guidesLoading, setGuidesLoading] = useState(false);
  const [guidesError, setGuidesError] = useState(null);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleCreateGuide = () => {
    navigate('/dashboard');
  };

  // Fetch user's guides from API
  useEffect(() => {
    if (!user?.accessToken && !user?.token) return;

    const fetchGuides = async () => {
      setGuidesLoading(true);
      setGuidesError(null);
      
      try {
        const headers = {
          Authorization: `Bearer ${user.accessToken || user.token}`
        };

        const res = await fetch(`${API_BASE}/api/guides`, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        if (json.success) {
          setGuides(json.guides || []);
        } else {
          setGuidesError(json.error || 'Failed to fetch guides');
        }
      } catch (err) {
        console.error('Failed to fetch guides:', err);
        setGuidesError(err.message);
      } finally {
        setGuidesLoading(false);
      }
    };

    fetchGuides();
  }, [user]);

  return (
    <>
      <Navbar />
      <div className="page-dark">
        <div className="container-wide">
          
          {/* Header */}
          <div className="page-hero">
            <img
              src="/preplogo.png"
              alt="Prep101 Logo"
              className="logo-hero"
            />
            <h1 className="h1-hero">Your Account</h1>
            <p className="h2-hero">
              Welcome back, {user?.name}! Manage your guides and subscription.
            </p>
          </div>

          {/* Account Info */}
          <div className="card-white">
            <h2 style={{ fontSize: '1.6rem', fontWeight: 900, marginBottom: '1rem', color: '#0f172a' }}>
              Account Information
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
              <div>
                <strong style={{ color: '#374151' }}>Name:</strong>
                <p style={{ color: '#6b7280', margin: '0.5rem 0' }}>{user?.name}</p>
              </div>
              <div>
                <strong style={{ color: '#374151' }}>Email:</strong>
                <p style={{ color: '#6b7280', margin: '0.5rem 0' }}>{user?.email}</p>
              </div>
              <div>
                <strong style={{ color: '#374151' }}>Subscription:</strong>
                <p style={{ color: '#6b7280', margin: '0.5rem 0' }}>
                  {user?.subscription ? user.subscription.charAt(0).toUpperCase() + user.subscription.slice(1) : 'Free'}
                </p>
              </div>
              <div>
                <strong style={{ color: '#374151' }}>Member Since:</strong>
                <p style={{ color: '#6b7280', margin: '0.5rem 0' }}>
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Guides Section */}
          <div className="card-white">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                Your Guides ({guides.length})
              </h2>
              <button
                onClick={handleCreateGuide}
                className="btn btnPrimary"
              >
                + Create New Guide
              </button>
            </div>

            {guidesLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  border: '4px solid #e5e7eb',
                  borderTop: '4px solid var(--gold)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 1rem'
                }}></div>
                <p style={{ color: '#6b7280' }}>Loading your guides...</p>
              </div>
            ) : guidesError ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#ef4444' }}>
                <p>Error: {guidesError}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="btn btnSecondary"
                  style={{ marginTop: '1rem' }}
                >
                  Try Again
                </button>
              </div>
            ) : guides.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {guides.map((guide) => (
                  <div
                    key={guide.id}
                    style={{
                      background: '#f8fafc',
                      borderRadius: '0.75rem',
                      padding: '1.25rem',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '1rem'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', margin: '0 0 0.5rem 0' }}>
                        {guide.characterName} - {guide.productionTitle}
                      </h3>
                      <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                        {guide.productionType} • {guide.genre} • {new Date(guide.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => {
                          // Open guide in new tab
                          const guideUrl = `${API_BASE}/api/guides/${guide.id}`;
                          window.open(guideUrl, '_blank', 'noopener,noreferrer');
                        }}
                        className="btn btnPrimary"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                      >
                        📖 View Guide
                      </button>
                      {guide.childGuideRequested && guide.childGuideCompleted && (
                        <button
                          onClick={async () => {
                            try {
                              const response = await fetch(`${API_BASE}/api/guides/${guide.id}/child-guide`, {
                                headers: {
                                  Authorization: `Bearer ${user.accessToken || user.token}`
                                }
                              });
                              
                              if (response.ok) {
                                const htmlContent = await response.text();
                                
                                // Create a blob and download the child guide
                                const blob = new Blob([htmlContent], { type: 'text/html' });
                                const url = window.URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = `child_guide_${guide.characterName}_${guide.productionTitle}.html`;
                                link.style.display = 'none';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                window.URL.revokeObjectURL(url);
                                
                                alert('✅ Child guide downloaded successfully! Check your downloads folder.');
                              } else {
                                const error = await response.json();
                                alert(`❌ Failed to load child guide: ${error.message}`);
                              }
                            } catch (err) {
                              alert(`❌ Error loading child guide: ${err.message}`);
                            }
                          }}
                          style={{
                            background: 'var(--gold-grad)',
                            color: '#2f2500',
                            padding: '0.5rem 1rem',
                            fontSize: '0.875rem',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(255,200,58,.3)'
                          }}
                        >
                          🌟 Child's Guide
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                <p>No guides created yet.</p>
                <button
                  onClick={handleCreateGuide}
                  className="btn btnPrimary"
                  style={{ marginTop: '1rem' }}
                >
                  Create Your First Guide
                </button>
              </div>
            )}
          </div>

          {/* Logout */}
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={handleLogout}
              className="btn btnGhost"
              style={{ color: '#ef4444', borderColor: '#ef4444' }}
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
      
      {/* CSS for loading animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export default Account;
