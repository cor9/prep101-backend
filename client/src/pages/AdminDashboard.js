import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import API_BASE from '../config/api';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import '../styles/shared.css';

// Tab options for navigation
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'guides', label: 'Guides' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'promo', label: 'Promo Codes' },
  { id: 'growth', label: 'Growth' }
];

const AdminDashboard = () => {
  const [sessionToken, setSessionToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Overview state
  const [dashboard, setDashboard] = useState(null);

  // Users state
  const [users, setUsers] = useState([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersSearch, setUsersSearch] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const [busyUserId, setBusyUserId] = useState(null);

  // Guides state
  const [guides, setGuides] = useState([]);
  const [guidesPage, setGuidesPage] = useState(1);
  const [guidesTotal, setGuidesTotal] = useState(0);
  const [guidesSearch, setGuidesSearch] = useState('');
  const [guidesLoading, setGuidesLoading] = useState(false);
  const [guideAnalytics, setGuideAnalytics] = useState(null);

  // Revenue state
  const [revenue, setRevenue] = useState(null);
  const [revenueLoading, setRevenueLoading] = useState(false);

  // Promo codes state
  const [promoCodes, setPromoCodes] = useState([]);
  const [promoAnalytics, setPromoAnalytics] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);

  // Growth state
  const [growth, setGrowth] = useState(null);
  const [activity, setActivity] = useState(null);
  const [growthLoading, setGrowthLoading] = useState(false);

  const limit = 25;
  const usersTotalPages = Math.max(1, Math.ceil(usersTotal / limit));
  const guidesTotalPages = Math.max(1, Math.ceil(guidesTotal / limit));

  // API fetch helper
  const apiFetch = useCallback(async (endpoint, token) => {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status === 403) {
      setForbidden(true);
      throw new Error('Admin access required');
    }
    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }
    return res.json();
  }, []);

  // Fetch dashboard overview
  const fetchDashboard = useCallback(async (token) => {
    try {
      const data = await apiFetch('/api/admin/dashboard', token);
      setDashboard(data.dashboard);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      if (!forbidden) toast.error('Failed to load dashboard');
    }
  }, [apiFetch, forbidden]);

  // Fetch users
  const fetchUsers = useCallback(async (token, opts = {}) => {
    const page = opts.page || usersPage;
    const search = typeof opts.search === 'string' ? opts.search : usersSearch;

    setUsersLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search.trim()) params.set('search', search.trim());

      const data = await apiFetch(`/api/admin/users?${params}`, token);
      setUsers(data.users || []);
      setUsersPage(data.page || page);
      setUsersTotal(data.total || 0);
    } catch (err) {
      console.error('Users fetch error:', err);
      if (!forbidden) toast.error('Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  }, [apiFetch, usersPage, usersSearch, forbidden]);

  // Fetch guides
  const fetchGuides = useCallback(async (token, opts = {}) => {
    const page = opts.page || guidesPage;
    const search = typeof opts.search === 'string' ? opts.search : guidesSearch;

    setGuidesLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search.trim()) params.set('search', search.trim());

      const data = await apiFetch(`/api/admin/guides?${params}`, token);
      setGuides(data.guides || []);
      setGuidesPage(data.page || page);
      setGuidesTotal(data.total || 0);
    } catch (err) {
      console.error('Guides fetch error:', err);
      if (!forbidden) toast.error('Failed to load guides');
    } finally {
      setGuidesLoading(false);
    }
  }, [apiFetch, guidesPage, guidesSearch, forbidden]);

  // Fetch guide analytics
  const fetchGuideAnalytics = useCallback(async (token) => {
    try {
      const data = await apiFetch('/api/admin/guides/analytics', token);
      setGuideAnalytics(data.analytics);
    } catch (err) {
      console.error('Guide analytics error:', err);
    }
  }, [apiFetch]);

  // Fetch revenue
  const fetchRevenue = useCallback(async (token) => {
    setRevenueLoading(true);
    try {
      const data = await apiFetch('/api/admin/revenue', token);
      setRevenue(data.revenue);
    } catch (err) {
      console.error('Revenue fetch error:', err);
      if (!forbidden) toast.error('Failed to load revenue data');
    } finally {
      setRevenueLoading(false);
    }
  }, [apiFetch, forbidden]);

  // Fetch promo codes
  const fetchPromoCodes = useCallback(async (token) => {
    setPromoLoading(true);
    try {
      const [codesData, analyticsData] = await Promise.all([
        apiFetch('/api/admin/promo-codes', token),
        apiFetch('/api/admin/promo-codes/analytics', token)
      ]);
      setPromoCodes(codesData.promoCodes || []);
      setPromoAnalytics(analyticsData.analytics);
    } catch (err) {
      console.error('Promo codes fetch error:', err);
      if (!forbidden) toast.error('Failed to load promo codes');
    } finally {
      setPromoLoading(false);
    }
  }, [apiFetch, forbidden]);

  // Fetch growth data
  const fetchGrowth = useCallback(async (token) => {
    setGrowthLoading(true);
    try {
      const [growthData, activityData] = await Promise.all([
        apiFetch('/api/admin/growth', token),
        apiFetch('/api/admin/activity?days=30', token)
      ]);
      setGrowth(growthData.growth);
      setActivity(activityData.activity);
    } catch (err) {
      console.error('Growth fetch error:', err);
      if (!forbidden) toast.error('Failed to load growth data');
    } finally {
      setGrowthLoading(false);
    }
  }, [apiFetch, forbidden]);

  // Initialize
  useEffect(() => {
    const init = async () => {
      try {
        // Get token from localStorage (where the app stores it after login)
        const token = localStorage.getItem('prep101_token');
        if (!token) {
          throw new Error('Please log in to access the admin dashboard');
        }

        setSessionToken(token);
        await fetchDashboard(token);
      } catch (err) {
        console.error('Admin init error:', err);
        toast.error(err.message || 'Failed to initialize');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [fetchDashboard]);

  // Load tab data when tab changes
  useEffect(() => {
    if (!sessionToken || forbidden) return;

    switch (activeTab) {
      case 'users':
        fetchUsers(sessionToken, { page: 1 });
        break;
      case 'guides':
        fetchGuides(sessionToken, { page: 1 });
        fetchGuideAnalytics(sessionToken);
        break;
      case 'revenue':
        fetchRevenue(sessionToken);
        break;
      case 'promo':
        fetchPromoCodes(sessionToken);
        break;
      case 'growth':
        fetchGrowth(sessionToken);
        break;
      default:
        break;
    }
  }, [activeTab, sessionToken, forbidden, fetchUsers, fetchGuides, fetchGuideAnalytics, fetchRevenue, fetchPromoCodes, fetchGrowth]);

  // User actions
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
      if (!res.ok) throw new Error('Failed to update');
      const data = await res.json();
      toast.success(`Added ${amount} guide(s) for ${data.user?.email || 'user'}`);
      fetchUsers(sessionToken);
    } catch (err) {
      toast.error(err.message);
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
      if (!res.ok) throw new Error('Failed to reset');
      toast.success('Usage reset');
      fetchUsers(sessionToken);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyUserId(null);
    }
  };

  // Styles
  const styles = {
    statCard: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: '1rem',
      padding: '1.5rem',
      color: 'white',
      minWidth: '200px',
      flex: '1'
    },
    statCardAlt: {
      background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
      borderRadius: '1rem',
      padding: '1.5rem',
      color: 'white',
      minWidth: '200px',
      flex: '1'
    },
    statCardWarn: {
      background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      borderRadius: '1rem',
      padding: '1.5rem',
      color: 'white',
      minWidth: '200px',
      flex: '1'
    },
    statCardBlue: {
      background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      borderRadius: '1rem',
      padding: '1.5rem',
      color: 'white',
      minWidth: '200px',
      flex: '1'
    },
    statValue: {
      fontSize: '2rem',
      fontWeight: '700',
      marginBottom: '0.25rem'
    },
    statLabel: {
      fontSize: '0.9rem',
      opacity: 0.9
    },
    tabContainer: {
      display: 'flex',
      gap: '0.5rem',
      marginBottom: '1.5rem',
      flexWrap: 'wrap',
      borderBottom: '2px solid #e5e7eb',
      paddingBottom: '0.5rem'
    },
    tab: (isActive) => ({
      padding: '0.75rem 1.25rem',
      borderRadius: '0.5rem 0.5rem 0 0',
      border: 'none',
      background: isActive ? '#14b8a6' : 'transparent',
      color: isActive ? 'white' : '#6b7280',
      fontWeight: isActive ? '600' : '400',
      cursor: 'pointer',
      transition: 'all 0.2s'
    }),
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '0.9rem'
    },
    th: {
      textAlign: 'left',
      padding: '0.75rem',
      borderBottom: '2px solid #e5e7eb',
      background: '#f9fafb',
      fontWeight: '600'
    },
    td: {
      padding: '0.75rem',
      borderBottom: '1px solid #f3f4f6',
      verticalAlign: 'top'
    },
    badge: (color) => ({
      display: 'inline-block',
      padding: '0.2rem 0.5rem',
      borderRadius: '999px',
      fontSize: '0.75rem',
      fontWeight: '500',
      background: color === 'green' ? '#d1fae5' : color === 'blue' ? '#dbeafe' : color === 'yellow' ? '#fef3c7' : '#f3f4f6',
      color: color === 'green' ? '#065f46' : color === 'blue' ? '#1e40af' : color === 'yellow' ? '#92400e' : '#374151'
    }),
    sectionTitle: {
      fontSize: '1.25rem',
      fontWeight: '600',
      marginBottom: '1rem',
      color: '#111827'
    },
    card: {
      background: 'white',
      borderRadius: '1rem',
      padding: '1.5rem',
      marginBottom: '1.5rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    },
    gridStats: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '1rem',
      marginBottom: '1.5rem'
    },
    flexRow: {
      display: 'flex',
      gap: '1rem',
      flexWrap: 'wrap',
      alignItems: 'center'
    },
    trendUp: {
      color: '#10b981',
      fontWeight: '600'
    },
    trendDown: {
      color: '#ef4444',
      fontWeight: '600'
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="page-dark" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px', height: '48px',
            border: '4px solid #d1fae5', borderTop: '4px solid #14b8a6',
            borderRadius: '50%', animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }} />
          <p style={{ color: '#e5e7eb' }}>Loading admin dashboard...</p>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // Forbidden state
  if (forbidden) {
    return (
      <>
        <Navbar />
        <div className="page-dark">
          <div className="container-wide">
            <div style={{ ...styles.card, marginTop: '2rem', textAlign: 'center' }}>
              <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Admin Access Required</h1>
              <p style={{ color: '#6b7280' }}>
                This page is only available to Admin users. Make sure your account has admin privileges.
              </p>
            </div>
          </div>
          <Footer />
        </div>
      </>
    );
  }

  // Render Overview Tab
  const renderOverview = () => {
    if (!dashboard) return <p>Loading overview...</p>;

    const { overview, users: userStats, guides: guideStats, subscriptions, recentUsers, recentGuides } = dashboard;

    return (
      <>
        {/* Key Metrics */}
        <div style={styles.gridStats}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{overview.totalUsers}</div>
            <div style={styles.statLabel}>Total Users</div>
          </div>
          <div style={styles.statCardAlt}>
            <div style={styles.statValue}>{overview.totalGuides}</div>
            <div style={styles.statLabel}>Total Guides</div>
          </div>
          <div style={styles.statCardBlue}>
            <div style={styles.statValue}>{overview.activeSubscriptions}</div>
            <div style={styles.statLabel}>Active Subscriptions</div>
          </div>
          <div style={styles.statCardWarn}>
            <div style={styles.statValue}>{overview.betaTesters}</div>
            <div style={styles.statLabel}>Beta Testers</div>
          </div>
        </div>

        {/* This Period Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>User Growth</h3>
            <div style={styles.flexRow}>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Today</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{userStats.today}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>This Week</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{userStats.thisWeek}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>This Month</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{userStats.thisMonth}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Growth</div>
                <div style={userStats.growthRate >= 0 ? styles.trendUp : styles.trendDown}>
                  {userStats.growthRate >= 0 ? '+' : ''}{userStats.growthRate}%
                </div>
              </div>
            </div>
          </div>

          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Guide Creation</h3>
            <div style={styles.flexRow}>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Today</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{guideStats.today}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>This Week</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{guideStats.thisWeek}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>This Month</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{guideStats.thisMonth}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Avg/User</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>{guideStats.avgPerUser}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Subscription Breakdown */}
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>Subscription Breakdown</h3>
          <div style={styles.flexRow}>
            {subscriptions.map(sub => (
              <div key={sub.type} style={{ textAlign: 'center', padding: '1rem', background: '#f9fafb', borderRadius: '0.5rem', minWidth: '100px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{sub.count}</div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280', textTransform: 'capitalize' }}>{sub.type}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Recent Users</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>User</th>
                    <th style={styles.th}>Plan</th>
                    <th style={styles.th}>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.map(u => (
                    <tr key={u.id}>
                      <td style={styles.td}>
                        <div style={{ fontWeight: '500' }}>{u.email}</div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{u.name}</div>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.badge(u.subscription === 'premium' ? 'green' : u.subscription === 'basic' ? 'blue' : 'gray')}>
                          {u.subscription}
                        </span>
                      </td>
                      <td style={styles.td}>{new Date(u.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Recent Guides</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Character</th>
                    <th style={styles.th}>Production</th>
                    <th style={styles.th}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {recentGuides.map(g => (
                    <tr key={g.id}>
                      <td style={styles.td}>
                        <div style={{ fontWeight: '500' }}>{g.characterName}</div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{g.user?.email}</div>
                      </td>
                      <td style={styles.td}>{g.productionTitle}</td>
                      <td style={styles.td}>{new Date(g.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </>
    );
  };

  // Render Users Tab
  const renderUsers = () => (
    <div style={styles.card}>
      <div style={{ ...styles.flexRow, justifyContent: 'space-between', marginBottom: '1rem' }}>
        <form onSubmit={(e) => { e.preventDefault(); fetchUsers(sessionToken, { page: 1, search: usersSearch }); }} style={styles.flexRow}>
          <input
            type="text"
            placeholder="Search by email or name..."
            value={usersSearch}
            onChange={(e) => setUsersSearch(e.target.value)}
            style={{ padding: '0.6rem 1rem', borderRadius: '0.5rem', border: '2px solid #e5e7eb', minWidth: '250px' }}
          />
          <button type="submit" className="btn btnPrimary" disabled={usersLoading}>
            {usersLoading ? 'Searching...' : 'Search'}
          </button>
        </form>
        <button type="button" className="btn btnSecondary" onClick={() => fetchUsers(sessionToken, { page: 1 })} disabled={usersLoading}>
          Refresh
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>User</th>
              <th style={styles.th}>Plan</th>
              <th style={styles.th}>Guides</th>
              <th style={styles.th}>Activity</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={5} style={{ ...styles.td, textAlign: 'center', color: '#6b7280' }}>
                  {usersLoading ? 'Loading...' : 'No users found.'}
                </td>
              </tr>
            )}
            {users.map(u => (
              <tr key={u.id}>
                <td style={styles.td}>
                  <div style={{ fontWeight: '600' }}>{u.email}</div>
                  <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>{u.name}</div>
                  {u.isBetaTester && (
                    <span style={styles.badge(u.betaAccessLevel === 'admin' ? 'yellow' : 'blue')}>
                      Beta: {u.betaAccessLevel}
                    </span>
                  )}
                </td>
                <td style={styles.td}>
                  <span style={styles.badge(u.subscription === 'premium' ? 'green' : u.subscription === 'basic' ? 'blue' : 'gray')}>
                    {u.subscription}
                  </span>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                    {new Date(u.createdAt).toLocaleDateString()}
                  </div>
                </td>
                <td style={styles.td}>
                  <div>{u.guidesUsed} / {u.guidesLimit}</div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Total: {u.guidesCount}</div>
                </td>
                <td style={styles.td}>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                    Last: {u.lastGuideAt ? new Date(u.lastGuideAt).toLocaleDateString() : 'Never'}
                  </div>
                </td>
                <td style={styles.td}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <button
                      className="btn btnPrimary"
                      style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                      onClick={() => handleGrantGuide(u.id, 1)}
                      disabled={busyUserId === u.id}
                    >
                      +1 Guide
                    </button>
                    <button
                      className="btn btnSecondary"
                      style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                      onClick={() => handleResetUsage(u.id)}
                      disabled={busyUserId === u.id}
                    >
                      Reset Usage
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ ...styles.flexRow, justifyContent: 'space-between', marginTop: '1rem', fontSize: '0.85rem', color: '#6b7280' }}>
        <div>Page {usersPage} of {usersTotalPages} ({usersTotal} users)</div>
        <div style={styles.flexRow}>
          <button className="btn btnSecondary" disabled={usersPage <= 1 || usersLoading} onClick={() => fetchUsers(sessionToken, { page: usersPage - 1 })}>
            Previous
          </button>
          <button className="btn btnSecondary" disabled={usersPage >= usersTotalPages || usersLoading} onClick={() => fetchUsers(sessionToken, { page: usersPage + 1 })}>
            Next
          </button>
        </div>
      </div>
    </div>
  );

  // Render Guides Tab
  const renderGuides = () => (
    <>
      {guideAnalytics && (
        <div style={styles.gridStats}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{guideAnalytics.visibility?.public || 0}</div>
            <div style={styles.statLabel}>Public Guides</div>
          </div>
          <div style={styles.statCardAlt}>
            <div style={styles.statValue}>{guideAnalytics.visibility?.private || 0}</div>
            <div style={styles.statLabel}>Private Guides</div>
          </div>
          <div style={styles.statCardBlue}>
            <div style={styles.statValue}>{guideAnalytics.childGuides?.completed || 0}</div>
            <div style={styles.statLabel}>Child Guides Created</div>
          </div>
        </div>
      )}

      {guideAnalytics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>By Production Type</h3>
            {guideAnalytics.byProductionType?.slice(0, 5).map(item => (
              <div key={item.type} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' }}>
                <span>{item.type || 'Unknown'}</span>
                <span style={{ fontWeight: '600' }}>{item.count}</span>
              </div>
            ))}
          </div>
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>By Genre</h3>
            {guideAnalytics.byGenre?.slice(0, 5).map(item => (
              <div key={item.genre} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' }}>
                <span>{item.genre || 'Unknown'}</span>
                <span style={{ fontWeight: '600' }}>{item.count}</span>
              </div>
            ))}
          </div>
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Top Viewed</h3>
            {guideAnalytics.topViewed?.slice(0, 5).map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>{item.characterName}</span>
                <span style={{ fontWeight: '600' }}>{item.viewCount} views</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={styles.card}>
        <div style={{ ...styles.flexRow, justifyContent: 'space-between', marginBottom: '1rem' }}>
          <form onSubmit={(e) => { e.preventDefault(); fetchGuides(sessionToken, { page: 1, search: guidesSearch }); }} style={styles.flexRow}>
            <input
              type="text"
              placeholder="Search character or production..."
              value={guidesSearch}
              onChange={(e) => setGuidesSearch(e.target.value)}
              style={{ padding: '0.6rem 1rem', borderRadius: '0.5rem', border: '2px solid #e5e7eb', minWidth: '250px' }}
            />
            <button type="submit" className="btn btnPrimary" disabled={guidesLoading}>Search</button>
          </form>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Character</th>
                <th style={styles.th}>Production</th>
                <th style={styles.th}>Type / Genre</th>
                <th style={styles.th}>User</th>
                <th style={styles.th}>Created</th>
              </tr>
            </thead>
            <tbody>
              {guides.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ ...styles.td, textAlign: 'center', color: '#6b7280' }}>
                    {guidesLoading ? 'Loading...' : 'No guides found.'}
                  </td>
                </tr>
              )}
              {guides.map(g => (
                <tr key={g.id}>
                  <td style={styles.td}>
                    <div style={{ fontWeight: '500' }}>{g.characterName}</div>
                    {g.isPublic && <span style={styles.badge('green')}>Public</span>}
                  </td>
                  <td style={styles.td}>{g.productionTitle}</td>
                  <td style={styles.td}>
                    <div>{g.productionType}</div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{g.genre}</div>
                  </td>
                  <td style={styles.td}>
                    <div style={{ fontSize: '0.85rem' }}>{g.user?.email}</div>
                  </td>
                  <td style={styles.td}>{new Date(g.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ ...styles.flexRow, justifyContent: 'space-between', marginTop: '1rem', fontSize: '0.85rem', color: '#6b7280' }}>
          <div>Page {guidesPage} of {guidesTotalPages} ({guidesTotal} guides)</div>
          <div style={styles.flexRow}>
            <button className="btn btnSecondary" disabled={guidesPage <= 1 || guidesLoading} onClick={() => fetchGuides(sessionToken, { page: guidesPage - 1 })}>
              Previous
            </button>
            <button className="btn btnSecondary" disabled={guidesPage >= guidesTotalPages || guidesLoading} onClick={() => fetchGuides(sessionToken, { page: guidesPage + 1 })}>
              Next
            </button>
          </div>
        </div>
      </div>
    </>
  );

  // Render Revenue Tab
  const renderRevenue = () => {
    if (revenueLoading) return <p>Loading revenue data...</p>;
    if (!revenue) return <p>No revenue data available. Make sure Stripe is configured.</p>;

    return (
      <>
        <div style={styles.gridStats}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>${revenue.thisMonth?.toFixed(2) || '0.00'}</div>
            <div style={styles.statLabel}>This Month</div>
          </div>
          <div style={styles.statCardAlt}>
            <div style={styles.statValue}>${revenue.lastMonth?.toFixed(2) || '0.00'}</div>
            <div style={styles.statLabel}>Last Month</div>
          </div>
          <div style={styles.statCardBlue}>
            <div style={styles.statValue}>${revenue.mrr?.toFixed(2) || '0.00'}</div>
            <div style={styles.statLabel}>MRR</div>
          </div>
          <div style={styles.statCardWarn}>
            <div style={styles.statValue}>${revenue.thisYear?.toFixed(2) || '0.00'}</div>
            <div style={styles.statLabel}>This Year</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Balance</h3>
            <div style={styles.flexRow}>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Available</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#10b981' }}>${revenue.balance?.available?.toFixed(2) || '0.00'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Pending</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#f59e0b' }}>${revenue.balance?.pending?.toFixed(2) || '0.00'}</div>
              </div>
            </div>
          </div>

          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Subscriptions</h3>
            <div style={styles.flexRow}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#10b981' }}>{revenue.subscriptions?.active || 0}</div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Active</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#f59e0b' }}>{revenue.subscriptions?.trialing || 0}</div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Trialing</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#ef4444' }}>{revenue.subscriptions?.canceled || 0}</div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Canceled</div>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>Recent Transactions</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Amount</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Customer</th>
                  <th style={styles.th}>Date</th>
                </tr>
              </thead>
              <tbody>
                {(revenue.recentTransactions || []).map(t => (
                  <tr key={t.id}>
                    <td style={styles.td}>
                      <span style={{ fontWeight: '600' }}>${t.amount?.toFixed(2)}</span>
                      <span style={{ color: '#6b7280', marginLeft: '0.25rem' }}>{t.currency}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.badge(t.status === 'succeeded' ? 'green' : t.status === 'pending' ? 'yellow' : 'gray')}>
                        {t.status}
                      </span>
                    </td>
                    <td style={styles.td}>{t.customerEmail || 'N/A'}</td>
                    <td style={styles.td}>{new Date(t.date).toLocaleDateString()}</td>
                  </tr>
                ))}
                {(!revenue.recentTransactions || revenue.recentTransactions.length === 0) && (
                  <tr>
                    <td colSpan={4} style={{ ...styles.td, textAlign: 'center', color: '#6b7280' }}>No transactions yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  };

  // Render Promo Codes Tab
  const renderPromoCodes = () => {
    if (promoLoading) return <p>Loading promo codes...</p>;

    return (
      <>
        {promoAnalytics && (
          <div style={styles.gridStats}>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{promoAnalytics.totalCodes || 0}</div>
              <div style={styles.statLabel}>Total Codes</div>
            </div>
            <div style={styles.statCardAlt}>
              <div style={styles.statValue}>{promoAnalytics.activeCodes || 0}</div>
              <div style={styles.statLabel}>Active Codes</div>
            </div>
            <div style={styles.statCardBlue}>
              <div style={styles.statValue}>{promoAnalytics.totalRedemptions || 0}</div>
              <div style={styles.statLabel}>Total Redemptions</div>
            </div>
            <div style={styles.statCardWarn}>
              <div style={styles.statValue}>{promoAnalytics.totalGuidesGranted || 0}</div>
              <div style={styles.statLabel}>Guides Granted</div>
            </div>
          </div>
        )}

        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>Promo Codes</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Code</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Value</th>
                  <th style={styles.th}>Redemptions</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {promoCodes.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ ...styles.td, textAlign: 'center', color: '#6b7280' }}>No promo codes found</td>
                  </tr>
                )}
                {promoCodes.map(pc => (
                  <tr key={pc.id}>
                    <td style={styles.td}>
                      <div style={{ fontWeight: '600', fontFamily: 'monospace' }}>{pc.code}</div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{pc.description}</div>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.badge(pc.type === 'free_guides' ? 'green' : 'blue')}>{pc.type}</span>
                    </td>
                    <td style={styles.td}>
                      {pc.type === 'free_guides' && `${pc.guidesGranted} guide(s)`}
                      {pc.type === 'discount' && `${pc.discountPercent}% off`}
                    </td>
                    <td style={styles.td}>
                      {pc.currentRedemptions} / {pc.maxRedemptions || '∞'}
                    </td>
                    <td style={styles.td}>
                      <span style={styles.badge(pc.isActive ? 'green' : 'gray')}>
                        {pc.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {promoAnalytics?.recentRedemptions?.length > 0 && (
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Recent Redemptions</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Code</th>
                    <th style={styles.th}>User</th>
                    <th style={styles.th}>Guides Granted</th>
                    <th style={styles.th}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {promoAnalytics.recentRedemptions.map(r => (
                    <tr key={r.id}>
                      <td style={styles.td}><span style={{ fontFamily: 'monospace' }}>{r.code}</span></td>
                      <td style={styles.td}>{r.user?.email || 'Unknown'}</td>
                      <td style={styles.td}>{r.guidesGranted}</td>
                      <td style={styles.td}>{new Date(r.redeemedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>
    );
  };

  // Render Growth Tab
  const renderGrowth = () => {
    if (growthLoading) return <p>Loading growth data...</p>;
    if (!growth) return <p>No growth data available</p>;

    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>User Growth</h3>
            <div style={styles.flexRow}>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>This Month</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{growth.users?.thisMonth || 0}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Last Month</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{growth.users?.lastMonth || 0}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Growth</div>
                <div style={growth.users?.growth >= 0 ? styles.trendUp : styles.trendDown}>
                  {growth.users?.trend === 'up' ? '↑' : growth.users?.trend === 'down' ? '↓' : '→'} {growth.users?.growth || 0}%
                </div>
              </div>
            </div>
          </div>

          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Guide Growth</h3>
            <div style={styles.flexRow}>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>This Month</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{growth.guides?.thisMonth || 0}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Last Month</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{growth.guides?.lastMonth || 0}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Growth</div>
                <div style={growth.guides?.growth >= 0 ? styles.trendUp : styles.trendDown}>
                  {growth.guides?.trend === 'up' ? '↑' : growth.guides?.trend === 'down' ? '↓' : '→'} {growth.guides?.growth || 0}%
                </div>
              </div>
            </div>
          </div>

          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Engagement</h3>
            <div style={styles.flexRow}>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Active Users (This Month)</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{growth.engagement?.activeUsersThisMonth || 0}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Active Rate</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{growth.engagement?.activeRate || 0}%</div>
              </div>
            </div>
          </div>
        </div>

        {activity?.data?.length > 0 && (
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Activity (Last 30 Days)</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>New Users</th>
                    <th style={styles.th}>New Guides</th>
                    <th style={styles.th}>Total Users</th>
                    <th style={styles.th}>Total Guides</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.data.slice(-14).reverse().map(day => (
                    <tr key={day.date}>
                      <td style={styles.td}>{day.date}</td>
                      <td style={styles.td}>{day.newUsers}</td>
                      <td style={styles.td}>{day.newGuides}</td>
                      <td style={styles.td}>{day.totalUsers}</td>
                      <td style={styles.td}>{day.totalGuides}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <>
      <Navbar />
      <div className="page-dark">
        <div className="container-wide">
          <div className="page-hero">
            <img src="/preplogo.png" alt="Prep101 logo" className="logo-hero" loading="lazy" />
            <h1 className="h1-hero">Admin Dashboard</h1>
            <p className="h2-hero">Manage users, view analytics, track revenue, and monitor growth.</p>
          </div>

          {/* Tabs */}
          <div style={styles.tabContainer}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                style={styles.tab(activeTab === tab.id)}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'users' && renderUsers()}
          {activeTab === 'guides' && renderGuides()}
          {activeTab === 'revenue' && renderRevenue()}
          {activeTab === 'promo' && renderPromoCodes()}
          {activeTab === 'growth' && renderGrowth()}
        </div>
        <Footer />
      </div>
    </>
  );
};

export default AdminDashboard;
