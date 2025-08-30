import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import GoldWall from '../components/GoldWall.js';
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
            <p className="kicker">
              <span className="kickerBadge">Parents Call It GOLD</span>
              — We Call It Prep101
            </p>
            <p className="sub">
              The <strong>gold standard</strong> in audition prep for young actors.  
              Detailed, personalized coaching guides that break down every beat of your audition —  
              so you can show up prepared, confident, and unforgettable.
            </p>

            <div className="btnRow">
              {!user ? (
                <>
                  <button
                    type="button"
                    className="btn btnPrimary"
                    onClick={() => navigate('/register')}
                    aria-label="Start your gold guide"
                  >
                    Start Your Gold Guide
                  </button>
                  <button
                    type="button"
                    className="btn btnGhost"
                    onClick={() => navigate('/login')}
                    aria-label="Log in to Prep101"
                  >
                    Claim Your Custom Prep Guide
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

          <section className="trustBand" aria-label="Trust signal">
            <p>Trusted by parents and agents nationwide</p>
          </section>

          <GoldWall />
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
          "reviewCount": 7
        },
        "review": [
          { "@type":"Review", "author": {"@type":"Person","name":"Sara Shaddix"}, "reviewBody": "Holy Moly! That audition breakdown was incredible. Really phenomenal. It broke down every little bit and my daughter really took it to heart. I would easily pay $75–$125 for this.", "reviewRating":{"@type":"Rating","ratingValue":"5"} },
          { "@type":"Review", "author": {"@type":"Person","name":"Jennifer Diamond"}, "reviewBody": "How in the world do you come up with all of this? This is gold!", "reviewRating":{"@type":"Rating","ratingValue":"5"} },
          { "@type":"Review", "author": {"@type":"Person","name":"Kristina Brunelle"}, "reviewBody": "O. M. G. Corey, You. Are. A Wizard! Seriously, this is pure gold, thank you so much!", "reviewRating":{"@type":"Rating","ratingValue":"5"} },
          { "@type":"Review", "author": {"@type":"Person","name":"Ty Correira"}, "reviewBody": "Thanks so much for the audition preparation guide, Corey. It gave me so much to work with and I really used it to inform a lot of choices in the audition.", "reviewRating":{"@type":"Rating","ratingValue":"5"} },
          { "@type":"Review", "author": {"@type":"Person","name":"Olivia Eppe"}, "reviewBody": "This is so great to have!!! Very helpful!", "reviewRating":{"@type":"Rating","ratingValue":"5"} },
          { "@type":"Review", "author": {"@type":"Person","name":"Lynnette L."}, "reviewBody": "This is AWESOME! Thanks, Corey!! He dove right into it this morning.", "reviewRating":{"@type":"Rating","ratingValue":"5"} },
          { "@type":"Review", "author": {"@type":"Person","name":"Agent David Doan"}, "reviewBody": "These are incredible!", "reviewRating":{"@type":"Rating","ratingValue":"5"} }
        ]
      })}} />
    </>
  );
};

export default Home;
