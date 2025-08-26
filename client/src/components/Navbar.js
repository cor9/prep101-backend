import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid rgba(45, 212, 191, 0.2)',
      boxShadow: '0 4px 30px rgba(0,0,0,0.1)'
    }}>
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '0 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: '64px'
      }}>
        <Link to="/" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.75rem',
          textDecoration: 'none'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: 'linear-gradient(135deg, #2dd4bf 0%, #06b6d4 100%)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '1.5rem',
            boxShadow: '0 4px 15px rgba(45, 212, 191, 0.3)'
          }}>
            P
          </div>
          <div>
            <div style={{ 
              fontSize: '1.25rem', 
              fontWeight: 'bold', 
              color: '#0891b2' 
            }}>
              PREP101
            </div>
            <div style={{ 
              fontSize: '0.7rem', 
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Custom Scene Analysis
            </div>
          </div>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Navigation Links */}
          <Link 
            to="/examples" 
            style={{ 
              color: '#4b5563', 
              textDecoration: 'none',
              fontWeight: '500',
              transition: 'color 0.3s ease'
            }}
            onMouseOver={(e) => e.target.style.color = '#0891b2'}
            onMouseOut={(e) => e.target.style.color = '#4b5563'}
          >
            Examples
          </Link>
          
          <Link 
            to="/pricing" 
            style={{ 
              color: '#4b5563', 
              textDecoration: 'none',
              fontWeight: '500',
              transition: 'color 0.3s ease'
            }}
            onMouseOver={(e) => e.target.style.color = '#0891b2'}
            onMouseOut={(e) => e.target.style.color = '#4b5563'}
          >
            Pricing
          </Link>

          {user ? (
            <>
              <Link 
                to="/dashboard" 
                style={{ 
                  color: '#4b5563', 
                  textDecoration: 'none',
                  fontWeight: '500',
                  transition: 'color 0.3s ease'
                }}
                onMouseOver={(e) => e.target.style.color = '#0891b2'}
                onMouseOut={(e) => e.target.style.color = '#4b5563'}
              >
                Dashboard
              </Link>
              <span style={{ color: '#6b7280' }}>Hi, {user.name}</span>
              <button
                onClick={handleLogout}
                style={{
                  background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  border: 'none',
                  borderRadius: '2rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)';
                }}
                onMouseOut={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)';
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link 
                to="/login" 
                style={{ 
                  color: '#4b5563', 
                  textDecoration: 'none',
                  fontWeight: '500',
                  transition: 'color 0.3s ease'
                }}
                onMouseOver={(e) => e.target.style.color = '#0891b2'}
                onMouseOut={(e) => e.target.style.color = '#4b5563'}
              >
                Login
              </Link>
              <Link 
                to="/register"
                style={{
                  background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
                  color: 'white',
                  padding: '0.5rem 1.5rem',
                  borderRadius: '2rem',
                  fontWeight: '600',
                  textDecoration: 'none',
                  boxShadow: '0 4px 15px rgba(251, 146, 60, 0.3)',
                  transition: 'all 0.3s ease'
                }}
                onMouseOver={(e) => {
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 6px 20px rgba(251, 146, 60, 0.4)';
                }}
                onMouseOut={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 15px rgba(251, 146, 60, 0.3)';
                }}
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
