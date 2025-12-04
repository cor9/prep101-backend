import React, { useState, useEffect } from 'react';

const statusMessages = [
  { text: "Analyzing your script...", emoji: "📖" },
  { text: "Identifying character relationships...", emoji: "🎭" },
  { text: "Building your character breakdown...", emoji: "✨" },
  { text: "Crafting Uta Hagen's 9 Questions...", emoji: "🎯" },
  { text: "Developing scene-by-scene analysis...", emoji: "🎬" },
  { text: "Finding bold acting choices...", emoji: "⭐" },
  { text: "Creating subtext for every line...", emoji: "💭" },
  { text: "Designing your rehearsal strategy...", emoji: "📋" },
  { text: "Polishing the final guide...", emoji: "✍️" },
  { text: "Almost there—adding finishing touches...", emoji: "🎪" },
];

const LoadingSpinner = () => {
  const [messageIndex, setMessageIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    // Rotate status messages every 25 seconds
    const messageInterval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % statusMessages.length);
    }, 25000);

    // Update elapsed time every second
    const timeInterval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => {
      clearInterval(messageInterval);
      clearInterval(timeInterval);
    };
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const currentStatus = statusMessages[messageIndex];

  return (
    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
      <div style={{ display: 'inline-block', maxWidth: '400px' }}>
        {/* Animated spinner */}
        <div style={{
          width: '80px',
          height: '80px',
          border: '5px solid rgba(251, 191, 36, 0.2)',
          borderTop: '5px solid #fbbf24',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 1.5rem'
        }}></div>

        {/* Main status message */}
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: '700',
          color: '#fbbf24',
          marginBottom: '0.75rem',
          minHeight: '2rem',
          transition: 'opacity 0.3s ease'
        }}>
          {currentStatus.emoji} {currentStatus.text}
        </h3>

        {/* Elapsed time */}
        <p style={{
          color: '#9ca3af',
          fontSize: '0.875rem',
          marginBottom: '1rem'
        }}>
          Time elapsed: {formatTime(elapsedTime)}
        </p>

        {/* Progress indicator dots */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '1rem'
        }}>
          {statusMessages.slice(0, 5).map((_, index) => (
            <div
              key={index}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: index <= messageIndex ? '#fbbf24' : 'rgba(251, 191, 36, 0.2)',
                transition: 'background 0.3s ease'
              }}
            />
          ))}
        </div>

        {/* Helpful tip */}
        <div style={{
          background: 'rgba(251, 191, 36, 0.1)',
          borderRadius: '12px',
          padding: '1rem',
          marginTop: '1rem'
        }}>
          <p style={{
            color: '#e5e7eb',
            fontSize: '0.875rem',
            margin: 0
          }}>
            <strong style={{ color: '#fbbf24' }}>Pro tip:</strong> Guides typically take 3-6 minutes.
            Complex scripts or multiple files may take longer. Your guide is being crafted by AI
            using professional acting methodology.
          </p>
        </div>
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
