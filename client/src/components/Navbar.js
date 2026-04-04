import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from '../contexts/AuthContext';

const ECOSYSTEM = [
  { label: 'ChildActor101', href: 'https://childactor101.com', color: '#6366f1' },
  { label: 'Bold Choices', href: 'https://boldchoices.site', color: '#FF4D4D' },
  { label: 'Reader101', href: 'https://reader101.site', color: '#14b8a6' },
  { label: 'Coaching', href: 'https://coaching.childactor101.com', color: '#f59e0b' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();
  const { user, logout } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  const handleLogout = () => { logout(); };

  return (
    <nav className={`nav ${scrolled ? "nav--scrolled" : ""}`}>
      <div className="nav__inner">
        <Link to="/" className="nav__brand">Prep101</Link>

        {/* Ecosystem links */}
        <div className="nav__ecosystem" style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
          {ECOSYSTEM.map(({ label, href, color }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '0.72rem', fontWeight: 700, color: 'rgba(120,120,130,0.8)',
                textDecoration: 'none',
                padding: '3px 9px', borderRadius: 999,
                border: '1px solid rgba(120,120,130,0.2)',
                transition: 'color 0.2s, border-color 0.2s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { e.target.style.color = color; e.target.style.borderColor = color + '55'; }}
              onMouseLeave={e => { e.target.style.color = 'rgba(120,120,130,0.8)'; e.target.style.borderColor = 'rgba(120,120,130,0.2)'; }}
            >
              {label}
            </a>
          ))}
        </div>

        <div className="nav__links">
          <Link to="/examples">Examples</Link>
          <Link to="/pricing">Pricing</Link>
          {user ? (
            <>
              <Link to="/dashboard">Dashboard</Link>
              <Link to="/account">Account</Link>
              <button onClick={handleLogout} className="nav__logout">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register" className="nav__cta">Get Started</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
