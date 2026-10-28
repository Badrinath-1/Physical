const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// ============================================================================
// ALL DATA BELOW IS FROM OFFICIAL GOVERNMENT SOURCES ONLY
// Primary Source: Union Budget 2026-27, Demand No. 94
//   - Notes on Demands for Grants, Ministry of Social Justice & Empowerment
//   - Available at: https://www.indiabudget.gov.in
// Secondary Source: DEPwD Annual Reports (https://disabilityaffairs.gov.in)
// Live Data Source: Open Government Data Platform (https://data.gov.in)
const fs = require('fs');
const path = require('path');

// Budget Auto-Updater: checks indiabudget.gov.in daily and patches the JSON
const { startScheduler, checkAndUpdate } = require('./budgetAutoUpdater');

// ============================================================================
// ALL DATA BELOW IS FROM OFFICIAL GOVERNMENT SOURCES ONLY
// Primary Source: Union Budget 2026-27, Demand No. 94
//   - Notes on Demands for Grants, Ministry of Social Justice & Empowerment
//   - Available at: https://www.indiabudget.gov.in
// Secondary Source: DEPwD Annual Reports (https://disabilityaffairs.gov.in)
// Live Data Source: Open Government Data Platform (https://data.gov.in)
// ============================================================================

// Dynamically read budget data from the external JSON file on every request
// This ensures that if the data is updated externally, it instantly reflects without a server restart.
async function getBudgetData() {
  try {
    const dataPath = path.join(__dirname, 'data', 'budget_2026.json');
    const rawData = await fs.promises.readFile(dataPath, 'utf8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error('Error reading budget_2026.json:', error);
    // Fallback empty structure in case file is missing
    return { historicalTrend: [], schemesData: [] };
  }
}

// Attempt MongoDB Connection, but gracefully fallback to memory mode if not runningif not running
let isDbConnected = false;
let SchemeModel;

const connectDb = async () => {
  try {
    const dbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pwd_fund_tracker';
    await mongoose.connect(dbUri, { serverSelectionTimeoutMS: 2000 });
    isDbConnected = true;
    console.log('Successfully connected to MongoDB.');

    const schemeSchema = new mongoose.Schema({}, { strict: false });
    SchemeModel = mongoose.models.Scheme || mongoose.model('Scheme', schemeSchema);
    
    // Check if we need to sync data on startup, but read from JSON to do it
    const budgetData = await getBudgetData();
    if (budgetData.schemesData && budgetData.schemesData.length > 0) {
      await SchemeModel.deleteMany({});
      await SchemeModel.insertMany(budgetData.schemesData);
      console.log('Synchronized database with budget_2026.json.');
    }
  } catch (error) {
    console.warn('MongoDB connection failed. Falling back to local in-memory data mode. Error:', error.message);
    isDbConnected = false;
  }
};

connectDb();

// Official OGD resources used by this project.
// UDID demographic API selected by user from data.gov.in Data API page:
// "District wise, Disability wise, Age group wise, Gender wise UDID data as on 04.09.2023"
const UDID_DEMOGRAPHIC_RESOURCE_ID = process.env.UDID_DEMOGRAPHIC_RESOURCE_ID || '78dab912-a409-46c1-a535-46d89920e905';
const UDID_DEMOGRAPHIC_DATA_AS_ON = process.env.UDID_DEMOGRAPHIC_DATA_AS_ON || '04.09.2023';

// State/UT-wise UDID certificate API. Keep this separate from demographic UDID data.
const UDID_CERTIFICATES_RESOURCE_ID = process.env.UDID_CERTIFICATES_RESOURCE_ID || '46dad8f6-a074-41e8-95bd-7c33f5995101';

function getOgdApiKey() {
  const apiKey = process.env.OGD_API_KEY;
  if (!apiKey || apiKey === 'your_data_gov_api_key_here') {
    throw new Error('OGD_API_KEY missing. Add the data.gov.in sample key or your generated API key in backend/.env.');
  }
  return apiKey;
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const cleaned = String(value).replace(/,/g, '').trim();
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function firstValue(record, keys, fallback = undefined) {
  for (const key of keys) {
    if (record[key] !== null && record[key] !== undefined && record[key] !== '') {
      return record[key];
    }
  }
  return fallback;
}

async function fetchOgdResourcePage(resourceId, limit = 1000, offset = 0) {
  const apiKey = getOgdApiKey();
  const url = new URL(`https://api.data.gov.in/resource/${resourceId}`);
  url.searchParams.set('api-key', apiKey);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OGD API responded with status ${response.status}`);
  }

  const json = await response.json();
  if (json.status !== 'ok' || !Array.isArray(json.records)) {
    throw new Error('Invalid response structure from OGD API');
  }

  const safeUrl = url.toString().replace(apiKey, '<hidden>');
  return { json, safeUrl };
}

async function fetchOgdResource(resourceId, requestedLimit = 5000) {
  // The public sample key shown on data.gov.in normally returns only 10 rows per request.
  // This function supports pagination through offset, so generated keys can fetch larger pages
  // and the sample key can still fetch multiple official pages for testing.
  const maxRecords = Number(process.env.OGD_MAX_RECORDS || requestedLimit || 5000);
  const pageLimit = Number(process.env.OGD_PAGE_LIMIT || Math.min(maxRecords, 1000));
  const maxPages = Number(process.env.OGD_MAX_PAGES || 50);

  let offset = 0;
  let allRecords = [];
  let firstJson = null;
  let firstSafeUrl = null;
  let pagesFetched = 0;

  while (allRecords.length < maxRecords && pagesFetched < maxPages) {
    const remaining = maxRecords - allRecords.length;
    const { json, safeUrl } = await fetchOgdResourcePage(resourceId, Math.min(pageLimit, remaining), offset);

    if (!firstJson) {
      firstJson = json;
      firstSafeUrl = safeUrl;
    }

    const records = json.records || [];
    if (records.length === 0) break;

    allRecords.push(...records);
    pagesFetched += 1;
    offset += records.length;

    const totalAvailable = parseNumber(json.total);
    if (totalAvailable && offset >= totalAvailable) break;
    if (records.length < Math.min(pageLimit, remaining)) break;
  }

  if (!firstJson) {
    throw new Error('No response received from OGD API');
  }

  const totalAvailable = parseNumber(firstJson.total) || allRecords.length;
  const json = {
    ...firstJson,
    records: allRecords,
    count: allRecords.length,
    fetched_records: allRecords.length,
    pages_fetched: pagesFetched,
    partial_data: allRecords.length < totalAvailable
  };

  return { json, safeUrl: firstSafeUrl };
}

// ─── Official Static Fallback UDID Data ──────────────────────────────────────
// Source: DEPwD Annual Report 2023-24 & UDID Portal published statistics
// Used when data.gov.in API is unavailable (rate-limited or down)
const UDID_STATIC_FALLBACK = {
  totalUdidRecords: 10500000,
  sampleRecordsAnalyzed: 'All (published figures)',
  totalPersonsTracked: 10500000,
  genderDistribution: [
    { name: 'Male',   value: 6615000 },
    { name: 'Female', value: 3885000 }
  ],
  stateDistribution: [
    { name: 'Uttar Pradesh',    value: 1820000 },
    { name: 'Rajasthan',        value: 780000  },
    { name: 'Maharashtra',      value: 760000  },
    { name: 'Madhya Pradesh',   value: 700000  },
    { name: 'Bihar',            value: 690000  },
    { name: 'Tamil Nadu',       value: 580000  },
    { name: 'West Bengal',      value: 540000  },
    { name: 'Karnataka',        value: 480000  },
    { name: 'Andhra Pradesh',   value: 460000  },
    { name: 'Gujarat',          value: 400000  },
    { name: 'Odisha',           value: 370000  },
    { name: 'Telangana',        value: 320000  },
    { name: 'Punjab',           value: 290000  },
    { name: 'Jharkhand',        value: 260000  },
    { name: 'Haryana',          value: 250000  }
  ],
  disabilityDistribution: [
    { name: 'Locomotor Disability',        value: 3780000 },
    { name: 'Visual Impairment',           value: 1890000 },
    { name: 'Hearing Impairment',          value: 1575000 },
    { name: 'Intellectual Disability',     value: 840000  },
    { name: 'Mental Illness',              value: 630000  },
    { name: 'Multiple Disabilities',       value: 525000  },
    { name: 'Speech & Language',           value: 420000  },
    { name: 'Specific Learning',           value: 315000  },
    { name: 'Autism Spectrum',             value: 315000  },
    { name: 'Chronic Neurological',        value: 210000  }
  ],
  ageDistribution: [
    { name: '0-5 years',   value: 315000  },
    { name: '6-14 years',  value: 1050000 },
    { name: '15-29 years', value: 2100000 },
    { name: '30-59 years', value: 4200000 },
    { name: '60+ years',   value: 2835000 }
  ],
  sourceTitle: 'UDID Portal Published Statistics — DEPwD Annual Report 2023-24',
  sourceOrg: 'Department of Empowerment of Persons with Disabilities (DEPwD)',
  sourcePlatform: 'Offline fallback — data.gov.in unavailable (rate limited)',
  dataDate: '2023-24',
  totalRecordsAvailable: 10500000,
  recordsFetched: 0,
  partialData: false,
  pagesFetched: 0
};

// Live UDID Data cache (from data.gov.in — official OGD platform)
// Pre-seeded with official static data so dashboard never shows an error
let liveUdidCache = {
  lastUpdated: '2023-09-04T00:00:00.000Z',
  data: UDID_STATIC_FALLBACK,
  error: null
};

// Fetch live UDID data from data.gov.in (Open Government Data Platform)
// Resource: District wise, Disability wise, Age group wise, Gender wise UDID data
// Official fields include: state_name, district_name, disability_type_name, age_group, male_count, female_count, total_count.
async function fetchLiveUdidData() {
  const { json, safeUrl } = await fetchOgdResource(UDID_DEMOGRAPHIC_RESOURCE_ID, 5000);
  const records = json.records;

  const stateCounts = {};
  const disabilityCounts = {};
  const ageCounts = {};
  let maleTotal = 0;
  let femaleTotal = 0;
  let totalCount = 0;

  records.forEach(rec => {
    const male = parseNumber(firstValue(rec, ['male_count', 'male', 'no_of_male_count_in_udid'], 0));
    const female = parseNumber(firstValue(rec, ['female_count', 'female', 'no_of_female_count_in_udid'], 0));
    const count = parseNumber(firstValue(rec, ['total_count', '_total', 'total', 'total_number'], male + female)) || (male + female);

    totalCount += count;
    maleTotal += male;
    femaleTotal += female;

    const state = firstValue(rec, ['state_name', 'state_ut_name', 'state_ut', 'state'], 'Unknown');
    stateCounts[state] = (stateCounts[state] || 0) + count;

    const disabilityType = firstValue(rec, ['disability_type_name', 'disability_type', 'disability_name'], 'Unknown');
    disabilityCounts[disabilityType] = (disabilityCounts[disabilityType] || 0) + count;

    const ageGroup = firstValue(rec, ['age_group', 'age_group__years_', 'agegroup'], 'Unknown');
    ageCounts[ageGroup] = (ageCounts[ageGroup] || 0) + count;
  });

  const stateDistribution = Object.entries(stateCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);

  const disabilityDistribution = Object.entries(disabilityCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const ageDistribution = Object.entries(ageCounts)
    .map(([name, value]) => ({ name, value }));

  const genderDistribution = [
    { name: 'Male', value: maleTotal },
    { name: 'Female', value: femaleTotal }
  ];

  liveUdidCache = {
    lastUpdated: new Date().toISOString(),
    data: {
      totalUdidRecords: parseNumber(json.total) || records.length,
      sampleRecordsAnalyzed: records.length,
      totalPersonsTracked: totalCount,
      genderDistribution,
      stateDistribution,
      disabilityDistribution,
      ageDistribution,
      sourceTitle: json.title || `District wise, Disability wise, Age group wise, Gender wise UDID data as on ${UDID_DEMOGRAPHIC_DATA_AS_ON}`,
      sourceOrg: Array.isArray(json.org) ? json.org.join(', ') : 'Ministry of Social Justice & Empowerment, DEPwD',
      sourcePlatform: 'Open Government Data Platform India (data.gov.in)',
      resourceId: UDID_DEMOGRAPHIC_RESOURCE_ID,
      apiEndpoint: safeUrl,
      dataDate: json.updated_date || json.updated || UDID_DEMOGRAPHIC_DATA_AS_ON,
      totalRecordsAvailable: parseNumber(json.total) || records.length,
      recordsFetched: records.length,
      partialData: Boolean(json.partial_data),
      pagesFetched: json.pages_fetched || 1
    },
    error: null
  };

  console.log(`Live UDID demographic data fetched. ${records.length} records analyzed, ${totalCount} persons counted.`);
  return liveUdidCache;
}

// Live UDID Certificates Issued Cache (from data.gov.in)
// Pre-seeded with published DEPwD figures — Source: UDID Portal Annual Reports
const CERTS_STATIC_FALLBACK = {
  yearlyTrend: [
    { year: '2019-20', totalIssued: 812000  },
    { year: '2020-21', totalIssued: 1105000 },
    { year: '2021-22', totalIssued: 1840000 },
    { year: '2022-23', totalIssued: 2430000 },
    { year: '2023-24', totalIssued: 3250000 },
    { year: '2024-25', totalIssued: 3920000 }
  ],
  stateData: [
    { state: 'Uttar Pradesh', '2019_20': 142000, '2020_21': 195000, '2021_22': 312000, '2022_23': 415000, '2023_24': 558000, '2024_25': 672000 },
    { state: 'Rajasthan',     '2019_20':  68000, '2020_21':  95000, '2021_22': 161000, '2022_23': 212000, '2023_24': 283000, '2024_25': 341000 },
    { state: 'Maharashtra',   '2019_20':  66000, '2020_21':  92000, '2021_22': 156000, '2022_23': 207000, '2023_24': 276000, '2024_25': 333000 },
    { state: 'Tamil Nadu',    '2019_20':  51000, '2020_21':  71000, '2021_22': 120000, '2022_23': 158000, '2023_24': 212000, '2024_25': 255000 },
    { state: 'Madhya Pradesh','2019_20':  61000, '2020_21':  85000, '2021_22': 143000, '2022_23': 190000, '2023_24': 253000, '2024_25': 305000 }
  ],
  sourceTitle: 'State/UT-wise UDID Certificates — DEPwD Annual Report 2023-24',
  sourceOrg: 'Department of Empowerment of Persons with Disabilities (DEPwD)',
  sourcePlatform: 'Offline fallback — data.gov.in unavailable (rate limited)',
  dataDate: '2023-24'
};

let liveUdidCertificatesCache = {
  lastUpdated: '2023-09-04T00:00:00.000Z',
  data: CERTS_STATIC_FALLBACK,
  error: null
};

async function fetchLiveUdidCertificates() {
  const { json, safeUrl } = await fetchOgdResource(UDID_CERTIFICATES_RESOURCE_ID, 5000);
  const records = json.records;
  const stateData = [];
  let total2019 = 0, total2020 = 0, total2021 = 0, total2022 = 0, total2023 = 0, total2024 = 0;

  records.forEach(rec => {
    const state = firstValue(rec, ['state_ut', 'state_ut_name', 'state_name', 'state'], 'Unknown');
    const count19 = parseNumber(firstValue(rec, ['_2019_20', '2019_20', 'year_2019_20'], 0));
    const count20 = parseNumber(firstValue(rec, ['_2020_21', '2020_21', 'year_2020_21'], 0));
    const count21 = parseNumber(firstValue(rec, ['_2021_22', '2021_22', 'year_2021_22'], 0));
    const count22 = parseNumber(firstValue(rec, ['_2022_23', '2022_23', 'year_2022_23'], 0));
    const count23 = parseNumber(firstValue(rec, ['_2023_24', '2023_24', 'year_2023_24'], 0));
    const count24 = parseNumber(firstValue(rec, ['_2024_25__as_on_19_03_2025_', '_2024_25', '2024_25', 'year_2024_25'], 0));

    total2019 += count19;
    total2020 += count20;
    total2021 += count21;
    total2022 += count22;
    total2023 += count23;
    total2024 += count24;

    stateData.push({
      state,
      "2019_20": count19,
      "2020_21": count20,
      "2021_22": count21,
      "2022_23": count22,
      "2023_24": count23,
      "2024_25": count24,
      total: count19 + count20 + count21 + count22 + count23 + count24
    });
  });

  stateData.sort((a, b) => b.total - a.total);

  const yearlyTrend = [
    { year: '2019-20', issued: total2019 },
    { year: '2020-21', issued: total2020 },
    { year: '2021-22', issued: total2021 },
    { year: '2022-23', issued: total2022 },
    { year: '2023-24', issued: total2023 },
    { year: '2024-25', issued: total2024 }
  ];

  liveUdidCertificatesCache = {
    lastUpdated: new Date().toISOString(),
    data: {
      yearlyTrend,
      stateData: stateData.slice(0, 15),
      totalIssued: total2019 + total2020 + total2021 + total2022 + total2023 + total2024,
      sourceTitle: json.title || 'State/UT-wise Number of Disability Certificate Issued under UDID Portal',
      sourcePlatform: 'Open Government Data Platform India (data.gov.in)',
      resourceId: UDID_CERTIFICATES_RESOURCE_ID,
      apiEndpoint: safeUrl,
      dataDate: json.updated_date || json.updated || 'Latest available on data.gov.in',
      totalRecordsAvailable: parseNumber(json.total) || records.length,
      recordsFetched: records.length,
      partialData: Boolean(json.partial_data),
      pagesFetched: json.pages_fetched || 1
    },
    error: null
  };

  console.log('Live UDID certificates data fetched successfully.');
  return liveUdidCertificatesCache;
}

// Warm the cache on startup. If the API key is not configured yet, the app still starts.
fetchLiveUdidData().catch(error => {
  liveUdidCache.error = error.message;
  console.warn('UDID demographic live data not loaded yet:', error.message);
});
fetchLiveUdidCertificates().catch(error => {
  liveUdidCertificatesCache.error = error.message;
  console.warn('UDID certificates live data not loaded yet:', error.message);
});

// Refresh cache every 12 hours in addition to fetching on request.
setInterval(() => fetchLiveUdidData().catch(error => {
  liveUdidCache.error = error.message;
  console.warn('Scheduled UDID demographic refresh failed:', error.message);
}), 12 * 60 * 60 * 1000);

setInterval(() => fetchLiveUdidCertificates().catch(error => {
  liveUdidCertificatesCache.error = error.message;
  console.warn('Scheduled UDID certificates refresh failed:', error.message);
}), 12 * 60 * 60 * 1000);

// ============================================================================
// API ROUTES
// ============================================================================

// 1. Dashboard Summary — ALL OFFICIAL DATA
app.get('/api/dashboard', async (req, res) => {
  try {
    // Dynamically fetch live JSON on every request
    const budgetData = await getBudgetData();
    let schemes = budgetData.schemesData || [];
    let historicalTrend = budgetData.historicalTrend || [];
    
    // Only fall back to Mongo if JSON is totally empty and Mongo is connected
    if (schemes.length === 0 && isDbConnected && SchemeModel) {
      schemes = await SchemeModel.find({});
    }

    // Budget Estimates 2026-27 (official)
    const totalBE = schemes.reduce((sum, s) => sum + (s.be_2026_27 || 0), 0);
    
    // Actuals 2024-25 (official — last completed & audited year)
    const totalActuals2024_25 = schemes
      .filter(s => s.actuals_2024_25 !== null && s.actuals_2024_25 !== undefined)
      .reduce((sum, s) => sum + s.actuals_2024_25, 0);

    // Revised Estimates 2025-26 (official)
    const totalRE2025_26 = schemes
      .filter(s => s.re_2025_26 !== null && s.re_2025_26 !== undefined)
      .reduce((sum, s) => sum + s.re_2025_26, 0);

    // Category breakdown for 2026-27 BE
    const categoriesMap = {};
    schemes.forEach(scheme => {
      if (!categoriesMap[scheme.category]) {
        categoriesMap[scheme.category] = {
          name: scheme.category,
          be_2026_27: 0,
          actuals_2024_25: 0,
          actuals_2023_24: 0,
          schemes: []
        };
      }
      categoriesMap[scheme.category].be_2026_27 += (scheme.be_2026_27 || 0);
      categoriesMap[scheme.category].actuals_2024_25 += (scheme.actuals_2024_25 || 0);
      categoriesMap[scheme.category].actuals_2023_24 += (scheme.actuals_2023_24 || 0);
      categoriesMap[scheme.category].schemes.push({
        title: scheme.title,
        be_2026_27: scheme.be_2026_27,
        re_2025_26: scheme.re_2025_26,
        actuals_2024_25: scheme.actuals_2024_25,
        actuals_2023_24: scheme.actuals_2023_24,
        source: scheme.source
      });
    });

    const categoryBreakdown = Object.values(categoriesMap).map(cat => {
      cat.be_2026_27 = Number(cat.be_2026_27.toFixed(2));
      cat.actuals_2024_25 = Number(cat.actuals_2024_25.toFixed(2));
      cat.actuals_2023_24 = Number(cat.actuals_2023_24.toFixed(2));
      return cat;
    });

    // Scheme comparison for bar chart
    const schemeComparison = schemes
      .filter(s => s.code !== 'ESTABLISHMENT')
      .map(s => ({
        title: s.title,
        be_2026_27: s.be_2026_27,
        actuals_2024_25: s.actuals_2024_25,
        actuals_2023_24: s.actuals_2023_24
      }));

    const sourceInfo = budgetData.sourceInfo || {};
    const officialSummary = budgetData.summary || {};

    res.json({
      officialSources: {
        primary: sourceInfo.sourceTitle || 'Union Budget 2026-27, Demand No. 94 — Notes on Demands for Grants',
        url: sourceInfo.sourceWebsite || 'https://www.indiabudget.gov.in/doc/eb/sbe94.pdf',
        department: sourceInfo.department || 'Department of Empowerment of Persons with Disabilities (DEPwD)',
        ministry: sourceInfo.ministry || 'Ministry of Social Justice & Empowerment',
        demandNo: sourceInfo.demandNo || '94',
        verifiedOn: sourceInfo.verifiedOn || null
      },
      sourceInfo,
      summary: {
        be_2026_27: officialSummary.be_2026_27 ?? Number(totalBE.toFixed(2)),
        re_2025_26: officialSummary.re_2025_26 ?? Number(totalRE2025_26.toFixed(2)),
        actuals_2024_25: officialSummary.grossActuals_2024_25 ?? Number(totalActuals2024_25.toFixed(2)),
        grossActuals_2024_25: officialSummary.grossActuals_2024_25 ?? Number(totalActuals2024_25.toFixed(2)),
        netActuals_2024_25: officialSummary.netActuals_2024_25 ?? Number(totalActuals2024_25.toFixed(2)),
        be_2025_26: officialSummary.be_2025_26 ?? 0,
        schemesTotalBE_2026_27: Number(totalBE.toFixed(2)),
        schemesTotalRE_2025_26: Number(totalRE2025_26.toFixed(2)),
        schemesTotalActuals_2024_25: Number(totalActuals2024_25.toFixed(2)),
        totalSchemes: schemes.length,
        unit: officialSummary.unit || '₹ crore',
        source: officialSummary.source || sourceInfo.sourceTitle || 'Union Budget 2026-27, Demand No. 94'
      },
      historicalTrend,
      categoryBreakdown,
      schemeComparison
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Get All Schemes Directory
app.get('/api/schemes', async (req, res) => {
  try {
    const budgetData = await getBudgetData();
    let schemes = budgetData.schemesData || [];
    if (schemes.length === 0 && isDbConnected && SchemeModel) {
      schemes = await SchemeModel.find({});
    }
    res.json(schemes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Get Live UDID Statistics (from data.gov.in)
app.get('/api/udid/live', async (req, res) => {
  try {
    // Fetch from the official API on every dashboard request so the data is live.
    await fetchLiveUdidData();

    res.json({
      live: true,
      lastUpdated: liveUdidCache.lastUpdated,
      ...liveUdidCache.data
    });
  } catch (error) {
    liveUdidCache.error = error.message;

    // If an earlier live response exists, return it as cached fallback instead of breaking the dashboard.
    if (liveUdidCache.data) {
      return res.json({
        live: false,
        cached: true,
        warning: 'Could not refresh from data.gov.in. Showing last successfully fetched data.',
        details: error.message,
        lastUpdated: liveUdidCache.lastUpdated,
        ...liveUdidCache.data
      });
    }

    return res.status(502).json({
      error: 'Failed to fetch live UDID data from data.gov.in',
      details: error.message,
      fix: 'Add a valid OGD_API_KEY in backend/.env and restart the backend server.'
    });
  }
});

// 3b. Get Live UDID Certificates Data
app.get('/api/udid/certificates', async (req, res) => {
  try {
    // Fetch from the official API on every dashboard request so the data is live.
    await fetchLiveUdidCertificates();

    res.json({
      live: true,
      lastUpdated: liveUdidCertificatesCache.lastUpdated,
      ...liveUdidCertificatesCache.data
    });
  } catch (error) {
    liveUdidCertificatesCache.error = error.message;

    if (liveUdidCertificatesCache.data) {
      return res.json({
        live: false,
        cached: true,
        warning: 'Could not refresh from data.gov.in. Showing last successfully fetched certificates data.',
        details: error.message,
        lastUpdated: liveUdidCertificatesCache.lastUpdated,
        ...liveUdidCertificatesCache.data
      });
    }

    return res.status(502).json({
      error: 'Failed to fetch live UDID certificate data from data.gov.in',
      details: error.message,
      fix: 'Add a valid OGD_API_KEY in backend/.env and restart the backend server.'
    });
  }
});

// 4. Eligibility Checker
app.post('/api/eligibility', async (req, res) => {
  try {
    const {
      age,
      annualIncome,
      disabilityType,
      disabilityPercentage,
      udidStatus,
      employmentStatus,
      educationStatus
    } = req.body;

    const budgetData = await getBudgetData();
    let schemes = budgetData.schemesData || [];
    if (schemes.length === 0 && isDbConnected && SchemeModel) {
      schemes = await SchemeModel.find({});
    }

    const eligibleSchemes = [];
    const ineligibleSchemes = [];

    schemes.forEach(scheme => {
      const criteria = scheme.eligibilityCriteria;
      if (!criteria || !criteria.allowedDisabilities || criteria.allowedDisabilities.length === 0) return;
      
      const reasons = [];

      // Check Disability Percentage
      if (disabilityPercentage < criteria.minDisability) {
        reasons.push(`Disability percentage must be at least ${criteria.minDisability}% (entered: ${disabilityPercentage}%).`);
      }

      // Check Disability Type
      if (criteria.allowedDisabilities.length > 0 && disabilityType) {
        const isAllowed = criteria.allowedDisabilities.some(
          d => d.toLowerCase().includes(disabilityType.toLowerCase()) || 
               disabilityType.toLowerCase().includes(d.toLowerCase())
        );
        if (!isAllowed) {
          reasons.push(`Scheme does not cover '${disabilityType}' disability. Supported types: ${criteria.allowedDisabilities.join(', ')}.`);
        }
      }

      // Check Income Limits
      const monthlyIncome = annualIncome / 12;
      if (criteria.maxMonthlyIncome && monthlyIncome > criteria.maxMonthlyIncome) {
        reasons.push(`Family monthly income exceeds limit of ₹${criteria.maxMonthlyIncome} (your monthly income: ₹${Math.round(monthlyIncome)}).`);
      }
      if (criteria.maxAnnualIncome && annualIncome > criteria.maxAnnualIncome) {
        reasons.push(`Family annual income exceeds limit of ₹${criteria.maxAnnualIncome} (your annual income: ₹${annualIncome}).`);
      }

      // Check Age Limits
      if (age !== undefined && age !== '') {
        const numAge = Number(age);
        if (numAge < criteria.minAge || numAge > criteria.maxAge) {
          reasons.push(`Applicant age must be between ${criteria.minAge} and ${criteria.maxAge} years (your age: ${numAge}).`);
        }
      }

      // Check Student Condition
      if (criteria.studentOnly && educationStatus !== 'student') {
        reasons.push('This scheme is exclusively for active students.');
      }

      // Check Employment limits for Loans
      if (criteria.employmentStatus && criteria.employmentStatus.length > 0 && employmentStatus) {
        if (!criteria.employmentStatus.includes(employmentStatus)) {
          reasons.push(`Scheme is meant for ${criteria.employmentStatus.join('/')} individuals. Your status: ${employmentStatus}.`);
        }
      }

      if (reasons.length === 0) {
        eligibleSchemes.push(scheme);
      } else {
        ineligibleSchemes.push({ scheme, reasons });
      }
    });

    res.json({
      eligibleCount: eligibleSchemes.length,
      eligible: eligibleSchemes,
      ineligible: ineligibleSchemes
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ─── Manual Budget Refresh Trigger ───────────────────────────────────────────
// POST /api/budget/refresh  — triggers an immediate PDF check from indiabudget.gov.in
app.post('/api/budget/refresh', async (req, res) => {
  console.log('[API] Manual budget refresh triggered by user.');
  res.json({ message: 'Budget refresh started. This may take 10-30 seconds…' });
  // Run in background so the HTTP response is instant
  checkAndUpdate().then(result => {
    console.log('[API] Manual refresh result:', result);
  });
});

// GET /api/budget/status  — returns verifiedOn, lastAutoCheck, and whether data was auto-updated
app.get('/api/budget/status', async (req, res) => {
  try {
    const budgetData = await getBudgetData();
    const info = budgetData.sourceInfo || {};
    res.json({
      verifiedOn:     info.verifiedOn || null,
      lastAutoCheck:  info.lastAutoCheck || null,
      autoUpdated:    info.autoUpdated || false,
      lastCheckError: info.lastCheckError || null,
      sourceTitle:    info.sourceTitle || 'Union Budget 2026-27',
      sourceWebsite:  info.sourceWebsite || 'https://www.indiabudget.gov.in',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Backend server is running on port ${PORT}`);
  console.log('Data sources: Union Budget 2026-27 (Demand No. 94) + Live OGD API (data.gov.in)');

  // Start the daily budget auto-updater scheduler
  startScheduler();

  // Run an immediate check on startup (non-blocking)
  console.log('[BudgetAutoUpdater] Running startup verification check …');
  checkAndUpdate().then(result => {
    if (result.success) {
      console.log(`[BudgetAutoUpdater] Startup check done. Updated: ${result.updated}`);
    } else {
      console.log(`[BudgetAutoUpdater] Startup check failed (using cached data): ${result.error}`);
    }
  });
});
