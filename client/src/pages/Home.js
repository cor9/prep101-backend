import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleGetStarted = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/register');
    }
  };

  return (
    <>
      <Navbar />
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #2dd4bf 0%, #06b6d4 50%, #1d4ed8 100%)',
        paddingTop: '80px'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '4rem', color: 'white' }}>
            {/* Logo */}
            <div style={{ marginBottom: '2rem' }}>
              <img 
                src="/preplogo.png" 
                alt="PREP101 Logo" 
                style={{
                  height: '400px',
                  width: 'auto',
                  objectFit: 'contain',
                  filter: 'none',
                  margin: '0 auto'
                }}
              />
            </div>
            
            <h1 style={{ 
              fontSize: '4rem', 
              fontWeight: 'bold', 
              marginBottom: '1rem',
              letterSpacing: '-0.02em'
            }}>
              PREP101
            </h1>
            <p style={{ 
              fontSize: '1.2rem', 
              marginBottom: '1rem',
              color: '#a7f3d0',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Custom Scene Analysis & Performance Coaching Guides
            </p>
            <p style={{ 
              fontSize: '1.1rem', 
              marginBottom: '2rem',
              maxWidth: '600px',
              margin: '0 auto 2rem'
            }}>
              Get detailed, personalized audition preparation crafted by industry experts. 
              Upload your sides, answer a few questions, and receive a comprehensive coaching guide.
            </p>
            
            {/* Main CTA Buttons */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '2rem' }}>
              {!user ? (
                <>
                  <button
                    onClick={() => navigate('/register')}
                    style={{
                      background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
                      color: 'white',
                      padding: '1rem 2rem',
                      border: 'none',
                      borderRadius: '2rem',
                      fontWeight: 'bold',
                      fontSize: '1.1rem',
                      cursor: 'pointer',
                      boxShadow: '0 10px 25px rgba(251, 146, 60, 0.3)',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseOver={(e) => {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 15px 35px rgba(251, 146, 60, 0.4)';
                    }}
                    onMouseOut={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 10px 25px rgba(251, 146, 60, 0.3)';
                    }}
                  >
                    Sign Up Free
                  </button>
                  
                  <button
                    onClick={() => navigate('/login')}
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      color: 'white',
                      padding: '1rem 2rem',
                      border: '2px solid white',
                      borderRadius: '2rem',
                      fontWeight: 'bold',
                      fontSize: '1.1rem',
                      cursor: 'pointer',
                      backdropFilter: 'blur(10px)',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseOver={(e) => {
                      e.target.style.background = 'rgba(255,255,255,0.3)';
                      e.target.style.transform = 'translateY(-2px)';
                    }}
                    onMouseOut={(e) => {
                      e.target.style.background = 'rgba(255,255,255,0.2)';
                      e.target.style.transform = 'translateY(0)';
                    }}
                  >
                    Log In
                  </button>
                </>
              ) : (
                <button
                  onClick={() => navigate('/account')}
                  style={{
                    background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
                    color: 'white',
                    padding: '1rem 2rem',
                    border: 'none',
                    borderRadius: '2rem',
                    fontWeight: 'bold',
                    fontSize: '1.1rem',
                    cursor: 'pointer',
                    boxShadow: '0 10px 25px rgba(251, 146, 60, 0.3)',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseOver={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 15px 35px rgba(251, 146, 60, 0.4)';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 10px 25px rgba(251, 146, 60, 0.3)';
                  }}
                >
                  Go to Account
                </button>
              )}
            </div>

            {/* Secondary Action Buttons */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/examples')}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '1.5rem',
                  fontWeight: '600',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.3s ease'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.3)';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onMouseOut={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.2)';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                View Examples
              </button>
              
              <button
                onClick={() => navigate('/pricing')}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '1.5rem',
                  fontWeight: '600',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.3s ease'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.3)';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onMouseOut={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.2)';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                View Pricing
              </button>
            </div>
          </div>

          {/* Features Section */}
          <div style={{
            background: 'white',
            borderRadius: '2rem',
            padding: '3rem',
            boxShadow: '0 25px 80px rgba(0,0,0,0.1)',
            maxWidth: '800px',
            margin: '0 auto'
          }}>
            <h2 style={{ 
              fontSize: '2rem', 
              fontWeight: 'bold', 
              textAlign: 'center', 
              color: '#374151',
              marginBottom: '2rem'
            }}>
              How It Works
            </h2>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '2rem' 
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  background: 'linear-gradient(135deg, #2dd4bf 0%, #06b6d4 100%)',
                  borderRadius: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  margin: '0 auto 1rem'
                }}>
                  1
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                  Upload Sides
                </h3>
                <p style={{ color: '#6b7280' }}>
                  Upload your audition script in PDF format
                </p>
              </div>
              
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  background: 'linear-gradient(135deg, #06b6d4 0%, #1d4ed8 100%)',
                  borderRadius: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  margin: '0 auto 1rem'
                }}>
                  2
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                  Fill Details
                </h3>
                <p style={{ color: '#6b7280' }}>
                  Provide character and production information
                </p>
              </div>
              
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
                  borderRadius: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  margin: '0 auto 1rem'
                }}>
                  3
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                  Get Guide
                </h3>
                <p style={{ color: '#6b7280' }}>
                  Receive your personalized coaching guide
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
