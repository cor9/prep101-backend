import React, { useState } from 'react';

const GuideForm = ({ onSubmit, hasFile }) => {
  const [formData, setFormData] = useState({
    characterName: '',
    productionTitle: '',
    productionType: '',
    roleSize: '',
    genre: '',
    storyline: '',
    characterBreakdown: '',
    callbackNotes: '',
    focusArea: '',
    childGuideRequested: false
  });

  const genreSuggestions = [
    'Single-camera comedy',
    'Multi-camera sitcom',
    'Medical drama',
    'Legal drama',
    'Teen drama',
    'Horror thriller',
    'Romantic comedy',
    'Action adventure',
    'Sci-fi drama',
    'Musical theater',
    'Crime procedural',
    'Family comedy',
    'Psychological thriller',
    'Historical drama',
    'Fantasy adventure',
    'Workplace comedy',
    'Coming-of-age drama',
    'Dark comedy',
    'Supernatural drama',
    'Sports drama'
  ];

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate required fields
    const required = ['characterName', 'productionTitle', 'productionType', 'roleSize', 'genre'];
    const missing = required.filter(field => !formData[field]);
    
    if (missing.length > 0) {
      alert(`Please fill in all required fields: ${missing.join(', ')}`);
      return;
    }

    onSubmit(formData);
  };

  const isFormValid = formData.characterName && formData.productionTitle && 
                     formData.productionType && formData.roleSize && formData.genre && hasFile;

  const inputStyle = {
    width: '100%',
    padding: '0.75rem',
    border: '2px solid #e5e7eb',
    borderRadius: '0.75rem',
    fontSize: '1rem',
    transition: 'all 0.3s ease',
    outline: 'none'
  };

  const inputFocusHandler = (e) => {
    e.target.style.borderColor = '#2dd4bf';
    e.target.style.boxShadow = '0 0 0 3px rgba(45, 212, 191, 0.1)';
  };

  const inputBlurHandler = (e) => {
    e.target.style.borderColor = '#e5e7eb';
    e.target.style.boxShadow = 'none';
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Character Information */}
      <div>
        <h3 style={{ 
          fontSize: '1.5rem', 
          fontWeight: 'bold', 
          color: '#374151',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          🎭 Character Information
        </h3>
        <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
          Tell us about the role you're auditioning for. The more details you provide, 
          the more personalized your guide will be.
        </p>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '1.5rem',
          marginBottom: '1.5rem'
        }}>
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '0.875rem', 
              fontWeight: '600', 
              color: '#374151',
              marginBottom: '0.5rem',
              textTransform: 'uppercase',
              letterSpacing: '0.025em'
            }}>
              Character Name *
            </label>
            <input
              type="text"
              name="characterName"
              value={formData.characterName}
              onChange={handleChange}
              placeholder="e.g., CeCe Rodriguez"
              style={inputStyle}
              onFocus={inputFocusHandler}
              onBlur={inputBlurHandler}
              required
            />
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '0.875rem', 
              fontWeight: '600', 
              color: '#374151',
              marginBottom: '0.5rem',
              textTransform: 'uppercase',
              letterSpacing: '0.025em'
            }}>
              Production Title *
            </label>
            <input
              type="text"
              name="productionTitle"
              value={formData.productionTitle}
              onChange={handleChange}
              placeholder="e.g., How to Be a Drama Queen"
              style={inputStyle}
              onFocus={inputFocusHandler}
              onBlur={inputBlurHandler}
              required
            />
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '0.875rem', 
              fontWeight: '600', 
              color: '#374151',
              marginBottom: '0.5rem',
              textTransform: 'uppercase',
              letterSpacing: '0.025em'
            }}>
              Production Type *
            </label>
            <select
              name="productionType"
              value={formData.productionType}
              onChange={handleChange}
              style={inputStyle}
              onFocus={inputFocusHandler}
              onBlur={inputBlurHandler}
              required
            >
              <option value="">Select type...</option>
              <option value="film">Feature Film</option>
              <option value="tv-series">TV Series</option>
              <option value="short-film">Short Film</option>
              <option value="theater">Theater</option>
              <option value="commercial">Commercial</option>
              <option value="student-film">Student Film</option>
            </select>
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '0.875rem', 
              fontWeight: '600', 
              color: '#374151',
              marginBottom: '0.5rem',
              textTransform: 'uppercase',
              letterSpacing: '0.025em'
            }}>
              Role Size *
            </label>
            <select
              name="roleSize"
              value={formData.roleSize}
              onChange={handleChange}
              style={inputStyle}
              onFocus={inputFocusHandler}
              onBlur={inputBlurHandler}
              required
            >
              <option value="">Select role size...</option>
              <option value="lead">Lead</option>
              <option value="supporting">Supporting</option>
              <option value="series-regular">Series Regular</option>
              <option value="recurring">Recurring</option>
              <option value="guest-star">Guest Star</option>
              <option value="co-star">Co-Star</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ 
            display: 'block', 
            fontSize: '0.875rem', 
            fontWeight: '600', 
            color: '#374151',
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.025em'
          }}>
            Genre *
          </label>
          <input
            type="text"
            name="genre"
            value={formData.genre}
            onChange={handleChange}
            placeholder="e.g., Single-cam comedy, Medical drama, Teen romance"
            list="genre-suggestions"
            style={inputStyle}
            onFocus={inputFocusHandler}
            onBlur={inputBlurHandler}
            required
          />
          <datalist id="genre-suggestions">
            {genreSuggestions.map((genre, index) => (
              <option key={index} value={genre} />
            ))}
          </datalist>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ 
            display: 'block', 
            fontSize: '0.875rem', 
            fontWeight: '600', 
            color: '#374151',
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.025em'
          }}>
            Storyline/Project Description (if available)
          </label>
          <textarea
            name="storyline"
            value={formData.storyline}
            onChange={handleChange}
            placeholder="Brief description of the show/film's storyline or premise..."
            rows="3"
            style={{
              ...inputStyle,
              minHeight: '90px',
              resize: 'vertical'
            }}
            onFocus={inputFocusHandler}
            onBlur={inputBlurHandler}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ 
            display: 'block', 
            fontSize: '0.875rem', 
            fontWeight: '600', 
            color: '#374151',
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.025em'
          }}>
            Character Breakdown (if available)
          </label>
          <textarea
            name="characterBreakdown"
            value={formData.characterBreakdown}
            onChange={handleChange}
            placeholder="Paste any character description provided by casting..."
            rows="3"
            style={{
              ...inputStyle,
              minHeight: '90px',
              resize: 'vertical'
            }}
            onFocus={inputFocusHandler}
            onBlur={inputBlurHandler}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ 
            display: 'block', 
            fontSize: '0.875rem', 
            fontWeight: '600', 
            color: '#374151',
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.025em'
          }}>
            Callback Notes (if applicable)
          </label>
          <textarea
            name="callbackNotes"
            value={formData.callbackNotes}
            onChange={handleChange}
            placeholder="Any specific direction from casting about adjustments or focus areas..."
            rows="3"
            style={{
              ...inputStyle,
              minHeight: '90px',
              resize: 'vertical'
            }}
            onFocus={inputFocusHandler}
            onBlur={inputBlurHandler}
          />
        </div>
      </div>

      {/* Focus Areas */}
      <div>
        <h3 style={{ 
          fontSize: '1.5rem', 
          fontWeight: 'bold', 
          color: '#374151',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          🎯 Focus Areas (Optional)
        </h3>
        <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
          Is there a specific aspect of your performance you'd like to emphasize? 
          Leave blank for a balanced approach.
        </p>

        <div>
          <label style={{ 
            display: 'block', 
            fontSize: '0.875rem', 
            fontWeight: '600', 
            color: '#374151',
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.025em'
          }}>
            Primary Focus
          </label>
          <select
            name="focusArea"
            value={formData.focusArea}
            onChange={handleChange}
            style={inputStyle}
            onFocus={inputFocusHandler}
            onBlur={inputBlurHandler}
          >
            <option value="">Select focus area (optional)...</option>
            <option value="vulnerability">Vulnerability & Emotional Depth</option>
            <option value="strength">Strength & Confidence</option>
            <option value="humor">Comedy & Timing</option>
            <option value="intensity">Intensity & Drama</option>
            <option value="range">Emotional Range</option>
            <option value="bold-choices">Bold Choices & Risk-Taking</option>
          </select>
        </div>
      </div>

      {/* Child's Guide Option */}
      <div>
        <h3 style={{ 
          fontSize: '1.5rem', 
          fontWeight: 'bold', 
          color: '#374151',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          🌟 Child's Guide Option
        </h3>
        <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
          For young actors age 12 and under, we can create a simplified, fun guide that's easier to understand and follow.
        </p>

        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.75rem',
          padding: '1rem',
          background: '#f8fafc',
          border: '2px solid #e2e8f0',
          borderRadius: '0.75rem'
        }}>
          <input
            type="checkbox"
            id="childGuideRequested"
            name="childGuideRequested"
            checked={formData.childGuideRequested}
            onChange={(e) => setFormData({
              ...formData,
              childGuideRequested: e.target.checked
            })}
            style={{
              width: '1.25rem',
              height: '1.25rem',
              accentColor: '#10b981'
            }}
          />
          <label 
            htmlFor="childGuideRequested"
            style={{
              fontSize: '1rem',
              fontWeight: '600',
              color: '#374151',
              cursor: 'pointer'
            }}
          >
            Would you like a simplified Child's Guide? (For roles age 12 and under only)
          </label>
        </div>
        
        {formData.childGuideRequested && (
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: '0.5rem',
            color: '#065f46'
          }}>
            <p style={{ margin: 0, fontSize: '0.875rem' }}>
              <strong>Great choice!</strong> We'll create both guides for you:
              <br />• A comprehensive guide for parents/coaches
              <br />• A fun, simplified guide perfect for young actors
            </p>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={!isFormValid}
        style={{
          width: '100%',
          padding: '1rem 2rem',
          borderRadius: '1rem',
          fontSize: '1.125rem',
          fontWeight: 'bold',
          color: 'white',
          border: 'none',
          cursor: isFormValid ? 'pointer' : 'not-allowed',
          background: isFormValid 
            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
            : '#9ca3af',
          transition: 'all 0.3s ease',
          boxShadow: isFormValid ? '0 6px 20px rgba(16, 185, 129, 0.3)' : 'none'
        }}
        onMouseOver={(e) => {
          if (isFormValid) {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 10px 30px rgba(16, 185, 129, 0.4)';
          }
        }}
        onMouseOut={(e) => {
          if (isFormValid) {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.3)';
          }
        }}
      >
        {!hasFile ? 'Upload PDF First' : 'Generate My Audition Guide'}
      </button>
    </form>
  );
};

export default GuideForm;
