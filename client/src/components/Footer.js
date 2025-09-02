import React from 'react';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
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
        <div className="footer-links">
          <a href="https://childactor101.com" target="_blank" rel="noopener noreferrer">
            ← Back to ChildActor101.com
          </a>
        </div>
        <div className="footer-tagline">
          Prep101 — The gold standard in audition preparation.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
