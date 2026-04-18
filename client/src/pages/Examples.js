import React from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import '../styles/shared.css';
import './Examples.css';

const Examples = () => {
  const navigate = useNavigate();

  const readerTiles = [
    {
      heading: 'Reader101 Example 01',
      sub: 'Reader support guide artifact',
      href: 'https://claude.site/public/artifacts/c6e99d33-7f23-45fc-b461-046af09d07ec'
    },
    {
      heading: 'Reader101 Example 02',
      sub: 'Reader support guide artifact',
      href: 'https://claude.ai/public/artifacts/b59ca4c0-8704-4b5e-97a2-a4854a95a038'
    },
    {
      heading: 'Reader101 Example 03',
      sub: 'Reader support guide artifact',
      href: 'https://claude.ai/public/artifacts/71bb1408-32fc-486a-a9b4-404e4b975fd1'
    },
    {
      heading: 'Reader101 Example 04',
      sub: 'Reader support guide artifact',
      href: 'https://claude.ai/public/artifacts/12b76d6c-4074-4c72-91e7-1237abe891bc'
    }
  ];

  // === EXACT ORDER (Top → Bottom, Left → Right) ===
  const tiles = [
    // Row 1
    {
      heading: 'MultiCam Sitcom',
      sub: 'Disney Series Guest Star',
      href: 'https://claude.ai/public/artifacts/77401c18-46dc-47d3-b4f6-427bd0a22cb0'
    },
    {
      heading: 'TV Teen Drama',
      sub: 'Series Regular Role',
      href: 'https://claude.ai/public/artifacts/b76be214-e69d-499a-b7ea-e8af412b682e'
    },
    // Row 2
    {
      heading: 'Thriller/Horror',
      sub: 'Lead Role',
      href: 'https://pzixzsjbbswpba9zyakuna.on.drv.tw/prep101/carrieweb.html'
    },
    {
      heading: 'Drama Film',
      sub: 'Leading Role',
      href: 'https://claude.ai/public/artifacts/8483c054-0f47-4149-929c-a4d098934afa'
    },
    // Row 3
    {
      heading: 'Single-Cam Sitcom',
      sub: 'Disney Series Regular',
      href: 'https://claude.ai/public/artifacts/96f3dd5f-395f-42e9-9e5b-52eee8d41a26'
    },
    {
      heading: 'TV Medical Drama',
      sub: 'Co-Star Role',
      href: 'https://claude.ai/public/artifacts/1891f784-862b-4191-8e7a-a2c5c1f82443'
    },
    // Row 4
    {
      heading: 'Comedy Film',
      sub: 'Supporting Role',
      href: 'https://claude.ai/public/artifacts/233bb61a-6159-446e-8137-5e3ecec11610'
    },
    {
      heading: 'Daytime Soap',
      sub: 'Recurring Day Player',
      href: 'https://claude.ai/public/artifacts/206bb5b7-465a-40ac-b110-8285e161e82a'
    },
    // Row 5
    {
      heading: "Kid's Guide Version",
      sub: 'Film Lead',
      href: 'https://claude.ai/public/artifacts/4b4d5156-3d2d-4d64-ba43-10a68bc08b4e'
    }
  ];

  const open = (url) => window.open(url, '_blank', 'noopener,noreferrer');

  return (
    <>
      <Navbar />
      <div className="page-dark examples-page">
        <div className="page-hero examples-hero">
          <p className="examples-eyebrow">Live Guide Library</p>
          <img src="/preplogo.png" alt="Prep101 logo" className="logo-hero" loading="lazy" />
          <h1 className="h1-hero">See Prep101 in Action</h1>
          <p className="h2-hero examples-hero-sub">Real examples of our audition preparation guides</p>
        </div>

        <div className="container-wide">
          <section className="examples-section examples-section--reader">
            <header className="examples-section-head">
              <p className="examples-kicker">Reader101</p>
              <h2 className="examples-title">Reader Support Guide Examples</h2>
              <p className="examples-intro">
                A few live Reader101 examples. More are coming as soon as the updated front end is stable again.
              </p>
            </header>

            <div className="examples-grid">
              {readerTiles.map((t) => (
                <article key={t.href} className="example-card example-card--reader">
                  <p className="example-pill">Reader Example</p>
                  <h3 className="example-heading">
                    {t.heading}
                  </h3>
                  <p className="example-sub">
                    {t.sub}
                  </p>
                  <button
                    className="example-btn example-btn--reader"
                    onClick={() => open(t.href)}
                  >
                    <span>Open Reader101 Example</span>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M7 17L17 7M17 7H7M17 7V17"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="examples-section examples-section--prep">
            <header className="examples-section-head">
              <p className="examples-kicker examples-kicker--prep">Prep101</p>
              <h2 className="examples-title">Audition Guide Examples</h2>
              <p className="examples-intro">Browse style and genre-specific guide outputs.</p>
            </header>

            <div className="examples-grid">
            {tiles.map((t) => (
              <article key={t.href} className="example-card example-card--prep">
                <p className="example-pill example-pill--prep">Guide Example</p>
                <h3 className="example-heading">
                  {t.heading}
                </h3>
                <p className="example-sub">
                  {t.sub}
                </p>
                <button
                  className="example-btn example-btn--prep"
                  onClick={() => open(t.href)}
                >
                  <span>View Example</span>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M7 17L17 7M17 7H7M17 7V17"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </article>
            ))}
            </div>
          </section>

          <div className="text-center mt-5">
            <div className="card-dark examples-cta">
              <h2 className="examples-cta-title">
                Ready to get your own custom guide?
              </h2>
              <p className="examples-cta-sub">
                Upload your sides and get a personalized coaching guide in minutes.
              </p>
              <div className="examples-cta-actions">
                <button
                  className="btn btnPrimary"
                  onClick={() => navigate('/register')}
                >
                  Get Started
                </button>
                <button
                  className="btn btnSecondary"
                  onClick={() => navigate('/pricing')}
                >
                  View Pricing
                </button>
              </div>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
};

export default Examples;
