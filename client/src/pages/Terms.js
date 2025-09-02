import React from 'react';
import Navbar from '../components/Navbar';
import '../styles/shared.css';

const Terms = () => {
  return (
    <>
      <Navbar />
      <div className="page-dark">
        <div className="container-wide">
          <main style={{
            maxWidth: 840, 
            margin: '0 auto', 
            padding: '48px 20px',
            background: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            <h1 style={{
              fontSize: 'clamp(28px,4vw,40px)', 
              lineHeight: 1.2, 
              margin: '0 0 12px',
              color: '#0f172a',
              fontWeight: 'bold'
            }}>
              Terms of Service
            </h1>
            <div style={{
              color: '#64748b', 
              fontSize: 14, 
              borderBottom: '1px solid #e2e8f0', 
              paddingBottom: 16, 
              marginBottom: 24
            }}>
              Last updated: September 2, 2025
            </div>

            <section style={{
              border: '1px solid #e2e8f0', 
              borderRadius: 16, 
              padding: 24, 
              marginBottom: 24,
              background: '#f8fafc'
            }}>
              <p style={{ color: '#334155', marginBottom: 12 }}>
                These Terms of Service ("<strong>Terms</strong>") govern your access to and use of the Prep101 website, products, and services (collectively, the "<strong>Service</strong>"). By using the Service, you agree to these Terms.
              </p>
              <div style={{
                borderLeft: '4px solid #f59e0b', 
                background: '#fff8eb', 
                padding: '12px 16px', 
                borderRadius: 8, 
                color: '#7c5b09'
              }}>
                <strong>Summary (not a substitute for the full Terms):</strong> You upload audition materials; we generate guidance and tools to help you prepare. We don't promise bookings, we don't give legal/medical advice, and you own your uploads. We own the platform and the generated guide layout/style. Be respectful; don't upload anything you don't have the right to share.
              </div>
            </section>

            <h2 style={{
              fontSize: 'clamp(20px,2.2vw,24px)', 
              margin: '32px 0 8px',
              color: '#0f172a',
              fontWeight: 'bold'
            }}>
              1) Who we are
            </h2>
            <p style={{ color: '#334155' }}>
              Prep101 is a coaching and content service for audition and performance preparation. Contact: <a href="mailto:support@prep101.site" style={{ color: '#1e293b', textDecoration: 'underline' }}>support@prep101.site</a>.
            </p>

            <h2 style={{
              fontSize: 'clamp(20px,2.2vw,24px)', 
              margin: '32px 0 8px',
              color: '#0f172a',
              fontWeight: 'bold'
            }}>
              2) Eligibility & accounts
            </h2>
            <ul style={{ color: '#334155', paddingLeft: 22 }}>
              <li>You must be at least 13 years old (or older where required). If you are under 18, a parent/guardian must approve your use.</li>
              <li>You are responsible for the security of your account and credentials.</li>
            </ul>

            <h2 style={{
              fontSize: 'clamp(20px,2.2vw,24px)', 
              margin: '32px 0 8px',
              color: '#0f172a',
              fontWeight: 'bold'
            }}>
              3) Your uploads & license to us
            </h2>
            <ul style={{ color: '#334155', paddingLeft: 22 }}>
              <li><strong>You own</strong> your scripts/sides, notes, and other material you upload ("<strong>User Content</strong>").</li>
              <li>You grant Prep101 a worldwide, non-exclusive, royalty-free license to host, process, analyze, and display User Content solely to provide and improve the Service (e.g., generating guides, debugging extraction, quality assurance).</li>
              <li>You represent you have the right to upload the material and that it doesn't infringe others' rights.</li>
            </ul>

            <h2 style={{
              fontSize: 'clamp(20px,2.2vw,24px)', 
              margin: '32px 0 8px',
              color: '#0f172a',
              fontWeight: 'bold'
            }}>
              4) Generated outputs
            </h2>
            <ul style={{ color: '#334155', paddingLeft: 22 }}>
              <li>Generated guides are produced using software, templates, and—at times—third-party AI APIs. Guidance is informational and educational; it is <strong>not</strong> legal, medical, or professional advice.</li>
              <li>You may use guides for personal audition prep. The Service's underlying templates, code, and presentation remain Prep101 IP.</li>
              <li>We do not guarantee bookings, callbacks, or outcomes.</li>
            </ul>

            <h2 style={{
              fontSize: 'clamp(20px,2.2vw,24px)', 
              margin: '32px 0 8px',
              color: '#0f172a',
              fontWeight: 'bold'
            }}>
              5) Payments, renewals, refunds
            </h2>
            <ul style={{ color: '#334155', paddingLeft: 22 }}>
              <li>Payments are processed by third parties (e.g., Stripe). You authorize recurring charges where applicable.</li>
              <li>Subscription renewals occur automatically until canceled. You can cancel anytime effective at the end of the current billing period.</li>
              <li>Unless stated otherwise, fees are non-refundable except where required by law.</li>
            </ul>

            <h2 style={{
              fontSize: 'clamp(20px,2.2vw,24px)', 
              margin: '32px 0 8px',
              color: '#0f172a',
              fontWeight: 'bold'
            }}>
              6) Acceptable use
            </h2>
            <ul style={{ color: '#334155', paddingLeft: 22 }}>
              <li>Do not attempt to hack, scrape, or overload the Service.</li>
              <li>Do not upload unlawful, defamatory, infringing, or confidential material you are not authorized to share (including watermarked studio property without permission).</li>
              <li>No harassment, abuse, or misuse of generated content.</li>
            </ul>

            <h2 style={{
              fontSize: 'clamp(20px,2.2vw,24px)', 
              margin: '32px 0 8px',
              color: '#0f172a',
              fontWeight: 'bold'
            }}>
              7) Third-party services & AI
            </h2>
            <p style={{ color: '#334155' }}>
              We may integrate third-party services (e.g., Adobe PDF Services, Anthropic/Claude, email providers). Their terms and privacy practices apply to their components. We may route documents through these providers for extraction and generation.
            </p>

            <h2 style={{
              fontSize: 'clamp(20px,2.2vw,24px)', 
              margin: '32px 0 8px',
              color: '#0f172a',
              fontWeight: 'bold'
            }}>
              8) Privacy
            </h2>
            <p style={{ color: '#334155' }}>
              See our <a href="/privacy" style={{ color: '#1e293b', textDecoration: 'underline' }}>Privacy Policy</a> for how we collect and use data. By using the Service, you consent to those practices.
            </p>

            <h2 style={{
              fontSize: 'clamp(20px,2.2vw,24px)', 
              margin: '32px 0 8px',
              color: '#0f172a',
              fontWeight: 'bold'
            }}>
              9) Intellectual property
            </h2>
            <p style={{ color: '#334155' }}>
              Prep101, the site design, software, and all non-User-Content materials are owned by Prep101 or its licensors. Except for rights expressly granted in these Terms, we reserve all rights.
            </p>

            <h2 style={{
              fontSize: 'clamp(20px,2.2vw,24px)', 
              margin: '32px 0 8px',
              color: '#0f172a',
              fontWeight: 'bold'
            }}>
              10) Disclaimers
            </h2>
            <p style={{ color: '#334155' }}>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE." TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ACCURACY. RESULTS MAY VARY.
            </p>

            <h2 style={{
              fontSize: 'clamp(20px,2.2vw,24px)', 
              margin: '32px 0 8px',
              color: '#0f172a',
              fontWeight: 'bold'
            }}>
              11) Limitation of liability
            </h2>
            <p style={{ color: '#334155' }}>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, PREP101 WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES. OUR AGGREGATE LIABILITY FOR CLAIMS RELATING TO THE SERVICE WILL NOT EXCEED THE GREATER OF (A) AMOUNTS PAID BY YOU IN THE PAST 3 MONTHS OR (B) $100.
            </p>

            <h2 style={{
              fontSize: 'clamp(20px,2.2vw,24px)', 
              margin: '32px 0 8px',
              color: '#0f172a',
              fontWeight: 'bold'
            }}>
              12) Indemnity
            </h2>
            <p style={{ color: '#334155' }}>
              You agree to defend, indemnify, and hold harmless Prep101 from claims arising out of your User Content or your misuse of the Service.
            </p>

            <h2 style={{
              fontSize: 'clamp(20px,2.2vw,24px)', 
              margin: '32px 0 8px',
              color: '#0f172a',
              fontWeight: 'bold'
            }}>
              13) Termination
            </h2>
            <p style={{ color: '#334155' }}>
              We may suspend or terminate access for any breach of these Terms. You may stop using the Service at any time. Sections intended to survive termination will survive.
            </p>

            <h2 style={{
              fontSize: 'clamp(20px,2.2vw,24px)', 
              margin: '32px 0 8px',
              color: '#0f172a',
              fontWeight: 'bold'
            }}>
              14) Governing law & venue
            </h2>
            <p style={{ color: '#334155' }}>
              These Terms are governed by the laws of the State of California, without regard to conflicts of laws. Courts located in Los Angeles County, California will have exclusive jurisdiction, except small-claims matters may be brought in small-claims court.
            </p>

            <h2 style={{
              fontSize: 'clamp(20px,2.2vw,24px)', 
              margin: '32px 0 8px',
              color: '#0f172a',
              fontWeight: 'bold'
            }}>
              15) Changes
            </h2>
            <p style={{ color: '#334155' }}>
              We may update these Terms from time to time. Material changes will be posted with a new "Last updated" date. Continued use constitutes acceptance.
            </p>

            <h2 style={{
              fontSize: 'clamp(20px,2.2vw,24px)', 
              margin: '32px 0 8px',
              color: '#0f172a',
              fontWeight: 'bold'
            }}>
              16) Contact
            </h2>
            <p style={{ color: '#334155' }}>
              Email <a href="mailto:support@prep101.site" style={{ color: '#1e293b', textDecoration: 'underline' }}>support@prep101.site</a> for questions about these Terms.
            </p>

            <footer style={{
              marginTop: 40, 
              fontSize: 14, 
              color: '#64748b',
              borderTop: '1px solid #e2e8f0',
              paddingTop: 20
            }}>
              © {new Date().getFullYear()} Prep101. All rights reserved.
            </footer>
          </main>
        </div>
      </div>
    </>
  );
};

export default Terms;
