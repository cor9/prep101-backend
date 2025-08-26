import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';

const Examples = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const examples = [
    {
      title: "Shakespeare - Hamlet's Soliloquy",
      character: "Hamlet",
      production: "Hamlet",
      type: "Classical Theatre",
      description: "A deep dive into Hamlet's famous 'To be or not to be' soliloquy, exploring the character's internal conflict and the existential themes.",
      highlights: [
        "Character motivation analysis",
        "Text interpretation",
        "Physical and vocal choices",
        "Emotional journey mapping"
      ],
      image: "🎭"
    },
    {
      title: "Contemporary - 'Doubt' by John Patrick Shanley",
      character: "Sister Aloysius",
      production: "Doubt",
      type: "Contemporary Drama",
      description: "Analysis of Sister Aloysius's complex character, examining her moral certainty and the dramatic tension in her scenes.",
      highlights: [
        "Subtext exploration",
        "Power dynamics",
        "Moral complexity",
        "Scene partner work"
      ],
      image: "⛪"
    },
    {
      title: "Musical Theatre - 'Wicked'",
      character: "Elphaba",
      production: "Wicked",
      type: "Musical Theatre",
      description: "Character development for Elphaba, focusing on her transformation from misunderstood outcast to powerful heroine.",
      highlights: [
        "Character arc development",
        "Vocal performance notes",
        "Physical transformation",
        "Emotional vulnerability"
      ],
      image: "🟢"
    },
    {
      title: "Film - 'The Devil Wears Prada'",
      character: "Andy Sachs",
      production: "The Devil Wears Prada",
      type: "Film",
      description: "Modern character analysis of Andy Sachs, exploring her journey from naive newcomer to confident professional.",
      highlights: [
        "Character growth arc",
        "Modern dialogue delivery",
        "Physical comedy elements",
        "Emotional authenticity"
      ],
      image: "👠"
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
            {/* Logo */}
            <div style={{ marginBottom: '2rem' }}>
              <img 
                src="/preplogo.png" 
                alt="PREP101 Logo" 
                style={{
                  height: '60px',
                  width: 'auto',
                  objectFit: 'contain',
                  margin: '0 auto'
                }}
              />
            </div>
            
            <h1 style={{ 
              fontSize: '3.5rem', 
              fontWeight: 'bold', 
              marginBottom: '1rem',
              color: '#1e293b'
            }}>
              See What You'll Get
            </h1>
            <p style={{ 
              fontSize: '1.2rem', 
              color: '#64748b',
              maxWidth: '700px',
              margin: '0 auto'
            }}>
              Explore examples of our comprehensive acting guides. Each guide is tailored to your specific character and production needs.
            </p>
          </div>

          {/* Examples Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', 
            gap: '2rem',
            marginBottom: '4rem'
          }}>
            {examples.map((example, index) => (
              <div key={index} style={{
                background: 'white',
                borderRadius: '1.5rem',
                padding: '2rem',
                boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }}
              onMouseOver={(e) => {
                e.target.style.transform = 'translateY(-5px)';
                e.target.style.boxShadow = '0 20px 60px rgba(0,0,0,0.15)';
              }}
              onMouseOut={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 10px 40px rgba(0,0,0,0.1)';
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  marginBottom: '1.5rem' 
                }}>
                  <div style={{
                    fontSize: '3rem',
                    marginRight: '1rem'
                  }}>
                    {example.image}
                  </div>
                  <div>
                    <h3 style={{ 
                      fontSize: '1.3rem', 
                      fontWeight: 'bold', 
                      marginBottom: '0.5rem',
                      color: '#1e293b'
                    }}>
                      {example.title}
                    </h3>
                    <p style={{ 
                      fontSize: '0.9rem', 
                      color: '#64748b',
                      marginBottom: '0.25rem'
                    }}>
                      <strong>Character:</strong> {example.character}
                    </p>
                    <p style={{ 
                      fontSize: '0.9rem', 
                      color: '#64748b',
                      marginBottom: '0.25rem'
                    }}>
                      <strong>Production:</strong> {example.production}
                    </p>
                    <p style={{ 
                      fontSize: '0.9rem', 
                      color: '#64748b'
                    }}>
                      <strong>Type:</strong> {example.type}
                    </p>
                  </div>
                </div>
                
                <p style={{ 
                  color: '#475569', 
                  marginBottom: '1.5rem',
                  lineHeight: '1.6'
                }}>
                  {example.description}
                </p>
                
                <div>
                  <h4 style={{ 
                    fontSize: '1rem', 
                    fontWeight: '600', 
                    marginBottom: '0.75rem',
                    color: '#374151'
                  }}>
                    Guide Highlights:
                  </h4>
                  <ul style={{ 
                    listStyle: 'none', 
                    padding: 0 
                  }}>
                    {example.highlights.map((highlight, highlightIndex) => (
                      <li key={highlightIndex} style={{
                        padding: '0.25rem 0',
                        display: 'flex',
                        alignItems: 'center',
                        color: '#6b7280',
                        fontSize: '0.9rem'
                      }}>
                        <span style={{
                          color: '#2dd4bf',
                          marginRight: '0.5rem',
                          fontSize: '1rem'
                        }}>
                          •
                        </span>
                        {highlight}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {/* Call to Action */}
          <div style={{
            background: 'linear-gradient(135deg, #2dd4bf 0%, #06b6d4 50%, #1d4ed8 100%)',
            borderRadius: '1.5rem',
            padding: '3rem',
            textAlign: 'center',
            color: 'white',
            boxShadow: '0 25px 80px rgba(45, 212, 191, 0.3)'
          }}>
            <h2 style={{ 
              fontSize: '2.5rem', 
              fontWeight: 'bold', 
              marginBottom: '1rem'
            }}>
              Ready to Get Your Guide?
            </h2>
            <p style={{ 
              fontSize: '1.2rem', 
              marginBottom: '2rem',
              opacity: 0.9
            }}>
              Upload your sides and get a personalized guide just like these examples.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/register')}
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
                Sign Up Now
              </button>
              
              {!user && (
                <button
                  onClick={() => navigate('/login')}
                  style={{
                    background: 'white',
                    color: '#1d4ed8',
                    padding: '1rem 2rem',
                    border: 'none',
                    borderRadius: '2rem',
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
                  Log In
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Examples;
