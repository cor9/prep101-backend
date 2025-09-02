import React from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import '../styles/shared.css';

const Examples = () => {
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
      href: 'https://claude.ai/public/artifacts/233bb61a-6159-446e-8137-5e3ecec11610'
    },
    {
      heading: 'Daytime Soap',
      sub: 'Recurring Day Player',
      href: 'https://claude.ai/public/artifacts/206bb5b7-465a-40ac-b110-8285e161e82a'
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
      <div className="page-dark">
        {/* Hero Section */}
        <div className="page-hero">
          <img src="/preplogo.png" alt="Prep101 logo" className="logo-hero" loading="lazy" />
          <h1 className="h1-hero">See Prep101 in Action</h1>
          <p className="h2-hero">Real examples of our audition preparation guides</p>
        </div>

        <div className="container-wide">
          {/* Grid */}
          <div className="grid-responsive">
            {tiles.map((t) => (
              <div
                key={t.href}
                className="card-white"
                style={{ cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
                onClick={() => open(t.href)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 28px 80px rgba(0,0,0,.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 22px 70px rgba(0,0,0,.10)';
                }}
              >
                <h3 style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: '800', 
                  color: 'var(--gray-800)', 
                  margin: '0 0 0.5rem 0',
                  lineHeight: '1.3'
                }}>
                  {t.heading}
                </h3>
                <p style={{ 
                  color: 'var(--gray-600)', 
                  margin: '0 0 1rem 0',
                  fontSize: '0.95rem'
                }}>
                  {t.sub}
                </p>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--gold)',
                  fontWeight: '600',
                  fontSize: '0.9rem'
                }}>
                  <span>View Example</span>
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    style={{ marginLeft: '0.5rem' }}
                  >
                    <path 
                      d="M7 17L17 7M17 7H7M17 7V17" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="text-center mt-5">
            <div className="card-dark">
              <h2 style={{ 
                fontSize: '1.5rem', 
                fontWeight: '800', 
                color: 'var(--white)', 
                margin: '0 0 1rem 0' 
              }}>
                Ready to get your own custom guide?
              </h2>
              <p style={{ 
                color: 'var(--ink-dim)', 
                margin: '0 0 1.5rem 0',
                fontSize: '1.1rem'
              }}>
                Upload your sides and get a personalized coaching guide in minutes.
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button 
                  className="btn btnPrimary"
                  onClick={() => navigate('/register')}
                >
                  Get Started
                </button>
                <button 
                  className="btn btnSecondary"
                  onClick={() => navigate('/pricing')}
                >
                  View Pricing
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <Footer />
      </div>
    </>
  );
};

export default Examples;