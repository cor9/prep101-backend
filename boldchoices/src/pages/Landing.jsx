import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import Navbar from '../components/Navbar.jsx';

const S = {
  hero: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(255,77,77,0.18) 0%, transparent 70%), #0a0a0f',
    overflow: 'hidden',
    position: 'relative',
  },
  grain: {
    position: 'fixed',
    inset: 0,
    backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'1\'/%3E%3C/svg%3E")',
    opacity: 0.025,
    pointerEvents: 'none',
    zIndex: 0,
  },
  content: {
    position: 'relative',
    zIndex: 1,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 24px 60px',
    textAlign: 'center',
    maxWidth: 780,
    margin: '0 auto',
    width: '100%',
  },
  eyebrow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(255,77,77,0.12)',
    border: '1px solid rgba(255,77,77,0.25)',
    borderRadius: 999,
    padding: '6px 16px',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#FF4D4D',
    marginBottom: 32,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#FF4D4D',
    animation: 'pulse 2s infinite',
  },
  h1: {
    fontFamily: 'Fraunces, serif',
    fontSize: 'clamp(2.8rem, 8vw, 5.2rem)',
    fontWeight: 900,
    lineHeight: 1.0,
    marginBottom: 28,
    letterSpacing: '-0.02em',
  },
  h1White: { color: '#F0EEF5' },
  h1Coral: { color: '#FF4D4D' },
  h1Gold: { color: '#F5A623' },
  subtitle: {
    fontSize: 'clamp(1rem, 2.5vw, 1.2rem)',
    color: 'rgba(240,238,245,0.6)',
    lineHeight: 1.7,
    maxWidth: 580,
    marginBottom: 48,
  },
  ctaGroup: {
    display: 'flex',
    gap: 14,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 64,
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #FF4D4D 0%, #F5A623 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '16px 36px',
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: '0.02em',
    cursor: 'pointer',
    transition: 'opacity 0.2s, transform 0.15s',
    boxShadow: '0 4px 24px rgba(255,77,77,0.3)',
  },
  btnSecondary: {
    background: 'transparent',
    color: 'rgba(240,238,245,0.7)',
    border: '1.5px solid rgba(240,238,245,0.15)',
    borderRadius: 12,
    padding: '16px 36px',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'border-color 0.2s, color 0.2s',
  },
  statsRow: {
    display: 'flex',
    gap: 48,
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 100,
  },
  stat: {
    textAlign: 'center',
  },
  statNum: {
    fontFamily: 'Fraunces, serif',
    fontSize: '2.4rem',
    fontWeight: 900,
    color: '#F5A623',
    lineHeight: 1,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: 'rgba(240,238,245,0.45)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  howItWorks: {
    width: '100%',
    maxWidth: 900,
    margin: '0 auto',
    padding: '0 24px 100px',
  },
  sectionLabel: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    color: 'rgba(240,238,245,0.35)',
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: 'Fraunces, serif',
    fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
    fontWeight: 900,
    textAlign: 'center',
    color: '#F0EEF5',
    marginBottom: 48,
    lineHeight: 1.15,
  },
  stepsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 20,
    marginBottom: 80,
  },
  stepCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '28px 24px',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  stepNum: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 800,
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#F0EEF5',
    marginBottom: 8,
  },
  stepDesc: {
    fontSize: 14,
    color: 'rgba(240,238,245,0.55)',
    lineHeight: 1.6,
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 16,
    marginBottom: 80,
  },
  featureCard: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: '24px 22px',
    transition: 'border-color 0.2s, background 0.2s',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  featureIcon: {
    fontSize: 24,
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#F0EEF5',
    marginBottom: 6,
  },
  featureDesc: {
    fontSize: 13.5,
    color: 'rgba(240,238,245,0.5)',
    lineHeight: 1.6,
  },
  pricingGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 20,
    marginBottom: 80,
  },
  pricingCard: (highlight) => ({
    background: highlight
      ? 'linear-gradient(135deg, rgba(255,77,77,0.12) 0%, rgba(245,166,35,0.1) 100%)'
      : 'rgba(255,255,255,0.03)',
    border: highlight
      ? '1.5px solid rgba(255,77,77,0.35)'
      : '1px solid rgba(255,255,255,0.08)',
    borderRadius: 18,
    padding: '32px 28px',
    position: 'relative',
  }),
  pricingBadge: {
    position: 'absolute',
    top: -12,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'linear-gradient(135deg, #FF4D4D, #F5A623)',
    color: '#fff',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    padding: '4px 14px',
    borderRadius: 999,
    whiteSpace: 'nowrap',
  },
  pricingTier: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'rgba(240,238,245,0.45)',
    marginBottom: 12,
  },
  pricingPrice: {
    fontFamily: 'Fraunces, serif',
    fontSize: '3rem',
    fontWeight: 900,
    color: '#F0EEF5',
    lineHeight: 1,
    marginBottom: 4,
  },
  pricingPer: {
    fontSize: 13,
    color: 'rgba(240,238,245,0.4)',
    marginBottom: 24,
  },
  pricingFeatureList: {
    listStyle: 'none',
    marginBottom: 28,
  },
  pricingFeature: (color) => ({
    display: 'flex',
    gap: 10,
    fontSize: 14,
    color: 'rgba(240,238,245,0.7)',
    marginBottom: 10,
    lineHeight: 1.4,
    alignItems: 'flex-start',
  }),
  pricingCheck: (color) => ({
    color: color,
    flexShrink: 0,
    fontWeight: 700,
    marginTop: 1,
  }),
  upgradeBanner: {
    background: 'linear-gradient(135deg, rgba(155,109,255,0.12) 0%, rgba(59,158,232,0.1) 100%)',
    border: '1px solid rgba(155,109,255,0.25)',
    borderRadius: 18,
    padding: '40px 36px',
    textAlign: 'center',
    marginBottom: 80,
  },
  upgradePill: {
    display: 'inline-block',
    background: 'rgba(155,109,255,0.15)',
    border: '1px solid rgba(155,109,255,0.3)',
    color: '#9B6DFF',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    padding: '5px 14px',
    borderRadius: 999,
    marginBottom: 16,
  },
  upgradeTitle: {
    fontFamily: 'Fraunces, serif',
    fontSize: 'clamp(1.4rem, 3vw, 2rem)',
    fontWeight: 900,
    color: '#F0EEF5',
    marginBottom: 12,
    lineHeight: 1.2,
  },
  upgradeDesc: {
    fontSize: 15,
    color: 'rgba(240,238,245,0.55)',
    maxWidth: 480,
    margin: '0 auto 24px',
    lineHeight: 1.7,
  },
  btnUpgrade: {
    background: 'rgba(155,109,255,0.15)',
    border: '1.5px solid rgba(155,109,255,0.4)',
    color: '#9B6DFF',
    borderRadius: 12,
    padding: '14px 32px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
    letterSpacing: '0.02em',
  },
  footer: {
    borderTop: '1px solid rgba(255,255,255,0.06)',
    padding: '32px 24px',
    textAlign: 'center',
    fontSize: 13,
    color: 'rgba(240,238,245,0.3)',
  },
};

const steps = [
  { num: '01', color: '#FF4D4D', bg: 'rgba(255,77,77,0.12)', title: 'Paste your sides', desc: 'Drop in the scene text or upload your PDF. That\'s it.' },
  { num: '02', color: '#F5A623', bg: 'rgba(245,166,35,0.12)', title: 'Add character info', desc: 'Role, show, casting — the more you give, the sharper the output.' },
  { num: '03', color: '#00D4C8', bg: 'rgba(0,212,200,0.12)', title: 'Get bold choices', desc: 'Specific. Playable. Memorable. Not generic — actually usable in the room.' },
  { num: '04', color: '#9B6DFF', bg: 'rgba(155,109,255,0.12)', title: 'Spin it, push it', desc: 'Not feeling it? Spin Again or Make It Wilder. Fresh choices instantly.' },
];

const features = [
  { icon: '🎯', title: 'Multiple bold ways to play the scene', desc: 'Get several specific, playable choices — not just one direction. See the scene from angles you wouldn\'t have found on your own.', color: '#FF4D4D' },
  { icon: '🔄', title: 'Regenerate instantly for fresh takes', desc: 'Not feeling it? Get a completely new set of choices in seconds. No logging in again, no starting over.', color: '#F5A623' },
  { icon: '🔥', title: 'Push beyond safe, predictable reads', desc: 'Every choice is designed to be castable and risky — not generic. Stop playing it safe before you even walk in.', color: '#00D4C8' },
  { icon: '🎬', title: 'Always have a strong second take', desc: 'Know exactly what you\'re doing differently before they ask for another one. Never get caught flat on take two.', color: '#9B6DFF' },
  { icon: '⚡', title: 'Build instincts with every audition', desc: 'The more you use it, the sharper your choices get. Treat every sides drop as a training rep, not a one-off.', color: '#3B9EE8' },
  { icon: '🚀', title: 'Expand into full Prep101 breakdowns', desc: 'Liked the bold choices? Get the full coaching guide — beats, subtext, character motivation, and a full rehearsal plan.', color: '#FF4D4D' },
];

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleCTA = () => {
    if (user) navigate('/generate');
    else navigate('/register');
  };

  return (
    <div style={S.hero}>
      <div style={S.grain} />
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
        .btn-secondary:hover { border-color: rgba(240,238,245,0.35); color: #F0EEF5; }
        .feature-card:hover { border-color: rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); }
        .btn-upgrade:hover { background: rgba(155,109,255,0.25); }
        .steps-grid { grid-template-columns: 1fr !important; }
        @media (min-width: 600px) { .steps-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (min-width: 900px) { .steps-grid { grid-template-columns: repeat(4, 1fr) !important; } }
      `}</style>

      <Navbar />

      {/* ── HERO ── */}
      <div style={S.content}>
        <div style={S.eyebrow}>
          <div style={S.dot} />
          For actors who are done blending in
        </div>

        <img 
          src="/bold-choices-logo.png" 
          alt="Bold Choices" 
          style={{ 
            width: '100%', 
            maxWidth: 500, 
            height: 'auto', 
            objectFit: 'contain',
            marginBottom: 16 
          }} 
        />

        <h1 style={{ ...S.h1, fontSize: 'clamp(2rem, 5vw, 3.5rem)', marginTop: 24, marginBottom: 16 }}>
          <span style={S.h1White}>Stop&nbsp;</span>
          <span style={S.h1Coral}>playing&nbsp;</span>
          <span style={S.h1White}>it&nbsp;</span>
          <span style={S.h1Gold}>safe.</span>
        </h1>

        <p style={S.subtitle}>
          Bold, specific, playable acting choices — generated in seconds.
          Not "add more emotion." Not "be natural."
          Exact adjustments that make casting remember you.
        </p>

        <div style={S.ctaGroup}>
          <button
            className="btn-primary"
            style={S.btnPrimary}
            onClick={handleCTA}
          >
            {user ? 'Generate My Choices →' : 'Get Free Preview →'}
          </button>
          <button
            className="btn-secondary"
            style={S.btnSecondary}
            onClick={() => document.getElementById('how').scrollIntoView({ behavior: 'smooth' })}
          >
            See how it works
          </button>
        </div>

        <div style={S.statsRow}>
          {[
            { num: '95%', label: 'of actors play it safe' },
            { num: '<90s', label: 'to generate' },
            { num: '5', label: 'bold choices per guide' },
            { num: '3', label: 'takes per key moment' },
          ].map(s => (
            <div key={s.label} style={S.stat}>
              <div style={S.statNum}>{s.num}</div>
              <div style={S.statLabel}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <div style={S.howItWorks} id="how">
        <div style={S.sectionLabel}>How it works</div>
        <h2 style={S.sectionTitle}>
          Four steps.<br />One unforgettable audition.
        </h2>

        <div className="steps-grid" style={S.stepsGrid}>
          {steps.map(s => (
            <div key={s.num} style={S.stepCard}>
              <div style={{ ...S.stepNum, background: s.bg, color: s.color }}>{s.num}</div>
              <div style={S.stepTitle}>{s.title}</div>
              <div style={S.stepDesc}>{s.desc}</div>
            </div>
          ))}
        </div>

        {/* ── FEATURES ── */}
        <div style={S.sectionLabel}>Features</div>
        <h2 style={S.sectionTitle}>
          Everything you need<br />to stand out.
        </h2>

        <div style={S.featuresGrid}>
          {features.map(f => (
            <div key={f.title} className="feature-card" style={S.featureCard}>
              <div style={S.featureIcon}>{f.icon}</div>
              <div style={S.featureTitle}>{f.title}</div>
              <div style={S.featureDesc}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* ── PRICING ── */}
        <div style={S.sectionLabel}>Pricing</div>
        <h2 style={S.sectionTitle}>Simple. Fair. Worth it.</h2>

        <div style={S.pricingGrid}>
          {/* One Guide */}
          <div style={S.pricingCard(false)}>
            <div style={S.pricingTier}>One-Time</div>
            <div style={S.pricingPrice}>$3.99</div>
            <div style={S.pricingPer}>per guide</div>
            <ul style={S.pricingFeatureList}>
              {[
                ['5 bold acting choices', true, '#00D4C8'],
                ['Take 2 alternate strategy', true, '#00D4C8'],
                ['Moment-by-moment breakdown', true, '#00D4C8'],
                ['Spin Again', false, 'rgba(240,238,245,0.25)'],
                ['Make It Wilder', false, 'rgba(240,238,245,0.25)'],
                ['Save to Playbook', false, 'rgba(240,238,245,0.25)'],
              ].map(([label, enabled, color]) => (
                <li key={label} style={S.pricingFeature(color)}>
                  <span style={S.pricingCheck(color)}>{enabled ? '✓' : '—'}</span>
                  <span style={{ color: enabled ? 'rgba(240,238,245,0.75)' : 'rgba(240,238,245,0.3)' }}>{label}</span>
                </li>
              ))}
            </ul>
            <button
              style={{ ...S.btnSecondary, width: '100%', borderRadius: 10, padding: '12px' }}
              onClick={() => window.location.href = 'https://buy.stripe.com/6oUfZhcSre23d2R6Se2wV07'}
            >
              Buy One Guide
            </button>
          </div>

          {/* Monthly */}
          <div style={S.pricingCard(true)}>
            <div style={S.pricingBadge}>Most Popular</div>
            <div style={S.pricingTier}>Monthly</div>
            <div style={S.pricingPrice}>$9.99</div>
            <div style={S.pricingPer}>per month</div>
            <ul style={S.pricingFeatureList}>
              {[
                ['Unlimited bold choices guides', true, '#FF4D4D'],
                ['Spin Again — fresh choices instantly', true, '#FF4D4D'],
                ['Make It Wilder — escalate the risk', true, '#FF4D4D'],
                ['Take 2 Generator', true, '#FF4D4D'],
                ['Save to Playbook', true, '#FF4D4D'],
                ["Today's Bold Move (daily)", true, '#FF4D4D'],
              ].map(([label, enabled, color]) => (
                <li key={label} style={S.pricingFeature(color)}>
                  <span style={S.pricingCheck(color)}>✓</span>
                  <span style={{ color: 'rgba(240,238,245,0.8)' }}>{label}</span>
                </li>
              ))}
            </ul>
            <button
              style={S.btnPrimary}
              className="btn-primary"
              onClick={() => window.location.href = 'https://buy.stripe.com/aFa6oH05F6zBbYN6Se2wV08'}
            >
              Subscribe — $9.99/mo
            </button>
          </div>
        </div>

        {/* ── PREP101 UPGRADE BANNER ── */}
        <div style={S.upgradeBanner}>
          <div style={S.upgradePill}>Powered by Prep101</div>
          <h3 style={S.upgradeTitle}>Want the full coaching breakdown?</h3>
          <p style={S.upgradeDesc}>
            Bold Choices gives you the spark.<br />
            Prep101 builds the performance.<br /><br />
            Every beat. Every shift. Every choice — mapped, motivated, and ready to play.
          </p>
          <button className="btn-upgrade" style={S.btnUpgrade} onClick={() => window.open('https://prep101.site', '_blank')}>
            Explore Prep101 →
          </button>
        </div>

        {/* ── BUNDLE BANNER ── */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(20,184,166,0.1) 0%, rgba(99,102,241,0.1) 100%)',
          border: '1.5px solid rgba(20,184,166,0.3)',
          borderRadius: 18,
          padding: '40px 36px',
          textAlign: 'center',
          marginBottom: 80,
        }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(20,184,166,0.15)',
            border: '1px solid rgba(20,184,166,0.3)',
            color: '#14b8a6',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', padding: '5px 14px',
            borderRadius: 999, marginBottom: 16,
          }}>⭐ Save $20/month</div>
          <h3 style={{ ...S.upgradeTitle, color: '#F0EEF5' }}>Complete Self-Tape System Bundle</h3>
          <p style={{ ...S.upgradeDesc }}>
            Get Prep101 + Reader101 + Bold Choices — everything your actor needs, in one plan.<br /><br />
            5 Prep101 guides · Unlimited Reader Guides · Unlimited Bold Choices<br />
            <span style={{ color: '#14b8a6', fontWeight: 700 }}>$29.99/month</span>
          </p>
          <button
            className="btn-upgrade"
            style={{ ...S.btnUpgrade, background: 'rgba(20,184,166,0.15)', borderColor: 'rgba(20,184,166,0.4)', color: '#14b8a6' }}
            onClick={() => window.location.href = 'https://buy.stripe.com/7sY4gz3hRe23faZ4K62wV0c'}
          >
            Get the Bundle →
          </button>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer style={S.footer}>
        <div style={{ marginBottom: 8, fontFamily: 'Fraunces, serif', fontSize: 16, fontWeight: 700, color: 'rgba(240,238,245,0.5)' }}>
          Bold Choices
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          {[
            { label: 'ChildActor101', href: 'https://childactor101.com' },
            { label: 'Prep101', href: 'https://prep101.site' },
            { label: 'Reader101', href: 'https://reader101.site' },
            { label: 'Coaching by Corey', href: 'https://coaching.childactor101.com' },
          ].map(({ label, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12, fontWeight: 600, color: 'rgba(240,238,245,0.35)',
                textDecoration: 'none', padding: '3px 10px', borderRadius: 999,
                border: '1px solid rgba(240,238,245,0.1)',
              }}
            >
              {label}
            </a>
          ))}
        </div>
        <div>
          © {new Date().getFullYear()} Corey Ralston
        </div>
      </footer>
    </div>
  );
}
