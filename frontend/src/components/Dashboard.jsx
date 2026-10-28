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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [liveUdid, setLiveUdid] = useState(null);
  const [liveCerts, setLiveCerts] = useState(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveError, setLiveError] = useState(null);

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
        setLiveError('Failed to fetch live API statistics.');
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

      {/* Data Source Info Box */}
      <div className="info-box">
        <span className="info-icon">ℹ</span>
        <p>
          <strong>Official Data Source:</strong> Financial figures are sourced from <em>{sourceInfo.sourceTitle || 'Notes on Demands for Grants, Union Budget 2026-27 (Demand No. 94)'}</em> via indiabudget.gov.in. Verified on {sourceInfo.verifiedOn || 'official source file'}. UDID statistics use Open Government Data (OGD) APIs when an API key is configured.
        </p>
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
        <div className="loading-card" style={{ padding: '2rem', textAlign: 'center', background: 'var(--card-bg)', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
          <p>Connecting to api.data.gov.in (OGD Platform)...</p>
        </div>
      ) : liveError ? (
        <div className="error-card" style={{ padding: '1.5rem', color: '#ef4444', background: '#fef2f2', borderRadius: 'var(--border-radius-md)', border: '1px solid #fee2e2', marginBottom: '2rem' }}>
          <p>{liveError}</p>
        </div>
      ) : (
        <div className="udid-live-section fade-in" style={{ marginBottom: '2rem' }}>
          <div
            className="info-box"
            style={{
              borderColor: liveUdid?.live === false || liveCerts?.live === false ? '#f59e0b' : '#10b981',
              background: liveUdid?.live === false || liveCerts?.live === false ? '#fffbeb' : '#f0fdf4',
              marginBottom: '1.5rem'
            }}
          >
            <span
              className="info-icon"
              style={{ color: liveUdid?.live === false || liveCerts?.live === false ? '#f59e0b' : '#10b981' }}
            >
              ●
            </span>
            <p style={{ color: liveUdid?.live === false || liveCerts?.live === false ? '#78350f' : '#14532d' }}>
              <strong>{liveUdid?.live === false || liveCerts?.live === false ? 'Cached OGD Data:' : 'Live OGD Connection Active:'}</strong>{' '}
              {liveUdid?.live === false || liveCerts?.live === false
                ? 'The last successful data.gov.in response is being shown because the latest refresh failed.'
                : <>Successfully synced data from <em>{liveUdid.sourcePlatform}</em>.</>
              }{' '}
              Fetched {liveUdid.recordsFetched?.toLocaleString?.() || liveUdid.sampleRecordsAnalyzed.toLocaleString()} of {liveUdid.totalRecordsAvailable?.toLocaleString?.() || liveUdid.totalUdidRecords.toLocaleString()} official records from the UDID API{liveUdid.dataDate ? ` as on ${liveUdid.dataDate}` : ''}. These fetched records map {liveUdid.totalPersonsTracked.toLocaleString()} PwD registrations.{liveUdid.partialData ? ' This is partial official data because the public sample API key/data.gov.in limit restricts rows per request. Use your generated API key for fuller access.' : ''}
            </p>
          </div>

          <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="kpi-card" style={{ borderLeft: '4px solid #10b981' }}>
              <div className="kpi-header">
                <span className="kpi-title" style={{ fontSize: '0.8rem' }}>Total Certificates Issued</span>
                <span style={{ color: liveCerts?.live === false ? '#f59e0b' : '#10b981', fontWeight: 'bold' }}>{liveCerts?.live === false ? 'Cached' : 'Live'}</span>
              </div>
              <div className="kpi-value" style={{ fontSize: '1.8rem' }}>{liveCerts.totalIssued.toLocaleString()}</div>
              <div className="kpi-subtext">Issued between 2019 and 2025</div>
            </div>

            <div className="kpi-card" style={{ borderLeft: '4px solid #3b82f6' }}>
              <div className="kpi-header">
                <span className="kpi-title" style={{ fontSize: '0.8rem' }}>Registrations in Fetched Records</span>
                <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>PwD</span>
              </div>
              <div className="kpi-value" style={{ fontSize: '1.8rem' }}>{liveUdid.totalPersonsTracked.toLocaleString()}</div>
              <div className="kpi-subtext">UDID demographic dataset {liveUdid.dataDate ? `as on ${liveUdid.dataDate}` : 'from data.gov.in'}</div>
            </div>

            <div className="kpi-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
              <div className="kpi-header">
                <span className="kpi-title" style={{ fontSize: '0.8rem' }}>API Data Source</span>
                <span style={{ color: '#8b5cf6', fontWeight: 'bold' }}>OGD</span>
              </div>
              <div className="kpi-value" style={{ fontSize: '1.4rem' }}>data.gov.in</div>
              <div className="kpi-subtext">Last synced: {new Date(liveUdid.lastUpdated).toLocaleTimeString()} · {liveUdid.recordsFetched || liveUdid.sampleRecordsAnalyzed} records fetched</div>
            </div>
          </div>

          <div className="charts-grid">
            {/* Top States (Certificates Issued) */}
            <div className="chart-card">
              <h3 className="chart-title">📍 Top States (UDID Certificates Issued)</h3>
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={liveCerts.stateData} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} />
                    <YAxis dataKey="state" type="category" tick={{ fill: '#64748b', fontSize: 10 }} width={80} />
                    <Tooltip formatter={(value) => [value.toLocaleString(), 'Certificates']} />
                    <Bar dataKey="total" fill="#0284c7" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Disability Distribution */}
            <div className="chart-card">
              <h3 className="chart-title">♿ Registered Disabilities Breakdown</h3>
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={liveUdid.disabilityDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                    >
                      {liveUdid.disabilityDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => value.toLocaleString()} />
                    <Legend layout="horizontal" verticalAlign="bottom" align="center" iconSize={8} wrapperStyle={{ fontSize: 9 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Yearly Trend of Certificates Issued */}
            <div className="chart-card-full">
              <h3 className="chart-title">📈 Year-wise UDID Certificates Issued (2019 to 2025)</h3>
              <div className="chart-wrapper" style={{ height: '250px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={liveCerts.yearlyTrend} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(val) => (val/1000) + 'k'} />
                    <Tooltip formatter={(value) => [value.toLocaleString(), 'Certificates']} />
                    <Line
                      type="monotone"
                      dataKey="issued"
                      stroke="#8b5cf6"
                      strokeWidth={3}
                      activeDot={{ r: 8 }}
                      dot={{ r: 5, stroke: '#8b5cf6', strokeWidth: 2, fill: '#ffffff' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
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
