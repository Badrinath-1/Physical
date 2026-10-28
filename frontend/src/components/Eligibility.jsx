import React, { useState } from 'react';
import axios from 'axios';
import './Eligibility.css';

const API_BASE_URL = 'http://localhost:5001/api';

const DISABILITY_TYPES = [
  'Locomotor',
  'Visual',
  'Hearing',
  'Mental',
  'Multiple'
];

const Eligibility = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    age: '',
    annualIncome: '',
    disabilityType: 'Locomotor',
    disabilityPercentage: '',
    udidStatus: 'no',
    employmentStatus: 'unemployed',
    educationStatus: 'student'
  });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const nextStep = () => {
    // Basic validations per step
    if (step === 1) {
      if (formData.age === '' || Number(formData.age) < 0 || Number(formData.age) > 120) {
        alert('Please enter a valid age (0 - 120).');
        return;
      }
      if (formData.annualIncome === '' || Number(formData.annualIncome) < 0) {
        alert('Please enter a valid family annual income.');
        return;
      }
    } else if (step === 2) {
      const pct = Number(formData.disabilityPercentage);
      if (formData.disabilityPercentage === '' || pct < 0 || pct > 100) {
        alert('Please enter a valid disability percentage (0 - 100).');
        return;
      }
    }
    setStep(step + 1);
  };

  const prevStep = () => {
    setStep(step - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/eligibility`, {
        age: Number(formData.age),
        annualIncome: Number(formData.annualIncome),
        disabilityType: formData.disabilityType,
        disabilityPercentage: Number(formData.disabilityPercentage),
        udidStatus: formData.udidStatus,
        employmentStatus: formData.employmentStatus,
        educationStatus: formData.educationStatus
      });
      setResults(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Error submitting eligibility form:', err);
      setError('Connection to backend eligibility service failed.');
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      age: '',
      annualIncome: '',
      disabilityType: 'Locomotor',
      disabilityPercentage: '',
      udidStatus: 'no',
      employmentStatus: 'unemployed',
      educationStatus: 'student'
    });
    setResults(null);
    setStep(1);
  };

  // Render form step wizards
  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="form-step fade-in">
            <h3 className="form-step-title">Step 1: Personal Details</h3>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="age">Applicant Age (Years)</label>
                <input
                  type="number"
                  id="age"
                  name="age"
                  value={formData.age}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="e.g. 24"
                  min="0"
                  max="120"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="annualIncome">Total Family Annual Income (₹)</label>
                <input
                  type="number"
                  id="annualIncome"
                  name="annualIncome"
                  value={formData.annualIncome}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="e.g. 150000"
                  min="0"
                  required
                />
              </div>
            </div>
            <div className="form-buttons" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-primary" onClick={nextStep}>
                Next Step ➔
              </button>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="form-step fade-in">
            <h3 className="form-step-title">Step 2: Disability Profile</h3>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="disabilityType">Primary Disability Category</label>
                <select
                  id="disabilityType"
                  name="disabilityType"
                  value={formData.disabilityType}
                  onChange={handleInputChange}
                  className="form-select"
                >
                  {DISABILITY_TYPES.map((type, idx) => (
                    <option key={idx} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="disabilityPercentage">Disability Percentage (%)</label>
                <input
                  type="number"
                  id="disabilityPercentage"
                  name="disabilityPercentage"
                  value={formData.disabilityPercentage}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="e.g. 60"
                  min="0"
                  max="100"
                  required
                />
              </div>
              <div className="form-group form-grid-full">
                <label htmlFor="udidStatus">Do you hold a UDID / Swavlamban Card?</label>
                <select
                  id="udidStatus"
                  name="udidStatus"
                  value={formData.udidStatus}
                  onChange={handleInputChange}
                  className="form-select"
                >
                  <option value="yes">Yes, I have an active UDID card</option>
                  <option value="no">No, I do not have a card yet</option>
                </select>
              </div>
            </div>
            <div className="form-buttons">
              <button type="button" className="btn btn-secondary" onClick={prevStep}>
                Back
              </button>
              <button type="button" className="btn btn-primary" onClick={nextStep}>
                Next Step ➔
              </button>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="form-step fade-in">
            <h3 className="form-step-title">Step 3: Education & Livelihood</h3>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="educationStatus">Current Educational Status</label>
                <select
                  id="educationStatus"
                  name="educationStatus"
                  value={formData.educationStatus}
                  onChange={handleInputChange}
                  className="form-select"
                >
                  <option value="student">Currently studying / Student</option>
                  <option value="completed_12th">Completed 12th Standard</option>
                  <option value="graduate">College Graduate or higher</option>
                  <option value="other">Other / No Formal Schooling</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="employmentStatus">Current Employment Status</label>
                <select
                  id="employmentStatus"
                  name="employmentStatus"
                  value={formData.employmentStatus}
                  onChange={handleInputChange}
                  className="form-select"
                >
                  <option value="unemployed">Unemployed</option>
                  <option value="self_employed">Self Employed / business owner</option>
                  <option value="employed">Salaried Employee</option>
                </select>
              </div>
            </div>
            <div className="form-buttons">
              <button type="button" className="btn btn-secondary" onClick={prevStep}>
                Back
              </button>
              <button type="submit" className="btn btn-success">
                Check Eligibility ✓
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Evaluating scheme rules and data...</p>
      </div>
    );
  }

  if (results) {
    const { eligible, ineligible, eligibleCount } = results;

    return (
      <div className="eligibility-container fade-in">
        <div className="results-summary-card">
          <div className="results-count-circle">{eligibleCount}</div>
          <h2>Evaluation Complete</h2>
          <p>
            Based on your age ({formData.age}), annual family income (₹{Number(formData.annualIncome).toLocaleString()}), disability type ({formData.disabilityType}), and disability percentage ({formData.disabilityPercentage}%), you qualify for the following programs:
          </p>
          <button className="btn btn-secondary" onClick={resetForm}>
            Reset & Check Again
          </button>
        </div>

        {/* Eligible Schemes Section */}
        {eligible.length > 0 && (
          <div className="results-section">
            <h3 className="results-section-title" style={{ color: 'var(--success)' }}>
              <span>✓</span> Eligible Schemes ({eligible.length})
            </h3>
            <div className="eligible-cards">
              {eligible.map((scheme) => (
                <div className="result-card" key={scheme.code}>
                  <div className="result-card-header">
                    <div className="result-card-title">
                      <h3>{scheme.title}</h3>
                      <span>{scheme.category} • {scheme.type}</span>
                    </div>
                    <span className="badge badge-success">Eligible</span>
                  </div>
                  <div className="result-card-body">
                    <p>{scheme.description}</p>
                    <div className="result-benefits">
                      <strong>💡 Scheme Benefit Summary:</strong>
                      {scheme.details.benefits}
                    </div>
                  </div>
                  <div className="result-card-footer">
                    <a href={scheme.details.website} target="_blank" rel="noopener noreferrer">
                      Visit Official Portal ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ineligible Schemes Section */}
        {ineligible.length > 0 && (
          <div className="results-section" style={{ marginTop: '2.5rem' }}>
            <h3 className="results-section-title" style={{ color: 'var(--text-muted)' }}>
              <span>𐄂</span> Other Schemes Reviewed ({ineligible.length})
            </h3>
            <div className="eligible-cards">
              {ineligible.map(({ scheme, reasons }, idx) => (
                <div className="result-card ineligible" key={idx}>
                  <div className="result-card-header">
                    <div className="result-card-title">
                      <h3>{scheme.title}</h3>
                      <span>{scheme.category} • {scheme.type}</span>
                    </div>
                    <span className="badge badge-warning" style={{ backgroundColor: '#f1f5f9', color: '#64748b' }}>
                      Not Eligible
                    </span>
                  </div>
                  <div className="result-card-body">
                    <p>{scheme.description}</p>
                    <div className="mismatch-reasons">
                      <strong>⚠️ Mismatch Reasons:</strong>
                      <ul>
                        {reasons.map((r, rIdx) => (
                          <li key={rIdx}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="result-card-footer">
                    <a href={scheme.details.website} target="_blank" rel="noopener noreferrer" style={{ color: '#94a3b8' }}>
                      Scheme Details ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="eligibility-container fade-in">
      {/* Step Progress Line */}
      <div className="steps-indicator">
        <div
          className="steps-progress-line"
          style={{ width: `${((step - 1) / 2) * 100}%` }}
        ></div>
        <div className={`step-item ${step === 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
          <div className="step-circle">{step > 1 ? '✓' : '1'}</div>
          <span className="step-label">Profile</span>
        </div>
        <div className={`step-item ${step === 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
          <div className="step-circle">{step > 2 ? '✓' : '2'}</div>
          <span className="step-label">Disability</span>
        </div>
        <div className={`step-item ${step === 3 ? 'active' : ''}`}>
          <div className="step-circle">3</div>
          <span className="step-label">Livelihood</span>
        </div>
      </div>

      <div className="eligibility-card">
        <form onSubmit={handleSubmit}>
          {renderStepContent()}
        </form>
      </div>

      {error && (
        <div className="info-box" style={{ borderLeftColor: '#be123c', backgroundColor: '#fff5f5' }}>
          <span className="info-icon" style={{ color: '#be123c' }}>⚠</span>
          <p style={{ color: '#be123c' }}>{error}</p>
        </div>
      )}
    </div>
  );
};

export default Eligibility;
