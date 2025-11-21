import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../utils/supabase';
import API_BASE from '../config/api';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import '../styles/shared.css';

const AdminDashboard = () => {
  const [sessionToken, setSessionToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [busyUserId, setBusyUserId] = useState(null);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const fetchUsers = async (token, opts = {}) => {
    const nextPage = opts.page || page;
    const nextSearch = typeof opts.search === 'string' ? opts.search : search;

    setTableLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(nextPage));
      params.set('limit', String(limit));
      if (nextSearch.trim()) {
        params.set('search', nextSearch.trim());
      }

      const res = await fetch(`${API_BASE}/api/admin/users?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.status === 403) {
        setForbidden(true);
        setUsers([]);
        setTotal(0);
        toast.error('You do not have admin access. Make sure your account is marked as an Admin beta tester.');
        return;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to load admin users (HTTP ${res.status})`);
      }

      const data = await res.json();
      setUsers(data.users || []);
      setPage(data.page || nextPage);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Admin users fetch error:', err);
      toast.error(err.message || 'Failed to load admin users');
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          throw error;
        }
        const token = data?.session?.access_token;
        if (!token) {
          throw new Error('No Supabase access token found for admin API.');
        }
        setSessionToken(token);
        await fetchUsers(token, { page: 1 });
      } catch (err) {
        console.error('Admin init error:', err);
        toast.error(err.message || 'Failed to initialize admin dashboard');
      } finally {
        setLoading(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = async () => {
    if (!sessionToken) return;
    await fetchUsers(sessionToken, { page: 1 });
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!sessionToken) return;
    await fetchUsers(sessionToken, { page: 1, search });
  };

  const handlePageChange = async (nextPage) => {
    if (!sessionToken) return;
    await fetchUsers(sessionToken, { page: nextPage });
  };

  const handleGrantGuide = async (userId, amount = 1) => {
    if (!sessionToken) return;
    setBusyUserId(userId);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}/guides`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ addGuides: amount })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to update guide limits (HTTP ${res.status})`);
      }

      const data = await res.json();
      toast.success(`Updated guide limits for ${data.user?.email || 'user'}`);
      await fetchUsers(sessionToken);
    } catch (err) {
      console.error('Grant guide error:', err);
      toast.error(err.message || 'Failed to update guide limits');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleResetUsage = async (userId) => {
    if (!sessionToken) return;
    setBusyUserId(userId);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}/guides`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ guidesUsed: 0 })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to reset usage (HTTP ${res.status})`);
      }

      const data = await res.json();
      toast.success(`Reset usage for ${data.user?.email || 'user'}`);
      await fetchUsers(sessionToken);
    } catch (err) {
      console.error('Reset usage error:', err);
      toast.error(err.message || 'Failed to reset usage');
    } finally {
      setBusyUserId(null);
    }
  };

  if (loading) {
    return (
      <div className="page-dark">
        <div className="container-wide" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              border: '4px solid #d1fae5',
              borderTop: '4px solid #14b8a6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem'
            }}
          />
          <p style={{ color: '#e5e7eb' }}>Loading admin dashboard…</p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <>
        <Navbar />
        <div className="page-dark">
          <div className="container-wide">
            <div className="card-white" style={{ marginTop: '2rem', textAlign: 'center' }}>
              <h1 className="h1-hero">Admin Access Required</h1>
              <p style={{ color: '#6b7280', maxWidth: 540, margin: '1rem auto' }}>
                This page is only available to Admin beta testers. Make sure your account has
                <strong> betaAccessLevel: &quot;admin&quot;</strong> in the backend.
              </p>
            </div>
          </div>
          <Footer />
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="page-dark">
        <div className="container-wide">
          <div className="page-hero">
            <img src="/preplogo.png" alt="Prep101 logo" className="logo-hero" loading="lazy" />
            <h1 className="h1-hero">Admin Dashboard</h1>
            <p className="h2-hero">
              View user activity, guides created, and quickly grant extra guides when needed.
            </p>
          </div>

          <div className="card-white">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                gap: '1rem',
                flexWrap: 'wrap'
              }}
            >
              <form
                onSubmit={handleSearchSubmit}
                style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flex: 1 }}
              >
                <input
                  type="text"
                  placeholder="Search by email or name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: 220,
                    padding: '0.6rem 0.9rem',
                    borderRadius: '0.75rem',
                    border: '2px solid #e5e7eb',
                    fontSize: '0.95rem'
                  }}
                />
                <button
                  type="submit"
                  className="btn btnPrimary"
                  style={{ whiteSpace: 'nowrap' }}
                  disabled={tableLoading}
                >
                  {tableLoading ? 'Searching…' : 'Search'}
                </button>
              </form>

              <button
                type="button"
                className="btn btnSecondary"
                onClick={handleRefresh}
                disabled={tableLoading}
              >
                Refresh
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>User</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>Plan</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>Guides</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>Activity</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>
                        {tableLoading ? 'Loading users…' : 'No users found.'}
                      </td>
                    </tr>
                  )}
                  {users.map((u) => {
                    const usageText =
                      typeof u.guidesLimit === 'number'
                        ? `${u.guidesUsed || 0} / ${u.guidesLimit}`
                        : `${u.guidesUsed || 0} / —`;
                    const created = u.createdAt
                      ? new Date(u.createdAt).toLocaleDateString()
                      : '—';
                    const lastGuide = u.lastGuideAt
                      ? new Date(u.lastGuideAt).toLocaleDateString()
                      : '—';
                    const isBusy = busyUserId === u.id;
                    return (
                      <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.5rem', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 600 }}>{u.email}</div>
                          <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>{u.name}</div>
                          {u.isBetaTester && (
                            <div
                              style={{
                                marginTop: '0.2rem',
                                display: 'inline-block',
                                padding: '0.1rem 0.4rem',
                                fontSize: '0.7rem',
                                borderRadius: '999px',
                                background: u.betaAccessLevel === 'admin' ? '#fef3c7' : '#e0f2fe',
                                color: u.betaAccessLevel === 'admin' ? '#b45309' : '#0369a1'
                              }}
                            >
                              Beta: {u.betaAccessLevel}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.5rem', verticalAlign: 'top' }}>
                          <div style={{ textTransform: 'capitalize' }}>{u.subscription || 'free'}</div>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Created: {created}</div>
                        </td>
                        <td style={{ padding: '0.5rem', verticalAlign: 'top' }}>
                          <div>{usageText}</div>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                            Total guides: {u.guidesCount ?? 0}
                          </div>
                        </td>
                        <td style={{ padding: '0.5rem', verticalAlign: 'top' }}>
                          <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                            Last guide: {lastGuide}
                          </div>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                            Updated: {u.updatedAt ? new Date(u.updatedAt).toLocaleDateString() : '—'}
                          </div>
                        </td>
                        <td style={{ padding: '0.5rem', verticalAlign: 'top' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            <button
                              type="button"
                              className="btn btnPrimary"
                              style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                              onClick={() => handleGrantGuide(u.id, 1)}
                              disabled={isBusy}
                            >
                              {isBusy ? 'Updating…' : '+1 Free Guide'}
                            </button>
                            <button
                              type="button"
                              className="btn btnSecondary"
                              style={{
                                fontSize: '0.8rem',
                                padding: '0.3rem 0.6rem',
                                background: '#f9fafb',
                                color: '#6b7280'
                              }}
                              onClick={() => handleResetUsage(u.id)}
                              disabled={isBusy}
                            >
                              Reset Usage
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '1rem',
                fontSize: '0.85rem',
                color: '#6b7280'
              }}
            >
              <div>
                Page {page} of {totalPages} • {total} users
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btnSecondary"
                  disabled={page <= 1 || tableLoading}
                  onClick={() => handlePageChange(page - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn btnSecondary"
                  disabled={page >= totalPages || tableLoading}
                  onClick={() => handlePageChange(page + 1)}
                >
                  Next
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

export default AdminDashboard;


