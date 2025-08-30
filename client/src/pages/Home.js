import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Testimonials from '../components/Testimonials';
import './Home.css';

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <Navbar />
      <div className="home">
        <div className="container">
          {/* Header */}
          <header className="hero" aria-label="Prep101 hero">
            <img
              src="/preplogo.png"
              alt="Prep101 logo"
              className="logo"
              loading="lazy"
              decoding="async"
            />
            <h1 className="h1">PREP101</h1>
            <p className="kicker">The gold standard in audition prep.</p>
            <p className="sub">
              Get detailed, personalized audition preparation crafted by industry experts. Upload your sides,
              answer a few questions, and receive a comprehensive coaching guide.
            </p>

            <div className="btnRow">
              {!user ? (
                <>
                  <button
                    type="button"
                    className="btn btnPrimary"
                    onClick={() => navigate('/register')}
                    aria-label="Sign up for Prep101"
                  >
                    Sign Up Free
                  </button>
                  <button
                    type="button"
                    className="btn btnGhost"
                    onClick={() => navigate('/login')}
                    aria-label="Log in to Prep101"
                  >
                    Log In
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btnPrimary"
                  onClick={() => navigate('/account')}
                  aria-label="Go to your account"
                >
                  Go to Account
                </button>
              )}
            </div>

            <div className="btnRow" aria-label="Secondary actions">
              <button
                type="button"
                className="btnPill"
                onClick={() => navigate('/examples')}
              >
                View Examples
              </button>
              <button
                type="button"
                className="btnPill"
                onClick={() => navigate('/pricing')}
              >
                View Pricing
              </button>
            </div>
          </header>

          {/* Features */}
          <section className="card" aria-labelledby="howItWorksHeading">
            <h2 id="howItWorksHeading" className="h2">How It Works</h2>
            <div className="steps">
              <div className="step">
                <div className="stepBadge badge1">1</div>
                <h3 className="stepTitle">Upload Sides</h3>
                <p className="stepSub">Upload your audition script in PDF format</p>
              </div>
              <div className="step">
                <div className="stepBadge badge2">2</div>
                <h3 className="stepTitle">Fill Details</h3>
                <p className="stepSub">Provide character and production information</p>
              </div>
              <div className="step">
                <div className="stepBadge badge3">3</div>
                <h3 className="stepTitle">Get Guide</h3>
                <p className="stepSub">Receive your personalized coaching guide</p>
              </div>
            </div>
          </section>

          <Testimonials />
        </div>
      </div>
      
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify({
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"Prep101 Audition Prep Guide",
        "description":"Custom scene analysis and coaching guide for young actors.",
        "brand":{"@type":"Brand","name":"Child Actor 101"},
        "aggregateRating":{
          "@type":"AggregateRating",
          "ratingValue":"5",
          "reviewCount": 5
        },
        "review": [
          { "@type":"Review", "author": {"@type":"Person","name":"Sara Shaddix"}, "reviewBody": "Holy Moly! ... would easily pay $75–$125 for this.", "reviewRating":{"@type":"Rating","ratingValue":"5"} },
          { "@type":"Review", "author": {"@type":"Person","name":"Jennifer Diamond"}, "reviewBody": "This is gold!", "reviewRating":{"@type":"Rating","ratingValue":"5"} },
          { "@type":"Review", "author": {"@type":"Person","name":"Kristina Brunelle"}, "reviewBody": "Pure gold.", "reviewRating":{"@type":"Rating","ratingValue":"5"} },
          { "@type":"Review", "author": {"@type":"Person","name":"Ty Correira"}, "reviewBody": "Gave me so much to work with.", "reviewRating":{"@type":"Rating","ratingValue":"5"} },
          { "@type":"Review", "author": {"@type":"Person","name":"Olivia Eppe"}, "reviewBody": "Very helpful!", "reviewRating":{"@type":"Rating","ratingValue":"5"} }
        ]
      })}} />
    </>
  );
};

export default Home;
