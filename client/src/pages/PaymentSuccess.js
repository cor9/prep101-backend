import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import '../styles/shared.css';

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Countdown redirect to dashboard
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/dashboard');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <>
      <Navbar />
      <div className="page-dark">
        <div className="container" style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card-white text-center" style={{ maxWidth: '600px', margin: '0 auto' }}>
            {/* Success Icon */}
            <div style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 2rem auto',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>

            {/* Success Message */}
            <h1 style={{
              fontSize: '2rem',
              fontWeight: '800',
              color: 'var(--gray-900)',
              margin: '0 0 1rem 0'
            }}>
              Payment Successful!
            </h1>

            <p style={{
              fontSize: '1.1rem',
              color: 'var(--gray-600)',
              margin: '0 0 2rem 0',
              lineHeight: '1.6'
            }}>
              Thank you for your purchase! Your subscription has been activated and you're all set to start creating amazing audition guides.
            </p>

            {/* What's Next Section */}
            <div style={{
              background: 'var(--gray-50)',
              padding: '1.5rem',
              borderRadius: '12px',
              marginBottom: '2rem',
              textAlign: 'left'
            }}>
              <h3 style={{
                fontSize: '1.2rem',
                fontWeight: '700',
                color: 'var(--gray-800)',
                margin: '0 0 1rem 0'
              }}>
                What's next?
              </h3>
              <ul style={{
                listStyle: 'none',
                padding: 0,
                margin: 0
              }}>
                <li style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  marginBottom: '0.75rem',
                  fontSize: '0.95rem',
                  color: 'var(--gray-700)'
                }}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--gold)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ marginRight: '0.75rem', marginTop: '0.125rem', flexShrink: 0 }}
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span>You'll receive a confirmation email shortly with your receipt</span>
                </li>
                <li style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  marginBottom: '0.75rem',
                  fontSize: '0.95rem',
                  color: 'var(--gray-700)'
                }}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--gold)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ marginRight: '0.75rem', marginTop: '0.125rem', flexShrink: 0 }}
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span>Head to your dashboard to upload your first script and generate a guide</span>
                </li>
                <li style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  fontSize: '0.95rem',
                  color: 'var(--gray-700)'
                }}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--gold)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ marginRight: '0.75rem', marginTop: '0.125rem', flexShrink: 0 }}
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span>Check out our examples page for inspiration</span>
                </li>
              </ul>
            </div>

            {/* Auto Redirect Notice */}
            <p style={{
              fontSize: '0.9rem',
              color: 'var(--gray-500)',
              margin: '0 0 1.5rem 0'
            }}>
              Redirecting to your dashboard in {countdown} second{countdown !== 1 ? 's' : ''}...
            </p>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/dashboard')}
                className="btn btnPrimary"
              >
                Go to Dashboard Now
              </button>
              <button
                onClick={() => navigate('/examples')}
                className="btn btnSecondary"
              >
                View Examples
              </button>
            </div>

            {/* Support Link */}
            <p style={{
              fontSize: '0.85rem',
              color: 'var(--gray-500)',
              margin: '2rem 0 0 0'
            }}>
              Need help? <a href="mailto:support@prep101.site" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: '600' }}>Contact Support</a>
            </p>
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
};

export default PaymentSuccess;
