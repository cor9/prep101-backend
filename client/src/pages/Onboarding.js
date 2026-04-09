import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../contexts/AuthContext';

const roleCards = [
  {
    value: 'actor',
    title: "I'm an actor",
    copy: 'Use Prep101, Reader101, and Bold Choices for your own auditions.',
  },
  {
    value: 'parent',
    title: "I'm a parent/guardian",
    copy: 'Manage a child actor account, guides, and reader support in one place.',
  },
  {
    value: 'both',
    title: 'Both',
    copy: 'Use the tools for yourself and manage child-actor work from the same login.',
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, completeOnboarding } = useAuth();
  const [role, setRole] = useState(user?.account?.profile?.role || 'parent');
  const [defaultView, setDefaultView] = useState(
    user?.account?.profile?.defaultView || 'parent'
  );
  const [actorName, setActorName] = useState(
    user?.account?.activeActor?.actorName ||
      (role === 'actor' || role === 'both' ? user?.name || '' : '')
  );
  const [ageRange, setAgeRange] = useState(user?.account?.activeActor?.ageRange || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const actorLabel = useMemo(() => {
    if (role === 'parent') return "Child actor's name";
    if (role === 'both') return 'Primary actor name';
    return 'Your acting name';
  }, [role]);

  const isChild = role === 'parent';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!actorName.trim()) {
      setError('Actor name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await completeOnboarding({
        role,
        defaultView: role === 'actor' ? 'actor' : defaultView,
        actors: [
          {
            actorName: actorName.trim(),
            ageRange: ageRange.trim(),
            isChild,
          },
        ],
      });
      navigate('/dashboard', { replace: true });
    } catch (submitError) {
      setError(submitError.message || 'Could not save your account setup.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="page-dark">
        <div className="container-wide">
          <div className="page-hero">
            <h1 className="h1-hero">Set Up Your Child Actor 101 Account</h1>
            <p className="h2-hero">
              One login. Shared identity. The right context for every guide.
            </p>
          </div>

          <div className="card-white" style={{ maxWidth: 860, margin: '0 auto 2rem' }}>
            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.5rem' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748b', marginBottom: 12 }}>
                  How are you using this?
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  {roleCards.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        setRole(item.value);
                        if (item.value === 'actor') setDefaultView('actor');
                        if (item.value === 'both' && defaultView !== 'actor' && defaultView !== 'parent') {
                          setDefaultView('actor');
                        }
                        if ((item.value === 'actor' || item.value === 'both') && !actorName) {
                          setActorName(user?.name || '');
                        }
                      }}
                      style={{
                        textAlign: 'left',
                        padding: '1rem',
                        borderRadius: 16,
                        border: role === item.value ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                        background: role === item.value ? '#fff7e6' : '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>{item.title}</div>
                      <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>{item.copy}</div>
                    </button>
                  ))}
                </div>
              </div>

              {role === 'both' && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748b', marginBottom: 12 }}>
                    Default view
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {['actor', 'parent'].map((view) => (
                      <button
                        key={view}
                        type="button"
                        onClick={() => setDefaultView(view)}
                        style={{
                          padding: '10px 16px',
                          borderRadius: 999,
                          border: defaultView === view ? '2px solid #0f172a' : '1px solid #cbd5e1',
                          background: defaultView === view ? '#0f172a' : '#fff',
                          color: defaultView === view ? '#fff' : '#334155',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {view === 'actor' ? 'Actor-first' : 'Parent-first'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                <label style={{ display: 'grid', gap: 8 }}>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{actorLabel}</span>
                  <input
                    value={actorName}
                    onChange={(event) => setActorName(event.target.value)}
                    placeholder={role === 'parent' ? 'Johnny Ralston' : user?.name || 'Corey Ralston'}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: '1px solid #cbd5e1',
                      fontSize: 15,
                    }}
                  />
                </label>

                <label style={{ display: 'grid', gap: 8 }}>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>Age range</span>
                  <input
                    value={ageRange}
                    onChange={(event) => setAgeRange(event.target.value)}
                    placeholder={isChild ? '10-12' : '18-24'}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: '1px solid #cbd5e1',
                      fontSize: 15,
                    }}
                  />
                </label>
              </div>

              <div style={{
                padding: '1rem',
                borderRadius: 14,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                color: '#475569',
                lineHeight: 1.7,
              }}>
                This first actor becomes your active context across Prep101, Reader101, and Bold Choices.
                You can add more actor profiles and switch context next.
              </div>

              {error && (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: '#fef2f2',
                  border: '1px solid #fca5a5',
                  color: '#991b1b',
                  fontWeight: 600,
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn btnPrimary"
                disabled={isSubmitting}
                style={{ maxWidth: 280 }}
              >
                {isSubmitting ? 'Saving account…' : 'Continue to My Account'}
              </button>
            </form>
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
}
