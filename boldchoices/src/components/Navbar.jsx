import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  ACCOUNT_LABEL,
  buildPrepAuthCallbackUrl,
  buildPrepOnboardingUrl,
  buildReader101Url,
} from '../utils/ecosystemLinks.js';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isLanding = location.pathname === '/';
  const token = user?.accessToken || user?.token;
  const activeActor = user?.account?.activeActor;
  const needsOnboarding = Boolean(user?.account?.onboardingRequired);
  const prepAccountHref = needsOnboarding
    ? buildPrepOnboardingUrl({
        token,
        next: `https://boldchoices.site${location.pathname}${location.search || ''}`,
      })
    : buildPrepAuthCallbackUrl(token, 'https://prep101.site/dashboard?product=prep101');

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav style={{
      height: 64,
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 28px',
      justifyContent: 'space-between',
      background: 'rgba(10, 10, 15, 0.8)',
      backdropFilter: 'blur(16px)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <style>{`
        .nav-link { font-size: 14px; font-weight: 500; color: rgba(240,238,245,0.5); text-decoration: none; transition: color 0.2s; }
        .nav-link:hover { color: #F0EEF5; }
        .nav-link-ext { font-size: 13px; font-weight: 600; color: rgba(240,238,245,0.4); text-decoration: none; transition: color 0.2s; padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); }
        .nav-link-prep:hover { color: #f59e0b; border-color: rgba(245,158,11,0.3); }
        .nav-link-reader:hover { color: #14b8a6; border-color: rgba(20,184,166,0.3); }
        .nav-btn { font-family: 'DM Sans', sans-serif; padding: 8px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .nav-btn-ghost { background: transparent; border: 1px solid rgba(255,255,255,0.12); color: rgba(240,238,245,0.6); }
        .nav-btn-ghost:hover { border-color: rgba(255,255,255,0.25); color: #F0EEF5; }
        .nav-btn-primary { background: linear-gradient(135deg, #FF4D4D, #F5A623); border: none; color: #fff; box-shadow: 0 2px 12px rgba(255,77,77,0.25); }
        .nav-btn-primary:hover { opacity: 0.88; }
        @media (max-width: 600px) { .nav-ext-links { display: none !important; } }
      `}</style>

      {/* Logo */}
      <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
        <img
          src="/bold-choices-logo.png"
          alt="Bold Choices Logo"
          style={{ height: 44, width: 'auto', objectFit: 'contain' }}
        />
      </Link>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

        {/* Ecosystem links — always visible on landing */}
        <div className="nav-ext-links" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a
            href={token ? prepAccountHref : 'https://prep101.site'}
            target="_blank"
            rel="noopener noreferrer"
            className="nav-link-ext nav-link-prep"
            title={ACCOUNT_LABEL}
          >
            Prep101
          </a>
          <a
            href={buildReader101Url({ token })}
            target="_blank"
            rel="noopener noreferrer"
            className="nav-link-ext nav-link-reader"
            title={ACCOUNT_LABEL}
          >
            Reader101
          </a>
        </div>

        {isLanding && (
          <a
            href="#how"
            className="nav-link"
            onClick={e => { e.preventDefault(); document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' }); }}
          >
            How it works
          </a>
        )}

        {user ? (
          <>
            <span style={{ fontSize: 13, color: 'rgba(240,238,245,0.35)' }}>
              {activeActor?.actorName
                ? `Active Actor: ${activeActor.actorName}${activeActor.ageRange ? ` (${activeActor.ageRange})` : ''}`
                : user.email?.split('@')[0] || ACCOUNT_LABEL}
            </span>
            {location.pathname !== '/generate' && (
              <Link to="/generate">
                <button className="nav-btn nav-btn-primary">Generate</button>
              </Link>
            )}
            <button className="nav-btn nav-btn-ghost" onClick={handleLogout}>Sign out</button>
          </>
        ) : (
          <>
            <Link to="/login" className="nav-link">Sign in</Link>
            <Link to="/register">
              <button className="nav-btn nav-btn-primary">Start Free</button>
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
