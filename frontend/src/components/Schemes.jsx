import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Schemes.css';

const API_BASE_URL = 'http://localhost:5001/api';

const formatCrore = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A';
  return `₹${Number(value).toFixed(2)} Cr`;
};

const Schemes = () => {
  const [schemes, setSchemes] = useState([]);
  const [filteredSchemes, setFilteredSchemes] = useState([]);
  const [categories, setCategories] = useState(['All']);
  const [activeCategory, setActiveCategory] = useState('All');
  const [expandedCard, setExpandedCard] = useState(null); // stores code of expanded card
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSchemes = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/schemes`);
        setSchemes(response.data);
        setFilteredSchemes(response.data);
        
        // Extract unique categories from the schemes data
        const uniqueCategories = ['All', ...new Set(response.data.map(s => s.category))];
        setCategories(uniqueCategories);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching schemes:', err);
        setError('Failed to fetch schemes data from the backend.');
        setLoading(false);
      }
    };

    fetchSchemes();
  }, []);

  const handleFilterClick = (category) => {
    setActiveCategory(category);
    if (category === 'All') {
      setFilteredSchemes(schemes);
    } else {
      setFilteredSchemes(schemes.filter(s => s.category === category));
    }
    setExpandedCard(null); // Collapse any open card when filter changes
  };

  const toggleExpand = (code) => {
    if (expandedCard === code) {
      setExpandedCard(null);
    } else {
      setExpandedCard(code);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading schemes directory...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p className="error-msg">{error}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="schemes-container fade-in">
      <div className="schemes-controls">
        {/* Category Pill Filters */}
        <div className="filters-bar">
          {categories.map((category, idx) => (
            <button
              key={idx}
              className={`filter-btn ${activeCategory === category ? 'active' : ''}`}
              onClick={() => handleFilterClick(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="results-count">
        {filteredSchemes.length} schemes found
      </div>

      {/* Grid of Scheme Cards */}
      <div className="schemes-grid">
        {filteredSchemes.map((scheme) => {
          const isExpanded = expandedCard === scheme.code;
          
          return (
            <div className="scheme-card" key={scheme.code}>
              <div className="scheme-card-header">
                <div className="scheme-card-tags">
                  <span
                    className={`scheme-tag-type ${
                      scheme.type === 'Central Sector'
                        ? 'tag-central-sector'
                        : 'tag-centrally-sponsored'
                    }`}
                  >
                    {scheme.type}
                  </span>
                  <span className="scheme-tag-category">{scheme.category}</span>
                </div>
                <h3>{scheme.title}</h3>
                <div className="scheme-card-subtitle">{scheme.subtitle}</div>
              </div>

              <div className="scheme-card-body">
                <p className="scheme-card-description">{scheme.description}</p>
                
                {/* Official Budget Metrics */}
                <div className="scheme-card-metrics">
                  <div className="card-metric-item">
                    <span className="card-metric-label">BE 2026-27</span>
                    <span className="card-metric-value allocated">{formatCrore(scheme.be_2026_27)}</span>
                  </div>
                  <div className="card-metric-item">
                    <span className="card-metric-label">RE 2025-26</span>
                    <span className="card-metric-value utilized">{formatCrore(scheme.re_2025_26)}</span>
                  </div>
                  <div className="card-metric-item">
                    <span className="card-metric-label">Actuals 2024-25</span>
                    <span className="card-metric-value gap">{formatCrore(scheme.actuals_2024_25)}</span>
                  </div>
                </div>

                {/* Official source note */}
                <div className="scheme-card-progress">
                  <div className="card-progress-header">
                    <span>Official Source</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem', lineHeight: '1.4' }}>
                    {scheme.source || 'Union Budget 2026-27, Demand No. 94'}
                  </p>
                </div>
              </div>

              {/* Expanded details drawer */}
              {isExpanded && (
                <div className="scheme-card-details fade-in">
                  <div className="detail-row">
                    <strong>💡 Key Benefits & Funding</strong>
                    <span>{scheme.details.benefits}</span>
                  </div>
                  <div className="detail-row">
                    <strong>📋 Eligibility Requirements</strong>
                    <span>
                      Requires certified disability of at least{' '}
                      <strong>{scheme.eligibilityCriteria.minDisability}%</strong>.{' '}
                      {scheme.eligibilityCriteria.maxMonthlyIncome && (
                        <>Family monthly income must be below <strong>₹{scheme.eligibilityCriteria.maxMonthlyIncome.toLocaleString()}</strong>. </>
                      )}
                      {scheme.eligibilityCriteria.maxAnnualIncome && (
                        <>Family annual income must be below <strong>₹{scheme.eligibilityCriteria.maxAnnualIncome.toLocaleString()}</strong>. </>
                      )}
                      {scheme.eligibilityCriteria.studentOnly && (
                        <>Scheme is exclusively for <strong>active students</strong>. </>
                      )}
                      {scheme.eligibilityCriteria.minAge > 0 && (
                        <>Applicant age range: <strong>{scheme.eligibilityCriteria.minAge}-{scheme.eligibilityCriteria.maxAge} years</strong>. </>
                      )}
                    </span>
                  </div>
                  <div className="detail-row">
                    <strong>📄 Budget Data Source</strong>
                    <span>{scheme.source || 'Union Budget 2026-27, Demand No. 94'}</span>
                  </div>
                  <div className="detail-row">
                    <strong>🌐 Official Website / Apply</strong>
                    <span>
                      <a href={scheme.details.website} target="_blank" rel="noopener noreferrer">
                        Visit Portal ↗
                      </a>
                    </span>
                  </div>
                </div>
              )}

              {/* Expand Trigger Button */}
              <button
                className={`expand-btn ${isExpanded ? 'active' : ''}`}
                onClick={() => toggleExpand(scheme.code)}
              >
                <span>{isExpanded ? 'Show Less' : 'More Info & Eligibility'}</span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Schemes;
