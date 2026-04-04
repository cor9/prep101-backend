import React from 'react';
import './Footer.css';

const ECOSYSTEM = [
  { label: 'ChildActor101', href: 'https://childactor101.com' },
  { label: 'Bold Choices', href: 'https://boldchoices.site' },
  { label: 'Reader101', href: 'https://reader101.site' },
  { label: 'Coaching by Corey', href: 'https://coaching.childactor101.com' },
];

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-content">

        {/* Ecosystem */}
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(200,180,120,0.45)', marginBottom: '0.5rem' }}>
            The Ecosystem
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {ECOSYSTEM.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '0.78rem', fontWeight: 600,
                  color: 'rgba(200,180,100,0.6)',
                  textDecoration: 'none',
                  padding: '3px 10px', borderRadius: 999,
                  border: '1px solid rgba(200,180,100,0.15)',
                  transition: 'color 0.2s, border-color 0.2s',
                }}
                onMouseEnter={e => { e.target.style.color = '#f59e0b'; e.target.style.borderColor = 'rgba(245,158,11,0.35)'; }}
                onMouseLeave={e => { e.target.style.color = 'rgba(200,180,100,0.6)'; e.target.style.borderColor = 'rgba(200,180,100,0.15)'; }}
              >
                {label}
              </a>
            ))}
          </div>
        </div>

        <div className="footer-main">
          © {new Date().getFullYear()} Prep101 · 
          <a href="/pricing">Pricing</a> · 
          <a href="/account">Account</a> · 
          <a href="/terms">Terms</a> · 
          <a href="/privacy">Privacy</a> · 
          <a href="/refunds">Refunds</a> · 
          <a href="/disclaimer">Disclaimer</a> · 
          <a href="/contact">Contact</a> · 
          <a href="/cookies">Cookies</a>
        </div>
        <div className="footer-tagline">
          Prep101 — The gold standard in audition preparation.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
