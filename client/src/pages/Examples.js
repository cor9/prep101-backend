import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';

const Examples = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // === EXACT ORDER (Top → Bottom, Left → Right) ===
  const tiles = [
    // Row 1
    {
      heading: 'MultiCam Sitcom',
      sub: 'Disney Series Guest Star',
      href: 'https://claude.ai/public/artifacts/77401c18-46dc-47d3-b4f6-427bd0a22cb0'
    },
    {
      heading: 'TV Teen Drama',
      sub: 'Series Regular Role',
      href: 'https://claude.ai/public/artifacts/b76be214-e69d-499a-b7ea-e8af412b682e'
    },
    // Row 2
    {
      heading: 'Thriller/Horror',
      sub: 'Lead Role',
      href: 'https://pzixzsjbbswpba9zyakuna.on.drv.tw/prep101/carrieweb.html'
    },
    {
      heading: 'Drama Film',
      sub: 'Leading Role',
      href: 'https://claude.ai/public/artifacts/8483c054-0f47-4149-929c-a4d098934afa'
    },
    // Row 3
    {
      heading: 'Single-Cam Sitcom',
      sub: 'Disney Series Regular',
      href: 'https://claude.ai/public/artifacts/96f3dd5f-395f-42e9-9e5b-52eee8d41a26'
    },
    {
      heading: 'TV Medical Drama',
      sub: 'Co-Star Role',
      href: 'https://claude.ai/public/artifacts/1891f784-862b-4191-8e7a-a2c5c1f82443'
    },
    // Row 4
    {
      heading: 'Comedy Film',
      sub: 'Supporting Role',
      href: 'https://claude.ai/public/artifacts/233bb61a-6519-446e-8137-5e3ecec11610'
    },
    {
      heading: 'Daytime Soap',
      sub: 'Recurring Day Player',
      href: 'https://claude.ai/public/artifacts/2066f5b7-465a-40ac-b110-8285e161e82a'
    },
    // Row 5
    {
      heading: "Kid's Guide Version",
      sub: 'Film Lead',
      href: 'https://claude.ai/public/artifacts/4b4d5156-3d2d-4d64-ba43-10a68bc08b4e'
    }
  ];

  const open = (url) => window.open(url, '_blank', 'noopener,noreferrer');

  return (
    <>
      <Navbar />
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg,#0ea5e9 0%,#0984cf 40%,#0b4ed8 100%)',
        paddingTop: 80,
        paddingBottom: '3rem'
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 2rem' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '2.5rem', color: 'white' }}>
            <img
              src="/preplogo.png"
              alt="Prep101 Logo"
              style={{ height: 60, width: 'auto', objectFit: 'contain', marginBottom: 12 }}
            />
            <h1 style={{ fontSize: '2.4rem', fontWeight: 900, margin: 0, letterSpacing: '-0.01em' }}>
              Audition Guide Examples
            </h1>
            <p style={{ opacity: 0.9, marginTop: 8 }}>
              Real sample guides in the exact formats parents and young actors receive.
            </p>
          </div>

          {/* Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.25rem'
          }}>
            {tiles.map((t) => (
              <div
                key={t.href}
                style={{
                  background: 'white',
                  borderRadius: 16,
                  padding: '1.4rem',
                  boxShadow: '0 10px 40px rgba(0,0,0,.10)',
                  border: '1px solid #e5e7eb',
                  transition: 'transform .2s ease, box-shadow .2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 16px 60px rgba(0,0,0,.14)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 10px 40px rgba(0,0,0,.10)';
                }}
              >
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>{t.heading}</div>
                  <div style={{ color: '#64748b', marginTop: 2 }}>{t.sub}</div>
                </div>

                <button
                  onClick={() => open(t.href)}
                  style={{
                    background: '#0f172a',
                    color: 'white',
                    padding: '0.7rem 1.1rem',
                    border: 'none',
                    borderRadius: 999,
                    fontWeight: 800,
                    fontSize: '.95rem',
                    cursor: 'pointer'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = '#111827'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = '#0f172a'; }}
                >
                  See Example
                </button>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{
            marginTop: '2.5rem',
            background: 'linear-gradient(135deg,#2dd4bf 0%,#06b6d4 60%,#1d4ed8 100%)',
            borderRadius: 18,
            padding: '2rem',
            textAlign: 'center',
            color: 'white',
            boxShadow: '0 24px 70px rgba(6,182,212,.28)'
          }}>
            <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900 }}>Ready to get a guide like these?</h2>
            <p style={{ marginTop: 8, opacity: 0.95 }}>
              Start free (1 guide/month) — upgrade anytime.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: 12 }}>
              <button
                onClick={() => (user ? navigate('/dashboard') : navigate('/register'))}
                style={{
                  background: 'white',
                  color: '#1d4ed8',
                  padding: '0.8rem 1.2rem',
                  border: 'none',
                  borderRadius: 999,
                  fontWeight: 900,
                  cursor: 'pointer'
                }}
              >
                {user ? 'Go to Dashboard' : 'Start Free'}
              </button>
              {!user && (
                <button
                  onClick={() => navigate('/login')}
                  style={{
                    background: 'transparent',
                    color: 'white',
                    border: '1px solid white',
                    padding: '0.8rem 1.2rem',
                    borderRadius: 999,
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Log In
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Examples;