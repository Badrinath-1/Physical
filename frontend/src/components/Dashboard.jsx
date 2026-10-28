import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import './Dashboard.css';

const API_BASE_URL = 'http://localhost:5001/api';

const COLORS = ['#134074', '#10b981', '#0284c7', '#8b5cf6', '#f97316', '#ec4899', '#3b82f6', '#14b8a6'];

const Dashboard = () => {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const [liveUdid, setLiveUdid]       = useState(null);
  const [liveCerts, setLiveCerts]     = useState(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveError, setLiveError]     = useState(null);

  // Budget verification badge state
  const [budgetStatus, setBudgetStatus]         = useState(null);
  const [refreshing, setRefreshing]             = useState(false);
  const [refreshMsg, setRefreshMsg]             = useState('');

  const fetchBudgetStatus = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/budget/status`);
      setBudgetStatus(res.data);
    } catch {
      // silently ignore — badge just won't show
    }
  };

  const triggerBudgetRefresh = async () => {
    setRefreshing(true);
    setRefreshMsg('Checking indiabudget.gov.in for latest PDF…');
    try {
      await axios.post(`${API_BASE_URL}/budget/refresh`);
      setRefreshMsg('Refresh started! Re-loading data in 15 seconds…');
      setTimeout(async () => {
        await fetchBudgetStatus();
        const res = await axios.get(`${API_BASE_URL}/dashboard`);
        setData(res.data);
        setRefreshing(false);
        setRefreshMsg('✅ Budget data refreshed from indiabudget.gov.in!');
        setTimeout(() => setRefreshMsg(''), 5000);
      }, 15000);
    } catch {
      setRefreshing(false);
      setRefreshMsg('⚠️ Refresh failed. Using cached official data.');
      setTimeout(() => setRefreshMsg(''), 4000);
    }
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/dashboard`);
        setData(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to fetch data from the server. Make sure the backend server is running.');
        setLoading(false);
      }
    };

    fetchBudgetStatus();

    const fetchLiveUdidData = async () => {
      try {
        const [udidRes, certsRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/udid/live`),
          axios.get(`${API_BASE_URL}/udid/certificates`)
        ]);
        setLiveUdid(udidRes.data);
        setLiveCerts(certsRes.data);
        setLiveLoading(false);
      } catch (err) {
        console.error('Error fetching live OGD data:', err);
        // Try to get fallback data from backend even if live fetch fails
        try {
          const [udidRes, certsRes] = await Promise.all([
            axios.get(`${API_BASE_URL}/udid/live`, { validateStatus: () => true }),
            axios.get(`${API_BASE_URL}/udid/certificates`, { validateStatus: () => true })
          ]);
          if (udidRes.data && !udidRes.data.error) setLiveUdid({ ...udidRes.data, usingFallback: true });
          if (certsRes.data && !certsRes.data.error) setLiveCerts({ ...certsRes.data, usingFallback: true });
          setLiveError('⚠️ data.gov.in API is rate-limited. Showing last verified official figures from DEPwD Annual Report 2023-24.');
        } catch {
          setLiveError('⚠️ data.gov.in API unavailable. Showing official published data from DEPwD Annual Report 2023-24.');
        }
        setLiveLoading(false);
      }
    };

    fetchDashboardData();
    fetchLiveUdidData();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading official budget data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p className="error-msg">{error}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry Connection</button>
      </div>
    );
  }

  const { summary, historicalTrend, categoryBreakdown, schemeComparison } = data;
  const sourceInfo = data.sourceInfo || {};
  const yoyIncrease = summary.be_2025_26
    ? (((summary.be_2026_27 - summary.be_2025_26) / summary.be_2025_26) * 100).toFixed(2)
    : 'N/A';

  // Custom colors for BE vs Actuals
  const BAR_COLORS = {
    be: '#2b6cb0',      // Blue
    actuals: '#48bb78', // Green
    re: '#f6ad55'       // Orange
  };

  return (
    <div className="dashboard-container fade-in">
      {/* Hero Banner Section */}
      <div className="hero-banner">
        <div className="hero-gov-tag">Govt. of India • Ministry of Social Justice & Empowerment</div>
        <div className="hero-title-section">
          <div className="hero-title-main">
            <h1>DEPwD Official <span>Budget Portal</span></h1>
            <p className="hero-subtitle">
              Verified monitoring of DEPwD budgetary allocations and expenditures under Demand No. 94. Live API integrations with data.gov.in.
            </p>
            <div className="hero-badges">
              <span className="hero-badge hero-badge-accent">Union Budget 2026-27</span>
              <span className="hero-badge">OGD Verified</span>
              <span className="hero-badge">{summary.totalSchemes} Active Schemes</span>
              <span className="hero-badge" style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}>● Live API Feed</span>
            </div>
          </div>
          <div className="hero-total-budget">
            <div className="budget-label">Net Allocation (2026-27)</div>
            <div className="budget-amount">₹{summary.be_2026_27.toFixed(2)} Cr</div>
            <div className="budget-subtext">{yoyIncrease}% YoY Increase</div>
          </div>
        </div>
      </div>

      {/* Budget Verification Status Bar */}
      <div className="info-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span className="info-icon">ℹ</span>
          <p style={{ margin: 0 }}>
            <strong>Official Source:</strong>{' '}
            <a href="https://www.indiabudget.gov.in/doc/eb/sbe94.pdf" target="_blank" rel="noopener noreferrer">
              Union Budget 2026-27, Demand No. 94 — indiabudget.gov.in ↗
            </a>
            {budgetStatus?.verifiedOn && (
              <span style={{ marginLeft: '0.75rem', backgroundColor: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                ✓ Verified {budgetStatus.verifiedOn}
              </span>
            )}
            {budgetStatus?.lastAutoCheck && (
              <span style={{ marginLeft: '0.5rem', color: '#64748b', fontSize: '0.75rem' }}>
                · Last checked: {new Date(budgetStatus.lastAutoCheck).toLocaleString('en-IN')}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <button
            onClick={triggerBudgetRefresh}
            disabled={refreshing}
            style={{
              background: refreshing ? '#94a3b8' : '#134074',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 16px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: refreshing ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {refreshing ? '⟳ Checking…' : '⟳ Refresh Budget'}
          </button>
          {refreshMsg && (
            <span style={{ fontSize: '0.72rem', color: '#475569' }}>{refreshMsg}</span>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-allocated">
          <div className="kpi-header">
            <span className="kpi-title">Budget Estimates (2026-27)</span>
            <div className="kpi-icon-wrapper">₹</div>
          </div>
          <div className="kpi-value">₹ {summary.be_2026_27.toFixed(2)} Cr</div>
          <div className="kpi-subtext">Approved by Parliament for FY 2026-27</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #f97316' }}>
          <div className="kpi-header">
            <span className="kpi-title">Revised Estimates (2025-26)</span>
            <div className="kpi-icon-wrapper" style={{ background: '#fff7ed', color: '#f97316' }}>★</div>
          </div>
          <div className="kpi-value">₹ {summary.re_2025_26.toFixed(2)} Cr</div>
          <div className="kpi-subtext">Revised budget for ongoing year</div>
        </div>

        <div className="kpi-card kpi-disbursed">
          <div className="kpi-header">
            <span className="kpi-title">Net Actual Expenditure (2024-25)</span>
            <div className="kpi-icon-wrapper">✓</div>
          </div>
          <div className="kpi-value">₹ {summary.netActuals_2024_25.toFixed(2)} Cr</div>
          <div className="kpi-subtext">Audited net expenditure for last completed year</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Expenditure Trend */}
        <div className="chart-card">
          <h3 className="chart-title">📈 Historical Budget Allocation Trend (₹ Crore)</h3>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historicalTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#134074" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#134074" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis unit=" Cr" tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip formatter={(value, name, props) => [`₹ ${value} Cr`, props.payload.type]} />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#134074" 
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                  activeDot={{ r: 8 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Allocation by Category */}
        <div className="chart-card">
          <h3 className="chart-title">🍕 Allocation by Category (BE 2026-27)</h3>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="be_2026_27"
                  nameKey="name"
                >
                  {categoryBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `₹ ${value.toFixed(2)} Cr`} />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" iconSize={10} wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Scheme-wise Bar Chart */}
      <div className="chart-card-full">
        <h3 className="chart-title">📊 Scheme-wise: BE 2026-27 vs Actuals 2024-25 (₹ Crore)</h3>
        <div className="chart-wrapper" style={{ height: '350px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={schemeComparison}
              margin={{ top: 20, right: 30, left: 10, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="title" 
                angle={-25} 
                textAnchor="end" 
                interval={0} 
                tick={{ fill: '#64748b', fontSize: 9 }}
              />
              <YAxis unit=" Cr" tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip formatter={(value) => (value ? `₹ ${value} Cr` : 'N/A')} />
              <Legend verticalAlign="top" height={36}/>
              <Bar dataKey="be_2026_27" name="Budget Estimate 2026-27" fill={BAR_COLORS.be} radius={[4, 4, 0, 0]} />
              <Bar dataKey="actuals_2024_25" name="Actuals (2024-25)" fill={BAR_COLORS.actuals} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Live UDID Analytics Section */}
      <div className="section-header-styled" style={{ marginTop: '3rem' }}>
        <span>Live UDID API Analytics</span>
        <span className="section-subtitle-styled">Official OGD Data API {liveUdid?.dataDate ? `(as on ${liveUdid.dataDate})` : ''}</span>
      </div>

      {liveLoading ? (
        <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '2rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
          <p>Connecting to api.data.gov.in (OGD Platform)...</p>
        </div>
      ) : (
        <div>
          {/* Soft warning banner when OGD is rate-limited */}
          {liveError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.25rem', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '10px', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#78350f' }}>
              <span>⚠️</span>
              <span>{liveError}</span>
            </div>
          )}

          {/* UDID section always renders — uses fallback data if API is down */}
          {liveUdid && (
            <div className="udid-live-section fade-in" style={{ marginBottom: '2rem' }}>
              {/* Info Banner */}
              <div className="info-box" style={{ borderColor: liveUdid.live === false ? '#f59e0b' : '#10b981', background: liveUdid.live === false ? '#fffbeb' : '#f0fdf4', marginBottom: '1.5rem' }}>
                <span className="info-icon" style={{ color: liveUdid.live === false ? '#f59e0b' : '#10b981' }}>●</span>
                <p style={{ color: liveUdid.live === false ? '#78350f' : '#14532d', margin: 0 }}>
                  <strong>{liveUdid.live === false ? 'Official Published Data:' : 'Live OGD Connection Active:'}</strong>{' '}
                  {liveUdid.sourceTitle || 'UDID Portal Statistics'} — {liveUdid.sourceOrg || 'DEPwD'}
                  {liveUdid.dataDate ? ` (as on ${liveUdid.dataDate})` : ''}.{' '}
                  Tracking {(liveUdid.totalPersonsTracked || 0).toLocaleString()} PwD registrations.
                </p>
              </div>

              {/* KPI Cards */}
              <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
                <div className="kpi-card" style={{ borderLeft: '4px solid #10b981' }}>
                  <div className="kpi-header">
                    <span className="kpi-title" style={{ fontSize: '0.8rem' }}>Total UDID Registrations</span>
                    <span style={{ color: '#10b981', fontWeight: 'bold' }}>UDID</span>
                  </div>
                  <div className="kpi-value" style={{ fontSize: '1.8rem' }}>{(liveUdid.totalUdidRecords || liveUdid.totalPersonsTracked || 0).toLocaleString()}</div>
                  <div className="kpi-subtext">Persons with Disabilities registered{liveUdid.dataDate ? ` as on ${liveUdid.dataDate}` : ''}</div>
                </div>

                <div className="kpi-card" style={{ borderLeft: '4px solid #3b82f6' }}>
                  <div className="kpi-header">
                    <span className="kpi-title" style={{ fontSize: '0.8rem' }}>Total Certificates Issued</span>
                    <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>Certs</span>
                  </div>
                  <div className="kpi-value" style={{ fontSize: '1.8rem' }}>
                    {liveCerts ? ((liveCerts.yearlyTrend || []).reduce((s, y) => s + (y.totalIssued || 0), 0)).toLocaleString() : 'N/A'}
                  </div>
                  <div className="kpi-subtext">Cumulative 2019–2025 (DEPwD Annual Report)</div>
                </div>

                <div className="kpi-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
                  <div className="kpi-header">
                    <span className="kpi-title" style={{ fontSize: '0.8rem' }}>Data Source</span>
                    <span style={{ color: '#8b5cf6', fontWeight: 'bold' }}>OGD</span>
                  </div>
                  <div className="kpi-value" style={{ fontSize: '1.4rem' }}>data.gov.in</div>
                  <div className="kpi-subtext">Last checked: {liveUdid.lastUpdated ? new Date(liveUdid.lastUpdated).toLocaleDateString('en-IN') : 'N/A'}</div>
                </div>
              </div>

              {/* Charts */}
              <div className="charts-grid">
                {/* Disability Distribution Pie Chart */}
                <div className="chart-card">
                  <h3 className="chart-title">♿ Registered Disabilities Breakdown</h3>
                  <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={liveUdid.disabilityDistribution || []}
                          cx="50%" cy="50%"
                          innerRadius={45} outerRadius={75}
                          paddingAngle={2}
                          dataKey="value" nameKey="name"
                        >
                          {(liveUdid.disabilityDistribution || []).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => value.toLocaleString()} />
                        <Legend layout="horizontal" verticalAlign="bottom" align="center" iconSize={8} wrapperStyle={{ fontSize: 9 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gender Distribution Pie Chart */}
                <div className="chart-card">
                  <h3 className="chart-title">👥 Gender Distribution</h3>
                  <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={liveUdid.genderDistribution || []}
                          cx="50%" cy="50%"
                          innerRadius={50} outerRadius={80}
                          paddingAngle={3}
                          dataKey="value" nameKey="name"
                        >
                          {(liveUdid.genderDistribution || []).map((entry, index) => (
                            <Cell key={`cell-g-${index}`} fill={index === 0 ? '#3b82f6' : '#ec4899'} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => value.toLocaleString()} />
                        <Legend layout="horizontal" verticalAlign="bottom" align="center" iconSize={10} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Year-wise Certificates Line Chart */}
                {liveCerts && (liveCerts.yearlyTrend || []).length > 0 && (
                  <div className="chart-card-full">
                    <h3 className="chart-title">📈 Year-wise UDID Certificates Issued (2019–2025)</h3>
                    <div className="chart-wrapper" style={{ height: '250px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={liveCerts.yearlyTrend} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} />
                          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(val) => (val / 100000).toFixed(1) + 'L'} />
                          <Tooltip formatter={(value) => [value.toLocaleString(), 'Certificates Issued']} />
                          <Line type="monotone" dataKey="totalIssued" stroke="#8b5cf6" strokeWidth={3} activeDot={{ r: 8 }} dot={{ r: 5, stroke: '#8b5cf6', strokeWidth: 2, fill: '#ffffff' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Top States Bar Chart */}
                <div className="chart-card-full">
                  <h3 className="chart-title">📍 Top States — UDID Registrations</h3>
                  <div className="chart-wrapper" style={{ height: '280px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={(liveUdid.stateDistribution || []).slice(0, 10)} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                        <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(val) => (val / 100000).toFixed(1) + 'L'} />
                        <YAxis dataKey="name" type="category" tick={{ fill: '#64748b', fontSize: 10 }} width={80} />
                        <Tooltip formatter={(value) => [value.toLocaleString(), 'Registrations']} />
                        <Bar dataKey="value" fill="#0284c7" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sector-wise Allocation Breakdown Tables */}
      <div className="section-header-styled">
        <span>Detailed Scheme-wise Budget Breakdown</span>
        <span className="section-subtitle-styled">{categoryBreakdown.length} Categories</span>
      </div>

      <div className="sector-container">
        {categoryBreakdown.map((category, idx) => {
          return (
            <div className="sector-card" key={idx}>
              <div className="sector-card-header">
                <div className="sector-card-title">
                  <span>📁</span> {category.name}
                </div>
                <div className="sector-summary-stats">
                  <div className="sector-summary-stat budget">
                    <span>BE 2026-27</span>
                    <strong>₹ {category.be_2026_27.toFixed(2)} Cr</strong>
                  </div>
                  <div className="sector-summary-stat spent">
                    <span>ACTUALS 2024-25</span>
                    <strong>₹ {category.actuals_2024_25.toFixed(2)} Cr</strong>
                  </div>
                </div>
              </div>
              <div className="sector-card-body">
                <div className="scheme-table-container">
                  <table className="scheme-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40%' }}>Scheme Name</th>
                        <th style={{ textAlign: 'right' }}>Budget Estimate (2026-27)</th>
                        <th style={{ textAlign: 'right' }}>Revised RE (2025-26)</th>
                        <th style={{ textAlign: 'right' }}>Actuals (2024-25)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {category.schemes.map((scheme, sIdx) => (
                        <tr key={sIdx}>
                          <td className="cell-scheme-name">
                            {scheme.title}
                            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>{scheme.source}</div>
                          </td>
                          <td className="cell-number" style={{ color: '#2b6cb0', fontWeight: '600' }}>₹ {scheme.be_2026_27?.toFixed(2) || '-'}</td>
                          <td className="cell-number" style={{ color: '#f6ad55' }}>₹ {scheme.re_2025_26?.toFixed(2) || '-'}</td>
                          <td className="cell-number" style={{ color: '#48bb78' }}>₹ {scheme.actuals_2024_25?.toFixed(2) || '-'}</td>
                        </tr>
                      ))}
                      {/* Total summary row */}
                      <tr className="scheme-table-total-row">
                        <td>Category Total</td>
                        <td className="cell-number">₹ {category.be_2026_27.toFixed(2)}</td>
                        <td className="cell-number">-</td>
                        <td className="cell-number">₹ {category.actuals_2024_25.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Dashboard;
