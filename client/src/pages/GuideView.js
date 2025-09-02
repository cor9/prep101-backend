import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import API_BASE from '../config/api';
import '../styles/shared.css';
import '../styles/guide.css';

const GuideView = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchGuide = async () => {
      if (!user?.accessToken && !user?.token) {
        setError('Authentication required');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/guides/${id}`, {
          headers: {
            'Authorization': `Bearer ${user.accessToken || user.token}`
          }
        });

        if (!response.ok) {
          if (response.status === 401) {
            setError('Authentication failed. Please log in again.');
          } else if (response.status === 404) {
            setError('Guide not found');
          } else {
            setError(`Failed to load guide (HTTP ${response.status})`);
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        setGuide(data.guide);
      } catch (err) {
        console.error('Error fetching guide:', err);
        setError('Failed to load guide');
      } finally {
        setLoading(false);
      }
    };

    fetchGuide();
  }, [id, user]);

  const handleBack = () => {
    navigate('/account');
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="page-dark">
          <div className="container">
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Loading guide...</div>
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
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#ef4444' }}>Error</div>
              <div style={{ marginBottom: '2rem' }}>{error}</div>
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
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Guide not found</div>
              <button onClick={handleBack} className="btn btnPrimary">
                Back to Account
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="page-dark">
        <div className="container">
          <div style={{ padding: '2rem 0', maxWidth: '1400px', margin: '0 auto' }}>
            <button onClick={handleBack} className="btn btnSecondary" style={{ marginBottom: '2rem' }}>
              ← Back to Account
            </button>
            
            <div style={{ 
              background: '#1f2937', 
              borderRadius: '0.75rem', 
              padding: '2.5rem',
              marginBottom: '2rem',
              border: '1px solid #374151'
            }}>
              <h1 style={{ 
                fontSize: '2.5rem', 
                marginBottom: '1rem', 
                color: '#fbbf24',
                fontWeight: 'bold',
                lineHeight: '1.2'
              }}>
                {guide.characterName}
              </h1>
              <div style={{ 
                fontSize: '1.25rem', 
                marginBottom: '0.5rem',
                color: '#f3f4f6',
                fontWeight: '500'
              }}>
                {guide.productionTitle}
              </div>
              <div style={{ 
                color: '#9ca3af', 
                marginBottom: '0',
                fontSize: '1rem'
              }}>
                {guide.productionType} • {guide.roleSize} • {guide.genre}
              </div>
            </div>

            <div 
              dangerouslySetInnerHTML={{ __html: guide.generatedHtml }}
              style={{ 
                background: '#1f2937', 
                borderRadius: '0.75rem', 
                padding: '2.5rem',
                color: '#f3f4f6',
                lineHeight: '1.7',
                fontSize: '1rem',
                border: '1px solid #374151'
              }}
              className="guide-content"
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default GuideView;
