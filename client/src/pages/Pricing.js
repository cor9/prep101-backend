import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';

const Pricing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: '/month',
      features: [
        '3 guides per month',
        'Basic character analysis',
        'Standard coaching tips',
        'Email support'
      ],
      buttonText: 'Get Started Free',
      buttonAction: () => navigate('/register'),
      popular: false
    },
    {
      name: 'Basic',
      price: '$19',
      period: '/month',
      features: [
        '10 guides per month',
        'Advanced character analysis',
        'Detailed scene breakdown',
        'Performance coaching tips',
        'Priority email support',
        'Download guides as PDF'
      ],
      buttonText: 'Start Basic Plan',
      buttonAction: () => navigate('/register'),
      popular: true
    },
    {
      name: 'Premium',
      price: '$39',
      period: '/month',
      features: [
        'Unlimited guides',
        'Premium character analysis',
        'Advanced scene breakdown',
        'Personalized coaching',
        'Video feedback options',
        'Priority support',
        'Custom guide templates',
        'Analytics dashboard'
      ],
      buttonText: 'Start Premium Plan',
      buttonAction: () => navigate('/register'),
      popular: false
    }
  ];

  return (
    <>
      <Navbar />
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        paddingTop: '80px',
        paddingBottom: '2rem'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h1 style={{ 
              fontSize: '3.5rem', 
              fontWeight: 'bold', 
              marginBottom: '1rem',
              color: '#1e293b'
            }}>
              Simple, Transparent Pricing
            </h1>
            <p style={{ 
              fontSize: '1.2rem', 
              color: '#64748b',
              maxWidth: '600px',
              margin: '0 auto'
            }}>
              Choose the plan that fits your audition preparation needs. All plans include our core features.
            </p>
          </div>

          {/* Pricing Cards */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
            gap: '2rem',
            marginBottom: '4rem'
          }}>
            {plans.map((plan, index) => (
              <div key={index} style={{
                background: 'white',
                borderRadius: '1.5rem',
                padding: '2rem',
                boxShadow: plan.popular ? '0 25px 80px rgba(45, 212, 191, 0.3)' : '0 10px 40px rgba(0,0,0,0.1)',
                border: plan.popular ? '3px solid #2dd4bf' : '1px solid #e2e8f0',
                position: 'relative',
                transform: plan.popular ? 'scale(1.05)' : 'scale(1)',
                transition: 'all 0.3s ease'
              }}>
                {plan.popular && (
                  <div style={{
                    position: 'absolute',
                    top: '-15px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'linear-gradient(135deg, #2dd4bf 0%, #06b6d4 100%)',
                    color: 'white',
                    padding: '0.5rem 1.5rem',
                    borderRadius: '2rem',
                    fontSize: '0.9rem',
                    fontWeight: '600'
                  }}>
                    Most Popular
                  </div>
                )}
                
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <h3 style={{ 
                    fontSize: '1.5rem', 
                    fontWeight: 'bold', 
                    marginBottom: '0.5rem',
                    color: '#1e293b'
                  }}>
                    {plan.name}
                  </h3>
                  <div style={{ marginBottom: '1rem' }}>
                    <span style={{ 
                      fontSize: '3rem', 
                      fontWeight: 'bold', 
                      color: '#2dd4bf'
                    }}>
                      {plan.price}
                    </span>
                    <span style={{ 
                      fontSize: '1.1rem', 
                      color: '#64748b'
                    }}>
                      {plan.period}
                    </span>
                  </div>
                </div>

                <ul style={{ 
                  listStyle: 'none', 
                  padding: 0, 
                  marginBottom: '2rem',
                  minHeight: '200px'
                }}>
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} style={{
                      padding: '0.5rem 0',
                      display: 'flex',
                      alignItems: 'center',
                      color: '#475569'
                    }}>
                      <span style={{
                        color: '#2dd4bf',
                        marginRight: '0.75rem',
                        fontSize: '1.2rem'
                      }}>
                        ✓
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={plan.buttonAction}
                  style={{
                    width: '100%',
                    background: plan.popular 
                      ? 'linear-gradient(135deg, #2dd4bf 0%, #06b6d4 100%)'
                      : 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
                    color: 'white',
                    padding: '1rem',
                    border: 'none',
                    borderRadius: '1rem',
                    fontWeight: 'bold',
                    fontSize: '1.1rem',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseOver={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.transform = 'translateY(0)';
                  }}
                >
                  {plan.buttonText}
                </button>
              </div>
            ))}
          </div>

          {/* FAQ Section */}
          <div style={{
            background: 'white',
            borderRadius: '1.5rem',
            padding: '3rem',
            boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ 
              fontSize: '2rem', 
              fontWeight: 'bold', 
              textAlign: 'center', 
              marginBottom: '2rem',
              color: '#1e293b'
            }}>
              Frequently Asked Questions
            </h2>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
              gap: '2rem' 
            }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
                  Can I change my plan anytime?
                </h3>
                <p style={{ color: '#6b7280' }}>
                  Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.
                </p>
              </div>
              
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
                  What if I need more guides than my plan allows?
                </h3>
                <p style={{ color: '#6b7280' }}>
                  You can purchase additional guides individually or upgrade to a higher plan.
                </p>
              </div>
              
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
                  Do you offer refunds?
                </h3>
                <p style={{ color: '#6b7280' }}>
                  We offer a 30-day money-back guarantee on all paid plans.
                </p>
              </div>
              
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
                  Is there a free trial?
                </h3>
                <p style={{ color: '#6b7280' }}>
                  Yes, the Free plan gives you 3 guides to try our service before upgrading.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Pricing;
