import React from 'react';
import './Footer.css';
import { useAuth } from '../contexts/AuthContext';
import {
  ACCOUNT_LABEL,
  buildBoldChoicesUrl,
  buildReader101Url,
} from '../utils/ecosystemLinks';

const ECOSYSTEM = [
  { label: 'Child Actor 101', href: 'https://childactor101.com', logo: null },
  { label: 'Bold Choices', href: 'https://boldchoices.site', logo: '/boldchoiceslogo.png' },
  { label: 'Reader101', href: 'https://reader101.site', logo: '/reader101-logo.png' },
  { label: 'Coaching by Corey', href: 'https://coaching.childactor101.com', logo: null },
];

const Footer = () => {
  const { user } = useAuth();
  const token = user?.accessToken || user?.token;
  const links = ECOSYSTEM.map((item) => {
    if (item.label === 'Bold Choices') {
      return { ...item, href: buildBoldChoicesUrl({ token, redirect: user ? '/generate' : '/', useBridge: Boolean(user) }), useBridge: true };
    }
    if (item.label === 'Reader101') {
      return { ...item, href: buildReader101Url({ token, useBridge: Boolean(user) }), useBridge: true };
    }
    return item;
  });

  return (
    <footer className="footer">
      <div className="footer-content">

        <div className="footer-ecosystem">
          <div className="footer-ecosystem-label">The Child Actor 101 Ecosystem</div>
          <div className="footer-ecosystem-logos">
            {links.map(({ label, href, logo, useBridge }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="footer-ecosystem-item"
                data-bridge={useBridge ? 'true' : 'false'}
              >
                {logo ? (
                  <img
                    src={logo}
                    alt={label}
                    className="footer-ecosystem-logo"
                    onError={(event) => {
                      const target = event.currentTarget;
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling;
                      if (fallback) fallback.classList.add('show');
                    }}
                  />
                ) : null}
                <span className={`footer-ecosystem-text ${logo ? '' : 'show'}`}>{label}</span>
              </a>
            ))}
          </div>
        </div>

        <div className="footer-main">
          © {new Date().getFullYear()} Prep101 · 
          <a href="/pricing">Pricing</a> · 
          <a href="/account" title={ACCOUNT_LABEL}>My Account</a> · 
          <a href="/terms">Terms</a> · 
          <a href="/privacy">Privacy</a> · 
          <a href="/refunds">Refunds</a> · 
          <a href="/disclaimer">Disclaimer</a> · 
          <a href="/contact">Contact</a> · 
          <a href="/cookies">Cookies</a>
        </div>
        <div className="footer-tagline">
          Your Child Actor 101 account for Prep101, Reader101, and Bold Choices.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
