import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../contexts/AuthContext';

export default function SelectActor() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, selectActor, addActor } = useAuth();
  const actors = user?.account?.actors || [];
  const activeActorId = user?.account?.profile?.activeActorId || user?.account?.activeActor?.id || '';
  const nextDestination = useMemo(
    () => new URLSearchParams(location.search).get('next'),
    [location.search]
  );

  const [selectedActorId, setSelectedActorId] = useState(activeActorId);
  const [actorName, setActorName] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [isChild, setIsChild] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const finish = () => {
    if (nextDestination) {
      window.location.replace(nextDestination);
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  const handleContinue = async (event) => {
    event.preventDefault();
    if (!selectedActorId) {
      setError('Choose an active actor to continue.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await selectActor(selectedActorId);
      finish();
    } catch (submitError) {
      setError(submitError.message || 'Could not switch actor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddActor = async (event) => {
    event.preventDefault();
    if (!actorName.trim()) {
      setError('Actor name is required.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      const nextUser = await addActor({
        actorName: actorName.trim(),
        ageRange: ageRange.trim(),
        isChild,
        makeActive: true,
      });
      setSelectedActorId(
        nextUser?.account?.activeActor?.id ||
          nextUser?.account?.profile?.activeActorId ||
          ''
      );
      setActorName('');
      setAgeRange('');
      setIsChild(false);
      finish();
    } catch (submitError) {
      setError(submitError.message || 'Could not add actor.');
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
            <h1 className="h1-hero">Choose Your Active Actor</h1>
            <p className="h2-hero">
              Auth tells us who is signed in. Your active actor tells us who the work is for.
            </p>
          </div>

          <div className="card-white" style={{ maxWidth: 920, margin: '0 auto 1.5rem' }}>
            <form onSubmit={handleContinue} style={{ display: 'grid', gap: '1rem' }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748b' }}>
                Active actor
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {actors.map((actor) => {
                  const isSelected = selectedActorId === actor.id;
                  return (
                    <button
                      key={actor.id}
                      type="button"
                      onClick={() => setSelectedActorId(actor.id)}
                      style={{
                        textAlign: 'left',
                        padding: '1rem',
                        borderRadius: 16,
                        border: isSelected ? '2px solid #0f172a' : '1px solid #e2e8f0',
                        background: isSelected ? '#0f172a' : '#fff',
                        color: isSelected ? '#fff' : '#0f172a',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 800, marginBottom: 6 }}>{actor.actorName}</div>
                      <div style={{ fontSize: 14, lineHeight: 1.6, color: isSelected ? 'rgba(255,255,255,0.72)' : '#64748b' }}>
                        {actor.ageRange || 'Age range not set'}
                        <br />
                        {actor.isChild ? 'Child actor context' : 'Actor context'}
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                type="submit"
                className="btn btnPrimary"
                disabled={isSubmitting || !selectedActorId}
                style={{ maxWidth: 260 }}
              >
                {isSubmitting ? 'Saving actor…' : 'Continue with this actor'}
              </button>
            </form>
          </div>

          <div className="card-white" style={{ maxWidth: 920, margin: '0 auto 2rem' }}>
            <form onSubmit={handleAddActor} style={{ display: 'grid', gap: '1rem' }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748b' }}>
                Add actor
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                <label style={{ display: 'grid', gap: 8 }}>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>Actor name</span>
                  <input
                    value={actorName}
                    onChange={(event) => setActorName(event.target.value)}
                    placeholder="Avery Smith"
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
                    placeholder="16-18"
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

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#334155', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={isChild}
                  onChange={(event) => setIsChild(event.target.checked)}
                />
                This actor should use child-actor context in adaptive products.
              </label>

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
                className="btn btnSecondary"
                disabled={isSubmitting}
                style={{ maxWidth: 220 }}
              >
                {isSubmitting ? 'Adding actor…' : 'Add and Use Actor'}
              </button>
            </form>
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
}
