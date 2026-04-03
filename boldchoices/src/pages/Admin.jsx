import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import API_BASE from '../config/api.js';
import Navbar from '../components/Navbar.jsx';

const S = {
  container: {
    minHeight: '100vh',
    background: '#0a0a0f',
    color: '#F0EEF5',
    fontFamily: '"DM Sans", sans-serif',
  },
  content: {
    padding: '40px 24px',
    maxWidth: 900,
    margin: '0 auto',
  },
  header: {
    fontFamily: 'Fraunces, serif',
    fontSize: '2rem',
    fontWeight: 900,
    color: '#F5A623',
    marginBottom: 8,
  },
  subheader: {
    color: 'rgba(240,238,245,0.5)',
    fontSize: 14,
    marginBottom: 40,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 20,
    marginBottom: 40,
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '24px',
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'rgba(240,238,245,0.4)',
    marginBottom: 8,
  },
  cardValue: {
    fontFamily: 'Fraunces, serif',
    fontSize: '2.5rem',
    fontWeight: 900,
    color: '#F0EEF5',
    lineHeight: 1,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: 20,
  },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.05em',
    color: 'rgba(240,238,245,0.4)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  td: {
    padding: '16px',
    fontSize: 14,
    color: 'rgba(240,238,245,0.8)',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  badge: {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    background: 'rgba(0, 212, 200, 0.1)',
    color: '#00D4C8',
  }
};

export default function Admin() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Basic owner access check on client before fetching
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.email !== 'corey@childactor101.com') {
      navigate('/');
      return;
    }

    const fetchStats = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/bold-choices/admin/dashboard`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Failed to fetch dashboard');
        
        setStats(data.stats);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchStats();
  }, [user, navigate, token]);

  if (loading) return <div style={{...S.container, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>Loading Admin...</div>;
  
  if (error) return (
    <div style={S.container}>
      <Navbar />
      <div style={S.content}>
        <h1 style={S.header}>Access Denied</h1>
        <p style={{color: '#FF4D4D'}}>{error}</p>
      </div>
    </div>
  );

  return (
    <div style={S.container}>
      <Navbar />
      <div style={S.content}>
        <h1 style={S.header}>Mission Control</h1>
        <div style={S.subheader}>BoldChoices MVP Telemetry</div>

        <div style={S.grid}>
          <div style={S.card}>
            <div style={S.cardTitle}>Total Events</div>
            <div style={S.cardValue}>{stats.totalEvents}</div>
          </div>
          <div style={S.card}>
            <div style={S.cardTitle}>Unique Users</div>
            <div style={S.cardValue}>{stats.uniqueUsers}</div>
          </div>
          <div style={S.card}>
            <div style={S.cardTitle}>Spins / Wilders</div>
            <div style={{...S.cardValue, color: '#FF4D4D'}}>{stats.spins} <span style={{color: 'rgba(255,255,255,0.2)'}}>/</span> {stats.wilders}</div>
          </div>
          <div style={S.card}>
            <div style={S.cardTitle}>Paywall Clicks</div>
            <div style={{...S.cardValue, color: '#9B6DFF'}}>{stats.upgrades}</div>
          </div>
        </div>

        <div style={{...S.card, padding: '32px'}}>
          <h2 style={{...S.header, fontSize: '1.5rem', color: '#F0EEF5', marginBottom: 16}}>Recent Generations</h2>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Time</th>
                  <th style={S.th}>User ID</th>
                  <th style={S.th}>Character</th>
                  <th style={S.th}>Gen ID</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentGenerations.map((gen, i) => (
                  <tr key={i}>
                    <td style={S.td}>{new Date(gen.createdAt).toLocaleString()}</td>
                    <td style={{...S.td, fontSize: 12, opacity: 0.6}}>{gen.userId.substring(0,8)}...</td>
                    <td style={S.td}>
                      <span style={S.badge}>{gen.character}</span>
                    </td>
                    <td style={{...S.td, fontSize: 12, opacity: 0.6}}>{gen.id.substring(0,8)}</td>
                  </tr>
                ))}
                {stats.recentGenerations.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{...S.td, textAlign: 'center', opacity: 0.5}}>No recent generations</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
