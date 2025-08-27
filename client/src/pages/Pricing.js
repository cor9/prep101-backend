import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';

const Pricing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Stripe checkout URLs
  const STRIPE = {
    FREE:  '#',                 // e.g., /register or a $0 checkout if you want
    STARTER: 'https://buy.stripe.com/6oU9AT4lVaPR8MBekG2wU3E',               // Stripe price link for 3/mo @ 29.99
    ALA_CARTE: 'https://buy.stripe.com/7sY7sL9Gfe23d2Ra4q2wU3D',             // Stripe link for single guide @ 14.99
    PREMIUM: 'https://buy.stripe.com/00w9AT2dNf679QFccy2wU3F',               // Stripe price link for 10/mo + 2 feedbacks @ 99.99
    ADDON_COACH: 'https://buy.stripe.com/fZu00j8Cb9LN8MB4K62wU3H',           // $50 30-min coaching
    ADDON_FEEDBACK: 'https://buy.stripe.com/6oU3cv9Gf1fhgf31xU2wU3G',        // $22 self-tape feedback
    EXAMPLES: '/examples'
  };

  const go = (href) => {
    if (!href || href === '#') {
      // If not logged in, send to register; else to dashboard so they can buy inside
      return user ? navigate('/dashboard') : navigate('/register');
    }
    window.location.href = href;
  };

  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: '/month',
      tagline: 'One guide on us every month.',
      features: [
        '1 guide per month',
        'Core scene breakdown & tips',
        'Parent + kid versions included',
        'Email support'
      ],
      cta: 'Start Free',
      href: STRIPE.FREE,
      popular: false,
      badge: 'Great for first-timers'
    },
    {
      name: 'Starter',
      price: '$29.99',
      period: '/month',
      tagline: 'Smart monthly rhythm for most actors.',
      features: [
        '3 guides per month',
        'Detailed beats, subtext & buttons',
        'Genre-aware notes (multi/single-cam, drama, film)',
        'Parent deep-dive + kid-ready guide',
        'Priority email support',
        'Printable PDF delivery'
      ],
      cta: 'Subscribe – Starter',
      href: STRIPE.STARTER,
      popular: true,
      badge: 'Most Popular'
    },
    {
      name: 'A la carte',
      price: '$14.99',
      period: '/guide',
      tagline: 'Buy a single guide whenever you need it.',
      features: [
        '1 guide (one-time purchase)',
        'Same depth as Starter guides',
        'Parent + kid versions',
        'PDF delivery'
      ],
      cta: 'Buy Single Guide',
      href: STRIPE.ALA_CARTE,
      popular: false,
      badge: 'Pay as you go'
    },
    {
      name: 'Premium',
      price: '$99.99',
      period: '/month',
      tagline: 'Serious prep, serious value.',
      features: [
        '10 guides per month',
        'Advanced scene & character analysis',
        '2 Self-Tape Feedbacks included (save $44)',
        'Parent deep-dive + kid-ready guide',
        'Rush-friendly priority support',
        'PDF delivery + rehearsal variations'
      ],
      cta: 'Subscribe – Premium',
      href: STRIPE.PREMIUM,
      popular: false,
      badge: 'Best value'
    }
  ];

  return (
    <>
      <Navbar />
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        paddingTop: 80,
        paddingBottom: '2rem'
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 2rem' }}>
          
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ marginBottom: '1.25rem' }}>
              <img
                src="/preplogo.png"
                alt="Prep101 Logo"
                style={{ height: 64, width: 'auto', objectFit: 'contain', margin: '0 auto' }}
              />
            </div>
            <h1 style={{ fontSize: '3.2rem', fontWeight: 900, marginBottom: '0.5rem', color: '#0f172a' }}>
              Pricing that fits the work week
            </h1>
            <p style={{ fontSize: '1.1rem', color: '#475569', maxWidth: 760, margin: '0 auto' }}>
              Start free. Upgrade when you're booking more auditions. Every guide includes
              a parent deep-dive and a simplified kid version.
            </p>
          </div>

          {/* Pricing Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            {plans.map((plan) => (
              <div key={plan.name} style={{
                background: 'white',
                borderRadius: '1.25rem',
                padding: '1.75rem',
                boxShadow: plan.popular ? '0 24px 70px rgba(45,212,191,.28)' : '0 10px 40px rgba(0,0,0,.08)',
                border: plan.popular ? '3px solid #2dd4bf' : '1px solid #e2e8f0',
                position: 'relative',
                transform: plan.popular ? 'scale(1.03)' : 'scale(1)',
                transition: 'all .3s ease'
              }}>
                {plan.badge && (
                  <div style={{
                    position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                    background: plan.popular
                      ? 'linear-gradient(135deg,#2dd4bf 0%,#06b6d4 100%)'
                      : 'linear-gradient(135deg,#fb923c 0%,#f97316 100%)',
                    color: 'white', padding: '6px 14px', borderRadius: 999, fontSize: '.8rem', fontWeight: 700
                  }}>
                    {plan.badge}
                  </div>
                )}

                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 900, margin: 0, color: '#0f172a' }}>{plan.name}</h3>
                  <div style={{ marginTop: 8, color: '#64748b' }}>{plan.tagline}</div>
                </div>

                <div style={{ textAlign: 'center', margin: '0.75rem 0 1.25rem' }}>
                  <span style={{ fontSize: '2.6rem', fontWeight: 900, color: '#0ea5e9' }}>{plan.price}</span>
                  <span style={{ fontSize: '1rem', color: '#64748b' }}>{plan.period}</span>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1.25rem', minHeight: 200 }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'start', gap: 10, padding: '6px 0', color: '#334155' }}>
                      <span style={{ color: '#10b981', fontWeight: 900 }}>✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => go(plan.href)}
                  style={{
                    width: '100%',
                    background: plan.popular
                      ? 'linear-gradient(135deg,#2dd4bf 0%,#06b6d4 100%)'
                      : 'linear-gradient(135deg,#fb923c 0%,#f97316 100%)',
                    color: 'white',
                    padding: '0.9rem 1rem',
                    border: 'none',
                    borderRadius: '0.9rem',
                    fontWeight: 800,
                    fontSize: '1.05rem',
                    cursor: 'pointer',
                    transition: 'all .25s ease'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>

          {/* Add-Ons */}
          <div style={{
            background: 'white',
            borderRadius: '1.25rem',
            padding: '1.75rem',
            boxShadow: '0 10px 40px rgba(0,0,0,.08)',
            border: '1px solid #e2e8f0',
            marginBottom: '2rem'
          }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 900, marginBottom: '1rem', color: '#0f172a', textAlign: 'center' }}>
              Add-Ons (any plan)
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))', gap: '1rem' }}>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem' }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>30-min Private Coaching</div>
                <div style={{ color: '#0ea5e9', fontWeight: 900, marginBottom: 6 }}>$50</div>
                <div style={{ color: '#475569', marginBottom: 10 }}>Targeted notes on your sides + on-camera adjustments.</div>
                <button onClick={() => go(STRIPE.ADDON_COACH)} style={{
                  background: 'linear-gradient(135deg,#fb923c 0%,#f97316 100%)',
                  color: 'white', padding: '0.6rem 0.9rem', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer'
                }}>Add Coaching</button>
              </div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem' }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Self-Tape Feedback</div>
                <div style={{ color: '#0ea5e9', fontWeight: 900, marginBottom: 6 }}>$22</div>
                <div style={{ color: '#475569', marginBottom: 10 }}>Actionable punch-ups within hours whenever possible.</div>
                <button onClick={() => go(STRIPE.ADDON_FEEDBACK)} style={{
                  background: 'linear-gradient(135deg,#2dd4bf 0%,#06b6d4 100%)',
                  color: 'white', padding: '0.6rem 0.9rem', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer'
                }}>Add Feedback</button>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div style={{
            background: 'white',
            borderRadius: '1.25rem',
            padding: '2rem',
            boxShadow: '0 10px 40px rgba(0,0,0,.08)',
            border: '1px solid #e2e8f0'
          }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 900, marginBottom: '1.25rem', color: '#0f172a', textAlign: 'center' }}>
              FAQs
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px,1fr))', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 6, color: '#111827' }}>
                  Do unused guides roll over?
                </h3>
                <p style={{ color: '#475569' }}>
                  Not right now. We keep it simple month-to-month so you stay consistent.
                </p>
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 6, color: '#111827' }}>
                  How fast do I get my guide?
                </h3>
                <p style={{ color: '#475569' }}>
                  Typically same day to next morning for most roles. Rush needs? Add a note at upload.
                </p>
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 6, color: '#111827' }}>
                  Can I switch or cancel anytime?
                </h3>
                <p style={{ color: '#475569' }}>
                  Yes—manage your plan from your dashboard. Changes take effect immediately.
                </p>
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 6, color: '#111827' }}>
                  What's inside each guide?
                </h3>
                <p style={{ color: '#475569' }}>
                  Scene beats & subtext, Uta Hagen 9 questions, physical/vocal choices, moment-before & button options,
                  plus a simplified kid version for quick rehearsal.
                </p>
              </div>
            </div>
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button onClick={() => (window.location.href = STRIPE.EXAMPLES)} style={{
                background: 'transparent', border: '1px solid #0ea5e9', color: '#0ea5e9',
                padding: '0.6rem 0.9rem', borderRadius: 10, fontWeight: 800, cursor: 'pointer'
              }}>
                See Example Guides
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Pricing;