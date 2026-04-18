import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import '../styles/shared.css';

const Pricing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const STRIPE = {
    // Prep101
    STARTER:          'https://buy.stripe.com/00wfZh5pZ8HJ2odgsO2wU40',
    ALA_CARTE:        'https://buy.stripe.com/6oU3cv8Cb2jlbYN0tQ2wU3Z',
    THREE_PACK:       'https://buy.stripe.com/7sYaEX4lV9LN3sh90m2wV0d',
    ADDON_COACH:      'https://buy.stripe.com/fZu00j8Cb9LN8MB4K62wU3H',
    ADDON_FEEDBACK:   'https://buy.stripe.com/6oU3cv9Gf1fhgf31xU2wU3G',
    // Reader101
    READER_ADDON:     'https://buy.stripe.com/28E5kD9Gf9LNd2RdgC2wV09',
    READER_ONE:       'https://buy.stripe.com/28E4gz19J5vx7Ixb8u2wV0a',
    READER_MONTHLY:   'https://buy.stripe.com/00w7sL3hR7DFd2R4K62wV0b',
    // Bold Choices
    BC_ONE:           'https://buy.stripe.com/6oUfZhcSre23d2R6Se2wV07',
    BC_MONTHLY:       'https://buy.stripe.com/aFa6oH05F6zBbYN6Se2wV08',
    // Bundle
    BUNDLE:           'https://buy.stripe.com/7sY4gz3hRe23faZ4K62wV0c',
  };

  const go = (href) => {
    if (!href || href === '#') return user ? navigate('/dashboard') : navigate('/register');
    window.location.href = href;
  };

  const Check = ({ color = 'var(--gold)' }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ marginRight: '0.6rem', flexShrink: 0 }}>
      <path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const PlanCard = ({ name, price, period, tagline, features, cta, href, popular, badge, color = 'var(--gold)' }) => (
    <div
      className="card-white"
      style={{
        position: 'relative',
        border: popular ? '2px solid var(--gold)' : '1px solid var(--gray-200)',
        transform: popular ? 'scale(1.02)' : 'scale(1)',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
    >
      {badge && (
        <div style={{
          position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--gold-grad)', color: '#2f2500',
          padding: '0.25rem 1rem', borderRadius: '999px',
          fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
          whiteSpace: 'nowrap',
        }}>{badge}</div>
      )}
      <div className="text-center mb-3">
        <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--gray-800)', margin: '0 0 0.4rem 0' }}>{name}</h3>
        <div style={{ marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--gray-900)' }}>{price}</span>
          <span style={{ fontSize: '0.95rem', color: 'var(--gray-600)', fontWeight: 600 }}>{period}</span>
        </div>
        <p style={{ color: 'var(--gray-600)', fontSize: '0.9rem', margin: '0 0 1.25rem 0' }}>{tagline}</p>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.75rem 0' }}>
        {features.map((f, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.6rem', fontSize: '0.9rem', color: 'var(--gray-700)' }}>
            <Check color={color} />{f}
          </li>
        ))}
      </ul>
      <button
        onClick={() => go(href)}
        className={`btn ${popular ? 'btnPrimary' : ''}`}
        style={{ width: '100%', ...(popular ? {} : { background: 'var(--gray-800)', color: 'var(--white)', border: 'none' }) }}
      >{cta}</button>
    </div>
  );

  return (
    <>
      <Navbar />
      <div className="page-dark">

        {/* Hero */}
        <section className="page-hero">
          <img
            src="/prep101-logo.png"
            alt="Prep101 logo"
            className="logo-hero"
            loading="lazy"
            style={{ height: 'clamp(170px, 21vw, 280px)' }}
          />
          <h1 className="h1-hero">Simple, Transparent Pricing</h1>
          <p className="h2-hero">One Child Actor 101 account. Every tool your actor needs — from prep to performance.</p>
        </section>

        <div className="container-wide">

          {/* ── PREP101 ── */}
          <div style={{ marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 1.25rem 0' }}>
              📋 Prep101 — Acting Guides
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
            <PlanCard
              name="Single A La Carte"
              price="$11.99"
              period="/guide"
              tagline="Buy a single guide whenever you need it."
              features={['1 guide (one-time)', 'Full beats, subtext & buttons', 'Parent + kid versions', 'PDF delivery']}
              cta="Buy Single A La Carte"
              href={STRIPE.ALA_CARTE}
              badge="Pay as you go"
            />
            <PlanCard
              name="3-Pack"
              price="$21.99"
              period="/pack"
              tagline="Three extra Prep101 guides at the best post-Starter value."
              features={['3 guides (one-time)', 'Perfect when you have used your monthly 5', 'Same full Prep101 depth and PDF delivery', 'Lower per-guide cost than buying singles']}
              cta="Buy 3-Pack"
              href={STRIPE.THREE_PACK}
              badge="Best top-up"
            />
            <PlanCard
              name="Starter"
              price="$19.99"
              period="/month"
              tagline="5 guides per month — smart rhythm for active actors."
              features={['5 guides per month', 'Detailed beats, subtext & buttons', 'Genre-aware notes (multi/single-cam, drama, film)', 'Parent deep-dive + kid-ready guide', 'Priority email support', 'Printable PDF delivery']}
              cta="Subscribe – Starter"
              href={STRIPE.STARTER}
              popular
              badge="Most Popular"
            />
          </div>

          {/* ── BOLD CHOICES ── */}
          <div style={{ marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 1.25rem 0' }}>
              🎭 Bold Choices — Acting Choices Generator
            </h2>
          </div>
          <div className="grid-2" style={{ marginBottom: '3rem' }}>
            <PlanCard
              name="One Guide"
              price="$3.99"
              period="/guide"
              tagline="One bold choices breakdown, anytime you need it."
              features={['1 bold choices guide', '5 specific acting choices', 'Take 2 strategy', 'Playable, castable directions']}
              cta="Buy One Guide"
              href={STRIPE.BC_ONE}
              badge="One-time"
              color="#FF4D4D"
            />
            <PlanCard
              name="Bold Choices Monthly"
              price="$9.99"
              period="/month"
              tagline="Daily rehearsal and audition prep, every month."
              features={['Unlimited bold choices guides', 'Spin Again — fresh choices instantly', 'Make It Wilder — escalate the risk', 'Take 2 Generator', "Today's Bold Move (daily challenge)", 'Save to Playbook']}
              cta="Subscribe – Bold Choices"
              href={STRIPE.BC_MONTHLY}
              popular
              badge="Best Value"
              color="#FF4D4D"
            />
          </div>

          {/* ── READER101 ── */}
          <div style={{ marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 1.25rem 0' }}>
              📖 Reader101 — Reader Support Guides
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
            <PlanCard
              name="Reader101 Add-On"
              price="$6.99"
              period="/guide"
              tagline="Add a Reader Guide to any Prep101 guide."
              features={['Reader Support Guide for parent/reader', 'Scene-specific coaching', 'Key beats + line-by-line direction', 'Connection & pacing notes']}
              cta="Add Reader Guide"
              href={STRIPE.READER_ADDON}
              badge="Add-On"
              color="var(--gold)"
            />
            <PlanCard
              name="Reader101 Single"
              price="$11.99"
              period="/guide"
              tagline="Standalone Reader Guide — no Prep101 required."
              features={['Full Reader Support Guide', 'PDF upload + scene analysis', 'Key beats, volume, connection coaching', '10 standard Reader Fundamentals included']}
              cta="Buy Reader Guide"
              href={STRIPE.READER_ONE}
              color="var(--gold)"
            />
            <PlanCard
              name="Reader101 Monthly"
              price="$19.99"
              period="/month"
              tagline="Unlimited reader guides every month."
              features={['Unlimited Reader Support Guides', 'Every audition, every week', 'Full fundamentals + scene-specific coaching', 'Volume, energy, connection, key beats']}
              cta="Subscribe – Reader101"
              href={STRIPE.READER_MONTHLY}
              popular
              badge="Most Popular"
              color="var(--gold)"
            />
          </div>

          {/* ── BUNDLE ── */}
          <div
            className="card-dark"
            style={{
              background: 'linear-gradient(135deg, #111d3a 0%, #0f172a 60%, #0b1227 100%)',
              border: '2px solid rgba(255,200,58,0.42)',
              borderRadius: '20px',
              padding: '2.5rem',
              marginBottom: '3rem',
              position: 'relative',
              overflow: 'visible',
            }}
          >
            <div style={{
              position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
              background: 'var(--gold-grad)',
              color: '#2f2500', padding: '0.3rem 1.25rem', borderRadius: '999px',
              fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap',
            }}>⭐ The Complete Self-Tape System</div>

            <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <span style={{ color: 'rgba(255,200,58,0.45)', fontSize: '1.5rem', lineHeight: '32px' }}>+</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffd873', lineHeight: '32px' }}>Prep101</span>
                <span style={{ color: 'rgba(255,200,58,0.45)', fontSize: '1.5rem', lineHeight: '32px' }}>+</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffd873', lineHeight: '32px' }}>Reader101</span>
                <span style={{ color: 'rgba(255,200,58,0.45)', fontSize: '1.5rem', lineHeight: '32px' }}>+</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ff8a8a', lineHeight: '32px' }}>Bold Choices</span>
              </div>
              <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 900, color: '#fff', margin: '0 0 0.5rem 0' }}>
                The Complete Self-Tape System
              </h2>
              <div style={{ marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--gold)' }}>$29.99</span>
                <span style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>/month</span>
              </div>
              <p style={{ color: 'rgba(230,237,245,0.76)', fontSize: '0.95rem', maxWidth: '620px', margin: '0 auto', lineHeight: 1.7 }}>
                Everything your actor needs for every audition. Get 5 Prep101 guides per month plus unlimited Reader101 and Bold Choices guides to support every audition from start to finish.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              {[
                { logo: '/prep101-footer.png', title: 'Prep101 Starter', desc: '5 guides/month — beats, subtext, buttons', color: '#f59e0b' },
                { logo: '/reader101-footer.png', title: 'Reader101', desc: 'Unlimited reader guides — every audition', color: '#ffd873' },
                { logo: '/boldchoices-logo.png', title: 'Bold Choices', desc: 'Unlimited daily acting choices', color: '#ff8a8a' },
              ].map(item => (
                <div key={item.title} style={{
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,200,58,0.16)',
                  borderRadius: '12px', padding: '1.25rem', textAlign: 'center',
                }}>
                  <img src={item.logo} alt={item.title} style={{ height: 34, width: 'auto', objectFit: 'contain', margin: '0 auto 0.55rem', display: 'block' }} />
                  <div style={{ fontWeight: 700, color: item.color, marginBottom: '0.25rem', fontSize: '0.95rem' }}>{item.title}</div>
                  <div style={{ fontSize: '0.82rem', color: 'rgba(230,237,245,0.62)', lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              ))}
            </div>

            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#ffd873', fontSize: '0.95rem', margin: '0 0 0.55rem 0', fontWeight: 700 }}>
                $19.99 + $19.99 + $9.99 = $49.97
              </p>
              <p style={{ color: '#fff', fontSize: '1rem', margin: '0 0 1rem 0', fontWeight: 800 }}>
                Savings of $19.98
              </p>
              <button
                onClick={() => go(STRIPE.BUNDLE)}
                style={{
                  background: 'var(--gold-grad)',
                  color: '#2f2500', border: 'none', borderRadius: '12px',
                  padding: '1rem 2.5rem', fontSize: '1.05rem', fontWeight: 800,
                  cursor: 'pointer', letterSpacing: '0.02em',
                  boxShadow: '0 12px 26px rgba(255,200,58,0.28)',
                }}
              >
                Get the Bundle — $29.99/month
              </button>
              <p style={{ color: 'rgba(230,237,245,0.5)', fontSize: '0.8rem', marginTop: '0.75rem' }}>
                Includes Prep101 Starter + Reader101 Monthly + Bold Choices Monthly. Cancel anytime.
              </p>
            </div>
          </div>

          {/* ── ADDITIONAL SERVICES ── */}
          <div className="grid-2" style={{ marginBottom: '2rem' }}>
            <div className="card-white">
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--gray-800)', textAlign: 'center', margin: '0 0 1.5rem 0' }}>
                Additional Services
              </h2>
              <div style={{ textAlign: 'center', margin: '-0.4rem 0 1.1rem 0' }}>
                <p style={{ margin: '0 0 .45rem 0', color: 'var(--gray-500)', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', fontSize: '.75rem' }}>
                  by
                </p>
                <img src="/coaching-logo.png" alt="Coaching by Corey" style={{ height: 40, width: 'auto', objectFit: 'contain' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[
                  { title: 'Self-Tape Feedback', price: '$22', desc: 'Professional feedback on your self-tape performance', href: STRIPE.ADDON_FEEDBACK, cta: 'Get Feedback' },
                  { title: '30-Min Coaching Session', price: '$50', desc: 'One-on-one coaching with Corey Ralston', href: STRIPE.ADDON_COACH, cta: 'Book Session' },
                ].map(s => (
                  <div key={s.title} style={{ textAlign: 'center', padding: '1.5rem', border: '1px solid var(--gray-200)', borderRadius: '16px', background: 'var(--gray-50)' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--gray-800)', margin: '0 0 0.4rem 0' }}>{s.title}</h3>
                    <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--gray-900)', marginBottom: '0.4rem' }}>{s.price}</div>
                    <p style={{ color: 'var(--gray-600)', margin: '0 0 1rem 0', fontSize: '0.88rem' }}>{s.desc}</p>
                    <button onClick={() => go(s.href)} className="btn" style={{ width: '100%', background: 'var(--gray-800)', color: 'var(--white)', border: 'none' }}>{s.cta}</button>
                  </div>
                ))}
              </div>
            </div>

            {/* FAQ */}
            <div className="card-white" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)', border: '1px solid rgba(15,23,42,.08)' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--gray-800)', textAlign: 'center', margin: '0 0 1.5rem 0' }}>
                Questions
              </h2>
              {[
                { q: 'Can I cancel anytime?', a: "Yes. Cancel anytime — you'll keep access through the end of your billing period." },
                { q: 'What if I need more Prep101 guides?', a: 'If you use your 5 Starter guides, you can buy one additional Prep101 guide for $11.99 or a 3-pack for $21.99.' },
                { q: 'Do you offer refunds?', a: '30-day money-back guarantee on all paid plans. Not happy? Contact us.' },
                { q: 'What is Reader101?', a: 'A guide for the parent or reader holding lines during a self-tape — specific coaching on pacing, energy, connection, and how not to hurt the performance.' },
              ].map(faq => (
                <div key={faq.q} style={{ marginBottom: '1.25rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gray-800)', margin: '0 0 0.3rem 0' }}>{faq.q}</h3>
                  <p style={{ color: 'var(--gray-600)', margin: 0, lineHeight: '1.6', fontSize: '0.9rem' }}>{faq.a}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="text-center mt-5">
            <div className="card-dark">
              <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--white)', margin: '0 0 1rem 0' }}>Ready to get started?</h2>
              <p style={{ color: 'var(--ink-dim)', margin: '0 0 1.5rem 0', fontSize: '1.1rem' }}>
                Create your account and choose the plan that fits. Have a promo code? Redeem it for free guides!
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn btnPrimary" onClick={() => navigate('/register')}>Get Started</button>
                <button className="btn btnSecondary" onClick={() => navigate('/examples')}>View Examples</button>
              </div>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
};

export default Pricing;
