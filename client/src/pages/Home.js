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
        <section className="heroDark" aria-label="Prep101 hero">
          <img src="/preplogo.png" alt="Prep101" className="logoDark" loading="lazy" />
          <h1 className="h1Dark">Audition prep parents call <strong className="goldText">GOLD</strong>.</h1>
          <p className="taglineDark">
            Personalized scene breakdowns and performance coaching — built from real auditions, delivered as a custom guide for every role.
          </p>
          <div className="btnRow">
            <button className="btn btnPrimaryDark" onClick={primary}>Get Started</button>
            <button className="btn btnSecondaryDark" onClick={() => navigate('/examples')}>See Examples</button>
          </div>
          <p className="hero-account-note">
            One account powers Prep101, Reader101, and Bold Choices.
          </p>
        </section>

        <section className="systemSection" aria-labelledby="system-title">
          <div className="systemInner">
            <p className="sectionLabel">The System</p>
            <h2 id="system-title" className="systemTitle">The Self-Tape System</h2>
            <p className="systemIntro">
              Most actors don’t struggle with talent.
              <br />
              They struggle with what to do, how to build it, and whether it works.
            </p>
            <div className="system-grid">
              <a href="https://boldchoices.site" className="system-card system-card--sibling" target="_blank" rel="noopener noreferrer">
                <div className="system-card-step">1. What do I do?</div>
                <img src="/boldchoiceslogo.png" alt="Bold Choices" className="system-card-logo" loading="lazy" />
                <div className="system-card-tagline">Find the choice</div>
              </a>

              <div className="system-card system-card--current" aria-current="page">
                <div className="system-card-badge">YOU ARE HERE</div>
                <div className="system-card-step">2. How do I build it?</div>
                <img src="/prep101-footer.png" alt="Prep101" className="system-card-logo" loading="lazy" />
                <div className="system-card-tagline">Build the performance</div>
              </div>

              <a href="https://reader101.site" className="system-card system-card--sibling" target="_blank" rel="noopener noreferrer">
                <div className="system-card-step">3. Is the tape working?</div>
                <img src="/reader101-footer.png" alt="Reader101" className="system-card-logo" loading="lazy" />
                <div className="system-card-tagline">Protect the read</div>
              </a>
            </div>
            <p className="systemOutro">
              Used together, this becomes a repeatable process—not guesswork.
            </p>
          </div>
        </section>

        <div className="container">
          <section className="card prepGuide" aria-labelledby="prep-guide-title">
            <p className="prepGuide__eyebrow">What You Get</p>
            <h2 id="prep-guide-title" className="h2 prepGuide__title">What's in a Prep101 Guide</h2>
            <p className="prepGuide__subhead">
              Every guide is built from the actual sides. No templates, no generic notes. These are the sections every actor gets:
            </p>
            <div className="prepGuide__grid">
              <article className="prepGuide__card"><span className="prepGuide__num">01</span><h3>Character Analysis</h3><p>Backstory, motivations, distinctive traits. What makes this character unique.</p></article>
              <article className="prepGuide__card"><span className="prepGuide__num">02</span><h3>Scene Breakdown</h3><p>Beat-by-beat analysis. Where the turns are. What each line is doing.</p></article>
              <article className="prepGuide__card"><span className="prepGuide__num">03</span><h3>Performance Notes</h3><p>Delivery, subtext, physicality, pacing. The craft behind the choices.</p></article>
              <article className="prepGuide__card"><span className="prepGuide__num">04</span><h3>Bold Choices</h3><p>Where to take risks, where to stay grounded. The moments that get callbacks.</p></article>
              <article className="prepGuide__card"><span className="prepGuide__num">05</span><h3>Button Strategy</h3><p>How to open, how to land, what the last beat should feel like.</p></article>
              <article className="prepGuide__card"><span className="prepGuide__num">06</span><h3>Rehearsal Plan</h3><p>What to practice, how many times, what to record and review.</p></article>
            </div>
          </section>

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

          <GoldWall />

          <section className="about-work" aria-labelledby="about-work-title">
            <div className="about-work-inner">
              <div className="about-manifesto">
                <p className="about-eyebrow">ABOUT THE WORK</p>
                <h2 id="about-work-title" className="about-h2">This system comes from real auditions.</h2>

                <p className="about-lede">
                  Corey Ralston works at the intersection of coaching and talent management — training actors while seeing exactly what translates on tape.
                </p>

                <p className="about-pattern-intro">The pattern is consistent:</p>

                <p className="about-pattern">
                  most auditions don't fall apart because of <em>talent</em>.<br />
                  They fall apart in the <em>choices</em>, the <em>preparation</em>, or the <em>read</em>.
                </p>

                <p className="about-kicker">These tools exist to fix that.</p>

                <p className="about-close">
                  This isn't theory.<br />
                  It's a repeatable audition process.
                </p>
              </div>

              <aside className="about-credentials">
                <div className="about-portrait">
                  <img src="/corey.jpg" alt="Corey Ralston" loading="lazy" />
                </div>
                <div className="about-id">
                  <div className="about-name">Corey Ralston</div>
                  <div className="about-role-primary">Founder · Child Actor 101</div>
                  <div className="about-role-secondary">Youth Talent Manager &amp; Acting Coach</div>
                  <div className="about-role-tertiary">40 years in the entertainment industry</div>
                </div>
                <a href="https://childactor101.com" className="about-cta" target="_blank" rel="noopener noreferrer">More about Corey →</a>
              </aside>
            </div>
          </section>

          <section className="companionGuides" aria-labelledby="companion-guides-title">
            <p className="sectionLabel">COMPANION GUIDES</p>
            <h2 id="companion-guides-title" className="h2 companionGuides__title">Everything else you need for a great tape.</h2>
            <p className="companionGuides__subhead">
              Prep101 handles the performance. These three free guides handle everything around it.
            </p>

            <div className="resources-grid">
              <a href="https://selftapetips.childactor101.com" className="resource-card resource-card--setup">
                <div className="resource-card-inner">
                  <div className="resource-kicker">The Setup Guide</div>
                  <h3>Set up your self-tape <em>right.</em></h3>
                  <p>Lighting, framing, background, audio — the complete technical checklist.</p>
                  <span className="resource-link">Read the guide →</span>
                </div>
              </a>

              <a href="https://memorize.childactor101.com" className="resource-card resource-card--memorize">
                <div className="resource-card-inner">
                  <div className="resource-kicker">The Memorization Guide</div>
                  <h3>Memorize lines <em>fast.</em><br />Without the burnout.</h3>
                  <p>The methods working kids actually use. No flashcards. No tears.</p>
                  <span className="resource-link">Read the guide →</span>
                </div>
              </a>

              <a href="https://zoomcb.childactor101.com" className="resource-card resource-card--callbacks">
                <div className="resource-card-inner">
                  <div className="resource-kicker">The Callback Guide</div>
                  <h3>Zoom callbacks are <em>a different game.</em></h3>
                  <p>Here's what changes when the producers are on the other end of the screen.</p>
                  <span className="resource-link">Read the guide →</span>
                </div>
              </a>
            </div>
          </section>

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
          "reviewCount": 4
        },
        "review": [
          { "@type":"Review", "author": {"@type":"Person","name":"Sara Shaddix"}, "reviewBody": "Holy Moly! That audition breakdown was incredible. Really phenomenal. It broke down every little bit and my daughter really took it to heart. I would easily pay $75–$125 for this.", "reviewRating":{"@type":"Rating","ratingValue":"5"} },
          { "@type":"Review", "author": {"@type":"Person","name":"Kristina Brunelle"}, "reviewBody": "O. M. G. Corey, You. Are. A Wizard! Seriously, this is pure gold, thank you so much!", "reviewRating":{"@type":"Rating","ratingValue":"5"} },
          { "@type":"Review", "author": {"@type":"Person","name":"Ty Correira"}, "reviewBody": "Thanks so much for the audition preparation guide, Corey. It gave me so much to work with and I really used it to inform a lot of choices in the audition.", "reviewRating":{"@type":"Rating","ratingValue":"5"} },
          { "@type":"Review", "author": {"@type":"Person","name":"Agent David Doan"}, "reviewBody": "These are incredible!", "reviewRating":{"@type":"Rating","ratingValue":"5"} }
        ]
      })}} />
    </>
  );
};

export default Home;
