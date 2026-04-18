import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import GoldWall from '../components/GoldWall';
import './Home.css';

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const primary = () => (user ? navigate('/account') : navigate('/register'));

  return (
    <>
      <Navbar />
      <div className="home">
        {/* DARK FULL-WIDTH HERO */}
        <section className="heroDark" aria-label="Prep101 hero">
          <img src="/preplogo.png" alt="Prep101" className="logoDark" loading="lazy" />
          <h1 className="h1Dark">Audition prep parents call <strong style={{background:'none', color:'#FFC83A'}}>GOLD</strong>.</h1>
          <p className="taglineDark">
            Personalized coaching guides that break down every beat—so young actors show up <strong>prepared</strong>,
            <strong> confident</strong>, and <strong>unforgettable</strong>.<br />
            One Child Actor 101 account powers Prep101, Reader101, and Bold Choices.
          </p>
          <p style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.7)', fontWeight: 700, letterSpacing: '0.02em', marginBottom: '1.25rem' }}>
            Go deeper.
          </p>
          <div className="btnRow">
            <button className="btn btnPrimaryDark" onClick={primary}>Get Started</button>
            <button className="btn btnSecondaryDark" onClick={() => navigate('/examples')}>See Examples</button>
          </div>
        </section>

        <section style={{ padding: '4rem 1.5rem' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
            <p style={{ fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>
              The System
            </p>
            <h2 style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)', marginBottom: 20 }}>
              The Self-Tape System
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', maxWidth: 520, margin: '0 auto 40px' }}>
              Most actors don’t struggle with talent.
              <br />
              They struggle with what to do, how to build it, and whether it works.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
              <div style={{ padding: 20, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14 }}>
                <strong>1. What do I do?</strong><br />
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>Bold Choices</span>
              </div>
              <div style={{ padding: 20, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14 }}>
                <strong>2. How do I build it?</strong><br />
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>Prep101</span>
              </div>
              <div style={{ padding: 20, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14 }}>
                <strong>3. Is the tape working?</strong><br />
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>Reader101</span>
              </div>
            </div>
            <p style={{ marginTop: 20, color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
              Used together, this becomes a repeatable process—not guesswork.
            </p>
          </div>
        </section>

        <div className="container">
          {/* How it works */}
          <section className="card hiw" aria-labelledby="how">
            <h2 id="how" className="h2 hiw__title">How It Works</h2>
            <ol className="hiw__steps">
              <li className="hiw__step">
                <span className="hiw__num">1</span>
                <h3>Upload Sides</h3>
                <p>PDF sides work best. Clean scans = faster turnaround.</p>
              </li>
              <li className="hiw__step">
                <span className="hiw__num">2</span>
                <h3>Fill Details</h3>
                <p>Character + production info so we tailor the guide.</p>
              </li>
              <li className="hiw__step">
                <span className="hiw__num">3</span>
                <h3>Get Your Guide</h3>
                <p>Scene beats, subtext, physicality, button strategy—ready to rehearse.</p>
              </li>
            </ol>
          </section>

          {/* GOLD WALL — with initials */}
          <GoldWall />

          {/* Bottom CTA band */}
          <section className="bottomCta" aria-label="Get started">
            <h3>Ready for a GOLD guide for your next audition?</h3>
            <div className="ctaActions">
              <button className="btn btnPrimaryDark" onClick={() => navigate('/register')}>
                Get Started
              </button>
              <button className="btn btnSecondaryDark" onClick={() => navigate('/examples')}>
                See Examples
              </button>
            </div>
          </section>

        </div>
        
        {/* Footer */}
        <Footer />
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
