/**
 * ============================================================================
 * BUDGET AUTO-UPDATER MODULE
 * ============================================================================
 * Automatically checks indiabudget.gov.in every day at midnight (IST) for a
 * new Demand No. 94 PDF. If a new budget year is detected, it:
 *   1. Downloads the PDF from the official source
 *   2. Parses and extracts scheme-wise financial figures using text analysis
 *   3. Updates budget_2026.json with the fresh numbers
 *   4. Updates the verifiedOn timestamp so the dashboard badge is current
 *
 * Source: https://www.indiabudget.gov.in/doc/eb/sbe94.pdf
 * ============================================================================
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const cron = require('node-cron');
const axios = require('axios');
const { PDFParse } = require('pdf-parse');

const BUDGET_JSON_PATH = path.join(__dirname, 'data', 'budget_2026.json');
const DEMAND_94_PDF_URL = 'https://www.indiabudget.gov.in/doc/eb/sbe94.pdf';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`[BudgetAutoUpdater] ${new Date().toISOString()}  ${msg}`);
}

function readCurrentBudget() {
  try {
    return JSON.parse(fs.readFileSync(BUDGET_JSON_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function writeBudget(data) {
  fs.writeFileSync(BUDGET_JSON_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// ─── PDF Download ─────────────────────────────────────────────────────────────

async function downloadPdf(url) {
  log(`Downloading PDF → ${url}`);
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (DEPwD Dashboard Budget Checker/1.0)',
      'Accept': 'application/pdf,*/*',
    },
  });
  if (response.status !== 200) {
    throw new Error(`HTTP ${response.status} from indiabudget.gov.in`);
  }
  log(`PDF downloaded — ${(response.data.byteLength / 1024).toFixed(0)} KB`);
  return Buffer.from(response.data);
}

// ─── PDF Text Extractor ──────────────────────────────────────────────────────
// PDFParse (this version) needs a file:// URL so we write a temp file first.

async function extractTextFromPdf(pdfBuffer) {
  const tmpPath = path.join(os.tmpdir(), `budget_d94_${Date.now()}.pdf`);
  fs.writeFileSync(tmpPath, pdfBuffer);
  let fullText = '';
  try {
    const parser = new PDFParse({ verbosity: 0, url: `file://${tmpPath}` });
    const doc = await parser.load();
    for (let i = 1; i <= doc.numPages; i++) {
      const page    = await doc.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(item => item.str).join(' ') + '\n';
    }
    parser.destroy();
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {}
  }
  return fullText;
}

// ─── Smart Number Parser ──────────────────────────────────────────────────────
// The Demand 94 PDF table has columns:
//   Actuals 2024-25 | BE 2025-26 | RE 2025-26 | BE 2026-27
// Each column = Revenue | Capital | Total (3 numbers, nil shown as "...")
// columnIndex 0 = Actuals Total, 1 = BE 2025-26 Total, 2 = RE Total, 3 = BE 2026-27 Total

function findValue(text, keyword, columnIndex = 3) {
  const idx = text.indexOf(keyword);
  if (idx === -1) return null;
  const snippet = text.substring(idx, idx + 700);
  const tokens  = snippet.match(/(\d{1,4}(?:,\d{3})*(?:\.\d{1,2})?)/g);
  if (!tokens) return null;
  const values = tokens
    .map(t => parseFloat(t.replace(/,/g, '')))
    .filter(v => v >= 0.01 && v <= 9999);

  // Every 3rd value (index 2, 5, 8 …) is a column "Total"
  const totals = [];
  for (let i = 2; i < values.length; i += 3) totals.push(values[i]);

  if (totals.length > columnIndex) return totals[columnIndex];
  if (values.length > columnIndex) return values[columnIndex];
  return null;
}

// ─── Financial Year Detector ──────────────────────────────────────────────────

function detectBudgetYear(text) {
  const m = text.match(/Demands for Grants,\s*(\d{4}-\d{2,4})/i)
    || text.match(/Budget Estimate[s]?\s*(\d{4}-\d{2,4})/i)
    || text.match(/(\d{4}-\d{2,4})\s*Budget Estimate[s]?/i);
  return m ? m[1] : null;
}

// ─── Core Parse & Patch ───────────────────────────────────────────────────────

async function parseAndPatch(pdfBuffer) {
  const text    = await extractTextFromPdf(pdfBuffer);
  const current = readCurrentBudget();
  if (!current) throw new Error('Cannot read existing budget_2026.json');

  const detectedYear = detectBudgetYear(text);
  log(`Detected budget year from PDF: ${detectedYear || 'unknown'}`);

  // Only fully update figures if a new budget year is found in the PDF
  const currentYear = current.sourceInfo.sourceTitle.match(/(\d{4}-\d{2,4})/)?.[1];
  const isNewBudget = detectedYear && detectedYear !== currentYear;

  if (!isNewBudget && currentYear) {
    log(`Same budget year (${currentYear}). Refreshing timestamp only.`);
    current.sourceInfo.verifiedOn    = new Date().toISOString().split('T')[0];
    current.sourceInfo.lastAutoCheck = new Date().toISOString();
    current.sourceInfo.autoUpdated   = false;
    delete current.sourceInfo.lastCheckError;
    writeBudget(current);
    return { updated: false, year: detectedYear };
  }

  // ── New budget year detected! Extract all columns ──
  log(`New budget year detected: ${detectedYear}. Extracting figures…`);

  // Keywords to find each scheme's row in the PDF text
  const schemeKeywords = {
    ADIP:    ['Assistance to Disabled Persons', 'ADIP'],
    DDRS:    ['Deendayal Disabled Rehabilitation', 'DDRS'],
    SIPDA:   ['Scheme for implementation of Persons with Disability Act', 'SIPDA'],
    SCHOLAR: ['Scholarships', 'National Fellowship'],
    KAUSHAL: ['Divyangjan Kaushal', 'Kaushal Yojana'],
    SAHARA:  ['Divyangjan Sahara', 'Sahara Yojana'],
    ALIMCO:  ['ALIMCO', 'Artificial Limbs'],
  };

  let updated = false;

  current.schemesData.forEach(scheme => {
    const keywords = schemeKeywords[scheme.code];
    if (!keywords) return;

    let extractedBE = null, extractedActuals = null, extractedRE = null;
    for (const kw of keywords) {
      if (!extractedBE)      extractedBE      = findValue(text, kw, 3);
      if (!extractedActuals) extractedActuals = findValue(text, kw, 0);
      if (!extractedRE)      extractedRE      = findValue(text, kw, 2);
      if (extractedBE) break;
    }

    if (extractedBE) {
      log(`  ${scheme.code}: BE=${extractedBE} | Actuals=${extractedActuals} | RE=${extractedRE}`);
      scheme.actuals_2023_24 = scheme.actuals_2024_25;
      scheme.actuals_2024_25 = extractedActuals ?? scheme.actuals_2024_25;
      scheme.re_2025_26      = extractedRE      ?? scheme.re_2025_26;
      scheme.be_2026_27      = extractedBE;
      updated = true;
    }
  });

  // Update summary total BE
  const totalBE = findValue(text, 'Grand Total', 3) || findValue(text, 'Net', 3);
  if (totalBE) {
    log(`  Summary Total BE: ${totalBE}`);
    current.summary.be_2025_26 = current.summary.be_2026_27;
    current.summary.be_2026_27 = totalBE;
    updated = true;
  }

  // Update source title and historical trend
  if (detectedYear) {
    current.sourceInfo.sourceTitle = `Union Budget ${detectedYear}, Notes on Demands for Grants`;
    // Add new year to historical trend
    const alreadyAdded = current.historicalTrend.some(t => t.year === detectedYear);
    if (!alreadyAdded && totalBE) {
      current.historicalTrend.push({ year: detectedYear, value: totalBE, type: 'BE', source: `Union Budget ${detectedYear} (Budget Estimates)` });
    }
  }

  current.sourceInfo.verifiedOn    = new Date().toISOString().split('T')[0];
  current.sourceInfo.lastAutoCheck = new Date().toISOString();
  current.sourceInfo.autoUpdated   = updated;
  delete current.sourceInfo.lastCheckError;

  writeBudget(current);
  log(updated ? '✅ budget_2026.json updated with fresh figures from PDF.' : '✅ No figure changes detected.');
  return { updated, year: detectedYear };
}

// ─── Manual Trigger ───────────────────────────────────────────────────────────

async function checkAndUpdate() {
  try {
    log('Starting budget verification check …');
    const pdfBuffer = await downloadPdf(DEMAND_94_PDF_URL);
    return { success: true, ...(await parseAndPatch(pdfBuffer)) };
  } catch (err) {
    log(`❌ Error: ${err.message}`);
    try {
      const current = readCurrentBudget();
      if (current) {
        current.sourceInfo.lastAutoCheck  = new Date().toISOString();
        current.sourceInfo.lastCheckError = err.message;
        writeBudget(current);
      }
    } catch {}
    return { success: false, error: err.message };
  }
}

// ─── Daily Scheduler ─────────────────────────────────────────────────────────

function startScheduler() {
  cron.schedule('1 0 * * *', async () => {
    log('⏰ Scheduled daily budget check triggered …');
    await checkAndUpdate();
  }, { timezone: 'Asia/Kolkata' });

  log('📅 Scheduler started — daily budget check at 00:01 IST');
}

module.exports = { startScheduler, checkAndUpdate };
