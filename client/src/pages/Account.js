import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';

const Account = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleCreateGuide = () => {
    navigate('/dashboard');
  };

  // Mock data - in production this would come from your API
  const mockGuides = [
    {
      id: 1,
      title: "Hamlet - To Be or Not To Be",
      character: "Hamlet",
      production: "Hamlet",
      createdAt: "2024-01-15",
      status: "completed"
    },
    {
      id: 2,
      title: "Romeo & Juliet - Balcony Scene",
      character: "Romeo",
      production: "Romeo & Juliet",
      createdAt: "2024-01-10",
      status: "completed"
    }
  ];

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
            <h2 style={{ fontSize: '1.6rem', fontWeight: 900, marginBottom: '1rem', color: '#0f172a' }}>
              Recent Guides
            </h2>
            {mockGuides.length > 0 ? (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {mockGuides.map((guide) => (
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
                        {guide.title}
                      </h3>
                      <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                        {guide.character} • {guide.production} • {guide.createdAt}
                      </p>
                    </div>
                    <span style={{
                      background: '#10b981',
                      color: 'white',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '999px',
                      fontSize: '0.8rem',
                      fontWeight: '600'
                    }}>
                      {guide.status}
                    </span>
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
    </>
  );
};

export default Account;
