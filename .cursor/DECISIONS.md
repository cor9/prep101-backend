# Project Decisions & Learnings

## Recent Learnings & Decisions

### Architecture Mismatch Discovery
- **Issue**: Initially assumed `server.js` was the main backend, but user confirmed `simple-backend-rag.js` is the active backend
- **Decision**: Focus all backend modifications on `simple-backend-rag.js`
- **Impact**: Avoided implementing features in the wrong file

### Guide Persistence Issues
- **Problem**: Newly created guides not saving to user accounts
- **Root Cause**: Multiple issues:
  1. Frontend using placeholder auth tokens
  2. Backend not properly validating user existence before guide creation
  3. Account page using mock data instead of real API calls
- **Solution**: 
  1. Updated frontend to use real auth tokens
  2. Modified backend to verify user exists before guide creation
  3. Updated Account page to fetch real guides from API

### Authentication Flow
- **Discovery**: Frontend components were hardcoded to call remote server (`childactor101.sbs`)
- **Solution**: Created centralized API configuration (`client/src/config/api.js`) defaulting to localhost
- **Files Updated**: `AuthContext.js`, `FileUpload.js`, `Dashboard.js`, `Account.js`

### Database Integration
- **Issue**: Guide creation was failing due to foreign key constraint violations
- **Solution**: Added proper user verification in backend before guide creation
- **Result**: Guides now properly save to authenticated user accounts

### Account Page Display
- **Problem**: Account page showed mock data instead of real user guides
- **Solution**: Implemented real API calls to fetch user guides
- **Enhancement**: Added PDF download and email functionality

## NEW: Promo Code System for Free Guides (November 2025)

### Change from Monthly Free Guide to Promo Code System

**Problem**: Free tier automatically granted 1 guide per month, which could be exploited and didn't provide control over user acquisition

**Solution**: Implemented promo code system where free guides are only available via redemption codes

### Implementation Details

#### Database Schema
- **PromoCode Model**: Stores promo codes with type, grants, usage limits, and expiration
- **PromoCodeRedemption Model**: Tracks which users have redeemed which codes and when
- **User Model Update**: Changed `guidesLimit` default from 1 to 0 for free users

#### Promo Code Features
- **Code Types**: `free_guides`, `discount`, `upgrade`
- **Usage Controls**:
  - Max total redemptions per code
  - Max redemptions per user
  - Expiration dates
  - Start dates for scheduled releases
- **Admin Management**: Create, deactivate, and track promo codes
- **User Redemption**: Simple redemption flow via API

#### API Endpoints
- `POST /api/promo-codes/redeem` - Redeem a promo code (user)
- `GET /api/promo-codes/my-redemptions` - View redemption history (user)
- `POST /api/promo-codes/create` - Create new promo code (admin)
- `GET /api/promo-codes/admin/all` - List all codes (admin)
- `PUT /api/promo-codes/admin/:id/deactivate` - Deactivate code (admin)

#### Migration Strategy
- Created migration script to update existing users
- Free users' `guidesLimit` changed from 1 to 0
- Sample code `WELCOME2024` created for testing

#### Benefits
- **Better control**: Can create targeted campaigns
- **Tracking**: Know exactly which codes drive signups
- **Flexibility**: Different codes for different purposes (influencer codes, seasonal promotions)
- **Anti-abuse**: Limit redemptions per user and globally

### Future Enhancements
- Frontend UI for code redemption
- Analytics dashboard for code performance
- Automatic code generation for partnerships
- Time-limited flash codes

## Technical Decisions Made

### API Configuration Centralization
- **Decision**: Created `client/src/config/api.js` for centralized API URL management
- **Benefit**: Single source of truth for API endpoints, easier environment switching

### Backend Authentication
- **Decision**: Strict user verification before guide creation
- **Benefit**: Prevents orphaned guides and maintains data integrity

### PDF & Email Features
- **Decision**: Integrated Adobe PDF Services and Nodemailer for guide distribution
- **Implementation**: Added endpoints for PDF generation and email sending

## NEW: Child's Guide Implementation

### Feature Overview
- **Purpose**: Generate simplified, age-appropriate guides for young actors (ages 8-12)
- **Workflow**: Two-pass system - primary guide first, then child guide if requested

### Technical Implementation

#### Frontend Changes
- **GuideForm.js**: Added checkbox for "Would you like a simplified Child's Guide?" 
- **Conditional Display**: Checkbox only appears for roles age 12 and under
- **User Experience**: Clear explanation and confirmation when selected

#### Backend Changes
- **Guide Model**: Added fields for child guide tracking:
  - `childGuideRequested`: Boolean flag
  - `childGuideHtml`: Content of the child guide
  - `childGuideCompleted`: Status flag
- **Color Theme System**: Dynamic color selection based on:
  - Character type (princess, prince, superhero, etc.)
  - Production genre (comedy, drama, musical, action)
  - Seasonal themes (Christmas, Halloween, Easter, Summer)
  - Age-appropriate adjustments (baby-friendly, teen-friendly)
- **Second Pass Generation**: Separate API call for child guide using:
  - Parent guide as reference
  - Child-friendly methodology files
  - Simplified language and structure
  - Youthful HTML styling with embedded CSS

#### Color Theme Logic
- **Character-Based**: Princess (pink/gold), Prince (blue/gold), Superhero (red/gold)
- **Genre-Based**: Comedy (yellow/pink), Drama (purple/teal), Musical (pink/gold)
- **Seasonal**: Christmas (red/green), Halloween (purple/orange), Easter (pink/green)
- **Age-Adjusted**: Softer pastels for very young, sophisticated colors for teens

#### HTML Template System
- **Responsive Design**: Mobile-friendly layout with rounded corners and shadows
- **Fun Typography**: Google Fonts (Comic Neue, Fredoka One, Bubblegum Sans)
- **CSS Classes**: Predefined styles for sections, highlights, tips, and numbered lists
- **Dynamic Colors**: Theme colors applied throughout the design

### Methodology Integration
- **Reference Files**: Uses existing child guide examples from `/methodology`:
  - `tucker_kid_friendly_guide.html`
  - `eloise_kid_guide.html` 
  - `alanna_audition_guide.html`
  - `alma-guide.html`
- **Content Adaptation**: Rewrites parent guide content in child-friendly language
- **Structure Consistency**: Maintains 8-section format with clear headers

### User Experience
- **Dual Output**: Both guides generated and displayed separately
- **Timing**: Child guide opens 1 second after parent guide to avoid overwhelming
- **Visual Distinction**: Different window titles and color schemes
- **Accessibility**: Clear, scannable content with emoji accents

## Future Considerations

### Performance Optimization
- **Background Processing**: Consider moving child guide generation to background job
- **Caching**: Cache methodology files to reduce API calls
- **Progressive Loading**: Show parent guide immediately, child guide when ready

### Enhanced Theming
- **User Preferences**: Allow users to override automatic color selection
- **Custom Themes**: Support for user-defined color schemes
- **Seasonal Updates**: Automatic theme switching based on current date

### Content Personalization
- **Age-Specific Content**: More granular age-based content adaptation
- **Learning Styles**: Different formats for visual, auditory, kinesthetic learners
- **Progress Tracking**: Save child guide completion status for future reference

## Technical Debt & Improvements

### Code Organization
- **Function Separation**: Consider moving color theme logic to separate utility file
- **Template Management**: HTML templates could be externalized for easier maintenance
- **Error Handling**: More robust error handling for child guide generation failures

### Testing & Validation
- **Unit Tests**: Add tests for color theme selection logic
- **Integration Tests**: Test complete guide generation workflow
- **User Testing**: Validate child guide readability and engagement

### Documentation
- **API Documentation**: Document new child guide endpoints
- **User Guide**: Create guide for parents on using child guides
- **Developer Guide**: Document color theme system and customization options
