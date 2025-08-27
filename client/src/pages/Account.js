import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import API_BASE from '../config/api';

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
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        paddingTop: '80px',
        paddingBottom: '2rem'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem' }}>
          
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ marginBottom: '1.25rem' }}>
              <img
                src="/preplogo.png"
                alt="Prep101 Logo"
                style={{ height: 64, width: 'auto', objectFit: 'contain', margin: '0 auto' }}
              />
            </div>
            <h1 style={{ fontSize: '3.2rem', fontWeight: 900, marginBottom: '0.5rem', color: '#0f172a' }}>
              Your Account
            </h1>
            <p style={{ fontSize: '1.1rem', color: '#475569', maxWidth: 600, margin: '0 auto' }}>
              Welcome back, {user?.name}! Manage your guides and subscription.
            </p>
          </div>

          {/* Account Info */}
          <div style={{
            background: 'white',
            borderRadius: '1.25rem',
            padding: '2rem',
            boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
            border: '1px solid #e2e8f0',
            marginBottom: '2rem'
          }}>
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
                <strong style={{ color: '#374151' }}>Plan:</strong>
                <p style={{ color: '#6b7280', margin: '0.5rem 0' }}>{user?.subscription} plan</p>
              </div>
              <div>
                <strong style={{ color: '#374151' }}>Guides Used:</strong>
                <p style={{ color: '#6b7280', margin: '0.5rem 0' }}>{user?.guidesUsed} / {user?.guidesLimit}</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '2rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleCreateGuide}
              style={{
                background: 'linear-gradient(135deg, #2dd4bf 0%, #06b6d4 100%)',
                color: 'white',
                padding: '1rem 2rem',
                border: 'none',
                borderRadius: '1rem',
                fontWeight: '800',
                fontSize: '1.1rem',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              Create New Guide
            </button>
            
            <button
              onClick={() => navigate('/pricing')}
              style={{
                background: 'white',
                color: '#0ea5e9',
                padding: '1rem 2rem',
                border: '2px solid #0ea5e9',
                borderRadius: '1rem',
                fontWeight: '800',
                fontSize: '1.1rem',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = '#0ea5e9'; e.currentTarget.style.color = 'white'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#0ea5e9'; }}
            >
              Manage Plan
            </button>
          </div>

          {/* Recent Guides */}
          <div style={{
            background: 'white',
            borderRadius: '1.25rem',
            padding: '2rem',
            boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
            border: '1px solid #e2e8f0',
            marginBottom: '2rem'
          }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: '900', marginBottom: '1rem', color: '#0f172a' }}>
              Your Guides ({guides.length})
            </h2>
            
            {guidesLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  border: '3px solid #e5e7eb',
                  borderTop: '3px solid #0ea5e9',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 1rem'
                }} />
                <p>Loading your guides...</p>
              </div>
            ) : guidesError ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#ef4444' }}>
                <p>Error loading guides: {guidesError}</p>
                <button
                  onClick={() => window.location.reload()}
                  style={{
                    background: '#0ea5e9',
                    color: 'white',
                    padding: '0.75rem 1.5rem',
                    border: 'none',
                    borderRadius: '0.75rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    marginTop: '1rem'
                  }}
                >
                  Try Again
                </button>
              </div>
            ) : guides.length > 0 ? (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {guides.map((guide) => (
                  <div key={guide.id} style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.75rem',
                    padding: '1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.25rem', color: '#111827' }}>
                        {guide.characterName} - {guide.productionTitle}
                      </h3>
                      <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                        {guide.productionType} • {guide.genre} • {new Date(guide.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{
                        background: '#10b981',
                        color: 'white',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '999px',
                        fontSize: '0.8rem',
                        fontWeight: '600'
                      }}>
                        {guide.roleSize}
                      </span>
                      <button
                        onClick={() => {
                          // Open guide in new tab
                          const guideUrl = `${API_BASE}/api/guides/${guide.id}`;
                          window.open(guideUrl, '_blank', 'noopener,noreferrer');
                        }}
                        style={{
                          background: '#0ea5e9',
                          color: 'white',
                          padding: '0.5rem 1rem',
                          border: 'none',
                          borderRadius: '0.5rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          fontSize: '0.8rem'
                        }}
                      >
                        View
                      </button>
                      <button
                        onClick={() => {
                          // Download PDF
                          const pdfUrl = `${API_BASE}/api/guides/${guide.id}/pdf`;
                          const link = document.createElement('a');
                          link.href = pdfUrl;
                          link.download = `guide_${guide.characterName}_${guide.productionTitle}.pdf`;
                          link.style.display = 'none';
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        style={{
                          background: '#dc2626',
                          color: 'white',
                          padding: '0.5rem 1rem',
                          border: 'none',
                          borderRadius: '0.5rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          fontSize: '0.8rem'
                        }}
                      >
                        📄 PDF
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const response = await fetch(`${API_BASE}/api/guides/${guide.id}/email`, {
                              method: 'POST',
                              headers: {
                                'Authorization': `Bearer ${user?.accessToken || user?.token}`,
                                'Content-Type': 'application/json'
                              }
                            });
                            
                            if (response.ok) {
                              const result = await response.json();
                              alert(`✅ Guide sent to ${result.email} successfully!`);
                            } else {
                              const error = await response.json();
                              alert(`❌ Failed to send email: ${error.error}`);
                            }
                          } catch (err) {
                            alert(`❌ Error sending email: ${err.message}`);
                          }
                        }}
                        style={{
                          background: '#7c3aed',
                          color: 'white',
                          padding: '0.5rem 1rem',
                          border: 'none',
                          borderRadius: '0.5rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          fontSize: '0.8rem'
                        }}
                      >
                        📧 Email
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                <p>No guides created yet.</p>
                <button
                  onClick={handleCreateGuide}
                  style={{
                    background: '#0ea5e9',
                    color: 'white',
                    padding: '0.75rem 1.5rem',
                    border: 'none',
                    borderRadius: '0.75rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    marginTop: '1rem'
                  }}
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
              style={{
                background: 'transparent',
                color: '#ef4444',
                padding: '0.75rem 1.5rem',
                border: '1px solid #ef4444',
                borderRadius: '0.75rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = 'white'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ef4444'; }}
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
