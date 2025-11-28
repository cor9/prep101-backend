import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import '../styles/shared.css';

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
      name: 'A la carte',
      price: '$11.99',
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
      name: 'Starter',
      price: '$19.99',
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
      name: 'Premium',
      price: '$79.99',
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
      <div className="page-dark">
        {/* Hero Section */}
        <section className="page-hero">
          <img src="/preplogo.png" alt="Prep101 logo" className="logo-hero" loading="lazy" />
          <h1 className="h1-hero">Simple, Transparent Pricing</h1>
          <p className="h2-hero">Choose the plan that fits your audition preparation needs</p>
        </section>

        <div className="container-wide">
          {/* Pricing Grid */}
          <div className="grid-2">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`card-white ${plan.popular ? 'popular-plan' : ''}`}
                style={{
                  position: 'relative',
                  border: plan.popular ? '2px solid var(--gold)' : '1px solid var(--gray-200)',
                  transform: plan.popular ? 'scale(1.02)' : 'scale(1)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
              >
                {plan.popular && (
                  <div style={{
                    position: 'absolute',
                    top: '-12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--gold-grad)',
                    color: '#2f2500',
                    padding: '0.25rem 1rem',
                    borderRadius: '999px',
                    fontSize: '0.8rem',
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {plan.badge}
                  </div>
                )}

                <div className="text-center mb-3">
                  <h3 style={{
                    fontSize: '1.5rem',
                    fontWeight: '800',
                    color: 'var(--gray-800)',
                    margin: '0 0 0.5rem 0'
                  }}>
                    {plan.name}
                  </h3>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <span style={{
                      fontSize: '2.5rem',
                      fontWeight: '900',
                      color: 'var(--gray-900)'
                    }}>
                      {plan.price}
                    </span>
                    <span style={{
                      fontSize: '1rem',
                      color: 'var(--gray-600)',
                      fontWeight: '600'
                    }}>
                      {plan.period}
                    </span>
                  </div>
                  <p style={{
                    color: 'var(--gray-600)',
                    fontSize: '0.95rem',
                    margin: '0 0 1.5rem 0'
                  }}>
                    {plan.tagline}
                  </p>
                </div>

                <ul style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: '0 0 2rem 0'
                }}>
                  {plan.features.map((feature, index) => (
                    <li key={index} style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginBottom: '0.75rem',
                      fontSize: '0.95rem',
                      color: 'var(--gray-700)'
                    }}>
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        style={{ marginRight: '0.75rem', flexShrink: 0 }}
                      >
                        <path
                          d="M20 6L9 17l-5-5"
                          stroke="var(--gold)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => go(plan.href)}
                  className={`btn ${plan.popular ? 'btnPrimary' : 'btnSecondary'}`}
                  style={{ width: '100%' }}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>

          {/* Add-ons Section */}
          <div className="card-white mt-4">
            <h2 style={{
              fontSize: '1.8rem',
              fontWeight: '800',
              color: 'var(--gray-800)',
              textAlign: 'center',
              margin: '0 0 2rem 0'
            }}>
              Additional Services
            </h2>
            <div className="grid-2">
              <div style={{
                textAlign: 'center',
                padding: '1.5rem',
                border: '1px solid var(--gray-200)',
                borderRadius: '16px',
                background: 'var(--gray-50)'
              }}>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  color: 'var(--gray-800)',
                  margin: '0 0 0.5rem 0'
                }}>
                  Self-Tape Feedback
                </h3>
                <div style={{
                  fontSize: '2rem',
                  fontWeight: '900',
                  color: 'var(--gray-900)',
                  marginBottom: '0.5rem'
                }}>
                  $22
                </div>
                <p style={{
                  color: 'var(--gray-600)',
                  margin: '0 0 1rem 0'
                }}>
                  Professional feedback on your self-tape performance
                </p>
                <button
                  onClick={() => go(STRIPE.ADDON_FEEDBACK)}
                  className="btn btnSecondary"
                >
                  Get Feedback
                </button>
              </div>

              <div style={{
                textAlign: 'center',
                padding: '1.5rem',
                border: '1px solid var(--gray-200)',
                borderRadius: '16px',
                background: 'var(--gray-50)'
              }}>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  color: 'var(--gray-800)',
                  margin: '0 0 0.5rem 0'
                }}>
                  30-Min Coaching Session
                </h3>
                <div style={{
                  fontSize: '2rem',
                  fontWeight: '900',
                  color: 'var(--gray-900)',
                  marginBottom: '0.5rem'
                }}>
                  $50
                </div>
                <p style={{
                  color: 'var(--gray-600)',
                  margin: '0 0 1rem 0'
                }}>
                  One-on-one coaching with Corey Ralston
                </p>
                <button
                  onClick={() => go(STRIPE.ADDON_COACH)}
                  className="btn btnSecondary"
                >
                  Book Session
                </button>
              </div>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="card-white mt-4">
            <h2 style={{
              fontSize: '1.8rem',
              fontWeight: '800',
              color: 'var(--gray-800)',
              textAlign: 'center',
              margin: '0 0 2rem 0'
            }}>
              Frequently Asked Questions
            </h2>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  color: 'var(--gray-800)',
                  margin: '0 0 0.5rem 0'
                }}>
                  Can I cancel my subscription anytime?
                </h3>
                <p style={{
                  color: 'var(--gray-600)',
                  margin: 0,
                  lineHeight: '1.6'
                }}>
                  Yes, you can cancel your subscription at any time. You'll continue to have access until the end of your current billing period.
                </p>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  color: 'var(--gray-800)',
                  margin: '0 0 0.5rem 0'
                }}>
                  What if I need more guides than my plan allows?
                </h3>
                <p style={{
                  color: 'var(--gray-600)',
                  margin: 0,
                  lineHeight: '1.6'
                }}>
                  You can purchase additional guides individually at $11.99 each, or upgrade to a higher tier plan.
                </p>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  color: 'var(--gray-800)',
                  margin: '0 0 0.5rem 0'
                }}>
                  Do you offer refunds?
                </h3>
                <p style={{
                  color: 'var(--gray-600)',
                  margin: 0,
                  lineHeight: '1.6'
                }}>
                  We offer a 30-day money-back guarantee on all paid plans. If you're not satisfied, contact us for a full refund.
                </p>
              </div>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="text-center mt-5">
            <div className="card-dark">
              <h2 style={{
                fontSize: '1.8rem',
                fontWeight: '800',
                color: 'var(--white)',
                margin: '0 0 1rem 0'
              }}>
                Ready to get started?
              </h2>
              <p style={{
                color: 'var(--ink-dim)',
                margin: '0 0 1.5rem 0',
                fontSize: '1.1rem'
              }}>
                Create your account and choose the plan that works for you. Have a promo code? Redeem it for free guides!
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
                  onClick={() => navigate('/examples')}
                >
                  View Examples
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

export default Pricing;