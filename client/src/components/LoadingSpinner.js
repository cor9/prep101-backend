import React from 'react';

const LoadingSpinner = () => {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 0' }}>
      <div style={{ display: 'inline-block' }}>
        <div style={{
          width: '64px',
          height: '64px',
          border: '4px solid #d1fae5',
          borderTop: '4px solid #14b8a6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 1.5rem'
        }}></div>
        <h3 style={{ 
          fontSize: '1.5rem', 
          fontWeight: '600', 
          color: '#374151',
          marginBottom: '0.5rem'
        }}>
          Creating your personalized audition guide...
        </h3>
        <p style={{ color: '#6b7280' }}>
          This usually takes 30-60 seconds
        </p>
      </div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LoadingSpinner;
