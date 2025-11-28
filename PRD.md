# PREP101 Product Requirements Document (PRD)

**Version**: 1.0  
**Last Updated**: October 8, 2025  
**Product Owner**: Corey Ralston  
**Status**: Production (Live)

---

## Executive Summary

PREP101 is an AI-powered acting audition preparation platform that generates personalized, professional-quality audition guides for actors. By combining expert acting methodology with advanced AI technology (Claude Sonnet 4), PREP101 transforms script sides into comprehensive, actionable prep guides that help actors book more roles.

**Website**: https://prep101.site  
**Target Market**: Professional and aspiring actors preparing for auditions  
**Current Stage**: Live production, post-MVP

---

## Product Vision

### Mission
Democratize professional-level audition preparation for all actors, regardless of budget or access to coaching.

### Vision Statement
PREP101 will become the #1 digital acting coach, helping thousands of actors book roles by providing instant, personalized, and expert-level audition preparation at a fraction of the cost of traditional coaching.

### Value Proposition
- **For Actors**: Get expert-level audition prep in 2-5 minutes vs. hours of self-prep or $100+ for a coach
- **For Busy Actors**: Upload sides, get instant professional guidance, practice immediately
- **For Budget-Conscious Actors**: $9-29/month vs. $50-150 per session with a coach

---

## Product Goals

### North Star Metric
**Monthly Active Users (MAU)** generating guides and booking auditions

### Key Metrics (90-day targets)
- **User Acquisition**: 500 MAU
- **Conversion Rate**: 15% free → paid
- **Retention**: 70% month-over-month
- **Guide Quality**: 4.5+ star average rating
- **Customer LTV**: $200+
- **Churn**: <10% monthly

---

## Target Users

### Primary Personas

#### 1. **Sarah - The Working Actor**
- **Age**: 28-45
- **Experience**: 3-10 years professional
- **Pain Points**: 
  - Auditions on short notice (24-48 hours)
  - Can't afford $100+ per coaching session
  - Needs structured prep approach
- **Goals**: Book more roles, improve callback rate
- **Tech Savvy**: High
- **Budget**: $20-50/month for tools

#### 2. **Marcus - The Aspiring Actor**
- **Age**: 20-28
- **Experience**: Student/early career
- **Pain Points**:
  - Limited access to professional coaching
  - Uncertain about prep methodology
  - Overwhelming amount of conflicting advice online
- **Goals**: Learn professional techniques, build confidence
- **Tech Savvy**: Very high
- **Budget**: $10-20/month

#### 3. **Jessica - The Parent Manager**
- **Age**: 35-50
- **Experience**: Managing child actor(s)
- **Pain Points**:
  - Child needs age-appropriate guidance
  - Limited time to prep kids for auditions
  - Expensive coaching sessions add up
- **Goals**: Help child succeed, manage costs
- **Tech Savvy**: Medium
- **Budget**: $30-50/month per child

### Secondary Personas
- Acting coaches (supplement their teaching)
- Casting directors (understand actors' prep process)
- Drama school students (learning tool)

---

## Core Features

### 1. **Intelligent PDF Upload** ✅ LIVE
**Priority**: P0 (Must-Have)

**User Story**: As an actor, I want to upload my audition sides (PDF) so the system can analyze my script.

**Functionality**:
- Drag-and-drop PDF upload
- Multi-file support (full script + sides)
- Adobe PDF Services extraction (primary)
- Basic PDF parser fallback
- OCR fallback for scanned PDFs
- Content quality validation
- File size limit: 10MB per file

**Success Criteria**:
- 95%+ successful text extraction
- Support for 95%+ of PDF formats
- < 5 second upload + extraction time
- Clear error messages for failed uploads

**Technical Notes**:
- Uses Adobe PDF Extract API
- Falls back to pdf-parse library
- OCR via Claude Vision API
- Content quality thresholds: min 25 words, <15% repetition

---

### 2. **Smart Guide Generation** ✅ LIVE
**Priority**: P0 (Must-Have)

**User Story**: As an actor, I want to receive a comprehensive audition guide based on my script and role details.

**Functionality**:
- RAG-enhanced AI generation
- Uses Corey Ralston's methodology files
- Searches for relevant examples/patterns
- Generates personalized analysis
- Processing time: 2-5 minutes
- HTML output optimized for printing/reading

**Guide Sections**:
1. **Script Analysis**
   - Scene breakdown
   - Character objectives
   - Given circumstances
   - Relationship dynamics

2. **Character Development**
   - Backstory
   - Psychology
   - Physical/vocal choices
   - Emotional preparation

3. **Scene Work**
   - Beat breakdown
   - Tactics and actions
   - Subtext analysis
   - Moment-to-moment work

4. **Audition Strategy**
   - First impression tips
   - Common pitfalls to avoid
   - Adjustment ideas
   - Room etiquette

5. **Practical Exercises**
   - Warm-up routines
   - Rehearsal techniques
   - Self-tape tips (if applicable)

**Success Criteria**:
- 90%+ user satisfaction with guide quality
- <5 minute generation time (95th percentile)
- 85%+ of guides lead to user feeling "more prepared"
- Professional, actionable advice

**Technical Notes**:
- Claude Sonnet 4 with 16K token context
- RAG retrieval from methodology database
- Strict policy against hallucinating production details
- Evidence-based recommendations only

---

### 3. **Child Actor Guide** ✅ LIVE
**Priority**: P1 (Should-Have)

**User Story**: As a parent/young actor, I want a simplified, age-appropriate version of the guide.

**Functionality**:
- Optional checkbox during generation
- Simplified language (ages 8-12)
- Fun, encouraging tone
- Visual elements (emojis, colors)
- Shorter, digestible sections
- Parent-friendly terminology

**Success Criteria**:
- 80%+ parent approval rating
- Appropriate reading level (6th grade)
- Engaging for kids
- Maintains professional guidance quality

---

### 4. **Authentication & User Management** ✅ LIVE
**Priority**: P0 (Must-Have)

**User Story**: As a user, I want to create an account and manage my subscription.

**Functionality**:
- Supabase Auth integration
- Email/password signup
- Email verification
- Password reset flow
- Social auth (future: Google, Apple)
- Account dashboard
- Subscription management

**Success Criteria**:
- <30 second signup flow
- <5% auth error rate
- 95%+ email deliverability
- Secure token management

---

### 5. **Subscription & Billing** ✅ LIVE
**Priority**: P0 (Must-Have)

**User Story**: As a user, I want to upgrade my plan to generate more guides per month.

**Subscription Tiers**:

| Tier | Price | Guides/Month | Features |
|------|-------|--------------|----------|
| **Free** | $0 | 0 (promo codes only) | Redeem promo codes for free guides |
| **Starter** | $9 | 5 | Full guides, child guides |
| **Pro** | $19 | 20 | Priority generation, no watermark |
| **Premium** | $39 | Unlimited | All features, priority support |

**Functionality**:
- Stripe integration
- Monthly/annual billing
- Upgrade/downgrade flow
- Usage tracking
- Renewal management
- Payment method management
- Invoice history

**Success Criteria**:
- <5% payment failure rate
- <2% churn on payment issues
- Clear upgrade CTA
- Seamless billing experience

---

### 6. **Guide Library & History** 🚧 PARTIAL
**Priority**: P1 (Should-Have)

**User Story**: As an actor, I want to save and access all my previous guides.

**Current State**: 
- ✅ Guides stored in database
- ✅ Basic account page shows guides
- ❌ No search/filter
- ❌ No favorites/tags
- ❌ Limited metadata display

**Desired Functionality**:
- View all past guides
- Search by character/production name
- Filter by date, production type, genre
- Favorite/bookmark guides
- Tag guides for organization
- Share guides (public link)
- Export to PDF
- Print-optimized view

**Success Criteria**:
- Find any guide in <10 seconds
- 90%+ of users utilize guide history
- Average 3+ guide re-visits per user

---

## Technical Architecture

### Frontend
- **Framework**: React 18.3
- **Routing**: React Router 7.8
- **Styling**: CSS Modules + Tailwind-inspired utilities
- **State**: React Context (Auth, Stripe)
- **Hosting**: Netlify
- **Domain**: prep101.site

### Backend
- **Framework**: Express.js + Node.js
- **API**: RESTful
- **AI**: Anthropic Claude Sonnet 4
- **PDF**: Adobe PDF Services + pdf-parse + OCR fallback
- **Hosting**: Vercel Serverless Functions
- **API URL**: prep101-api.vercel.app

### Database & Auth
- **Platform**: Supabase
- **Database**: PostgreSQL
- **Auth**: Supabase Auth
- **Storage**: Not yet implemented (future: guide PDFs)

### Payments
- **Provider**: Stripe
- **Integration**: @stripe/stripe-js
- **Features**: Subscriptions, invoices, webhook handling

### Key Dependencies
- `@anthropic-ai/sdk` - AI generation
- `@adobe/pdfservices-node-sdk` - PDF extraction
- `@supabase/supabase-js` - Auth & database
- `stripe` - Payments
- `express-rate-limit` - API protection
- `bcryptjs` - Legacy password hashing

---

## User Flows

### Primary Flow: Generate First Guide

1. **Landing Page** → Value prop, CTA "Get Started"
2. **Signup** → Email, password, name (30 sec)
3. **Dashboard** → Upload PDF prompt
4. **Upload** → Drag/drop sides PDF
5. **Form** → Fill character details
   - Character name
   - Production title
   - Production type (Film/TV/Theater/etc.)
   - Genre
   - Optional: storyline, breakdown, notes
6. **Generate** → Loading screen (2-5 min)
7. **Guide Opens** → New tab, printable HTML
8. **Return to Dashboard** → See usage (1/1 used)
9. **Upgrade Prompt** → Reached limit, upgrade CTA

### Secondary Flow: Subscription Upgrade

1. **Dashboard** → "Upgrade" CTA
2. **Pricing Page** → Compare plans
3. **Select Plan** → Choose tier
4. **Stripe Checkout** → Enter payment
5. **Success** → Redirect to dashboard
6. **Confirmation** → Updated limits visible

---

## Non-Functional Requirements

### Performance
- **Page Load**: <2 seconds (LCP)
- **API Response**: <200ms (p95)
- **Guide Generation**: <5 minutes (p95)
- **PDF Upload**: <5 seconds extraction

### Scalability
- **Concurrent Users**: 100+
- **Guides/Day**: 500+
- **Storage**: 10GB+ (guides)
- **Database**: 10K+ users

### Security
- **Auth**: JWT + Supabase tokens
- **API**: Rate limiting (100 req/15min)
- **Data**: Encrypted at rest (Supabase)
- **PII**: GDPR/CCPA compliant
- **Payments**: PCI compliant (Stripe)

### Reliability
- **Uptime**: 99.5%+ (Vercel SLA)
- **Error Rate**: <1%
- **Monitoring**: Vercel logs
- **Backup**: Daily Supabase snapshots

### Accessibility
- **WCAG**: 2.1 Level AA (goal)
- **Screen Readers**: Compatible
- **Keyboard**: Full navigation
- **Contrast**: AAA ratios

---

## Known Issues & Technical Debt

### High Priority
1. ❌ **Loading Screen Not Showing** - Built but not deployed to frontend
2. ❌ **Guide Library** - Limited functionality, no search/filter
3. ❌ **Error Handling** - Generic error messages, need specifics
4. ❌ **Mobile Optimization** - Desktop-first, mobile needs work

### Medium Priority
1. ⚠️ **PDF Extraction** - Adobe API occasionally fails, needs better fallback
2. ⚠️ **Rate Limiting** - Currently basic, needs per-user tracking
3. ⚠️ **Guide Persistence** - In-memory upload storage expires
4. ⚠️ **Email** - No transactional emails (welcome, receipts, etc.)

### Low Priority
1. 💡 **Analytics** - No user behavior tracking
2. 💡 **A/B Testing** - No experimentation framework
3. 💡 **Internationalization** - English only
4. 💡 **Dark Mode** - Not implemented

---

## Roadmap

### Q4 2025 - Stabilization & Growth

**Month 1: October**
- ✅ Fix critical bugs (login, 503 errors, PDF uploads)
- ✅ Deploy loading screen
- 🎯 Implement guide search/filter
- 🎯 Add email notifications
- 🎯 Mobile optimization pass

**Month 2: November**
- 🎯 Analytics integration (PostHog/Mixpanel)
- 🎯 User feedback system (ratings/reviews)
- 🎯 Referral program
- 🎯 Marketing site improvements

**Month 3: December**
- 🎯 Guide sharing (public links)
- 🎯 PDF export
- 🎯 Social proof (testimonials page)
- 🎯 Holiday promotion

### Q1 2026 - Feature Expansion

**January**
- Advanced guide customization
- Voice memo uploads (describe role)
- Video scene uploads
- Coach collaboration features

**February**
- Self-tape integration
- Guide templates by genre
- Success tracking (bookings)
- Community features (forum)

**March**
- Mobile app (React Native)
- Offline mode
- Push notifications
- In-app purchases

### Q2 2026 - Scale & Monetization

**April-June**
- B2B offering (drama schools)
- API access (third-party apps)
- Coaching marketplace
- Premium methodology content

---

## Success Criteria

### Launch Success (30 Days)
- ✅ 50+ registered users
- ✅ 100+ guides generated
- ✅ <5% error rate
- ✅ 10+ paid subscribers

### Growth Phase (90 Days)
- 🎯 500+ MAU
- 🎯 1000+ guides generated
- 🎯 50+ paid subscribers
- 🎯 $1000+ MRR
- 🎯 4.5+ star rating

### Scale Phase (180 Days)
- 🎯 2000+ MAU
- 🎯 10,000+ guides generated
- 🎯 300+ paid subscribers
- 🎯 $5000+ MRR
- 🎯 Break-even on costs

---

## Competitive Analysis

### Direct Competitors
1. **Acting Coach Apps**
   - One-on-One
   - WeAudition
   - Higher cost, human coaches

2. **DIY Resources**
   - Books, YouTube videos
   - Free but time-consuming
   - No personalization

3. **Acting Classes**
   - $200-500/month
   - Group setting, not audition-specific

### Competitive Advantages
- ✅ **Speed**: 5 minutes vs. hours/days
- ✅ **Cost**: $9-39/month vs. $50-150/session
- ✅ **Quality**: Professional methodology
- ✅ **Personalization**: Script-specific guidance
- ✅ **Accessibility**: 24/7 availability

### Differentiators
- Corey Ralston's proven methodology
- RAG-powered personalization
- Child actor support
- Instant turnaround

---

## Risk Assessment

### High Risk
- **AI Quality**: Claude API changes/degrades
  - *Mitigation*: Version pinning, fallback models
- **Legal**: Copyright issues with methodologies
  - *Mitigation*: Original content, clear licensing
- **Competition**: Larger players enter space
  - *Mitigation*: Strong brand, quality focus

### Medium Risk
- **Costs**: AI API costs scale with usage
  - *Mitigation*: Usage limits, efficient prompts
- **Churn**: Users don't renew subscriptions
  - *Mitigation*: Engagement features, value delivery
- **Technical**: Vercel/Supabase outages
  - *Mitigation*: Multi-region, monitoring, backups

### Low Risk
- **Adoption**: Actors resist AI-generated content
  - *Mitigation*: Education, transparency, quality
- **Seasonality**: Pilot season fluctuations
  - *Mitigation*: Annual plans, content marketing

---

## Open Questions

1. **Should we offer one-time purchases** (single guide vs. subscription)?
2. **What's the optimal free tier limit** (1 guide vs. 3)?
3. **Should we add coach review/feedback** as premium feature?
4. **Do users want collaboration features** (share with scene partners)?
5. **Is there a market for enterprise** (drama schools, agents)?
6. **Should we expand to other creative fields** (music auditions, presentations)?

---

## Appendix

### A. Methodology Sources
- Uta Hagen's 9 Questions
- Stanislavski System
- Meisner Technique
- Practical Aesthetics
- Corey Ralston's original frameworks

### B. Technical Documentation
- See: `SUPABASE_AUTH_FIX.md`
- See: `DEPLOYMENT_SUCCESS.md`
- See: `DECISIONS.md`

### C. Design System
- Colors: Gold (#ffc107), Dark (#1a1a1a), White (#ffffff)
- Fonts: System fonts (San Francisco, Segoe UI)
- Components: Shared CSS in `shared.css`

### D. Contact
- **Product Owner**: Corey Ralston
- **Technical Contact**: [Via GitHub]
- **Support**: support@prep101.site (to be set up)

---

**Document History**
- v1.0 - October 8, 2025 - Initial PRD created
- Next Review: November 1, 2025








