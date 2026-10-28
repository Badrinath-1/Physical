# Real Official Data Changes

This version was updated so the budget dashboard uses official budget terms and source metadata.

## Changed files

- `backend/data/budget_2026.json`
  - Added `sourceInfo` and `summary` from Union Budget 2026-27, Demand No. 94.
  - Updated scheme-wise official values for BE 2026-27, RE 2025-26 and Actuals 2024-25.
  - Removed dummy-style interpretation of used/remaining data.

- `backend/server.js`
  - Dashboard summary now reads official totals from `budget_2026.json` instead of hardcoded values.
  - API response now includes `sourceInfo` and `officialSources`.
  - OGD API key is read from `.env` instead of being hardcoded.

- `frontend/src/components/Dashboard.jsx`
  - Hero budget amount and YoY increase now come from backend API data.
  - Added official source metadata display.
  - Renamed allocation labels to official budget terms.

- `frontend/src/components/Schemes.jsx`
  - Replaced dummy-style `allocated`, `utilized`, `gap`, and `utilPercent` fields.
  - Scheme cards now show BE 2026-27, RE 2025-26, and Actuals 2024-25.
  - Added official source display for every scheme card.

## Important

The dashboard no longer shows `Used Amount` or `Remaining Amount` because those require official same-year utilization/release data. The current official budget file supports BE, RE and Actuals.

For live UDID data, replace `OGD_API_KEY=your_data_gov_api_key_here` in `backend/.env` with a valid data.gov.in API key.

## Live UDID update

The UDID analytics section now refreshes from `api.data.gov.in` when the dashboard requests:

- `/api/udid/live`
- `/api/udid/certificates`

The backend uses official OGD resource IDs and reads `OGD_API_KEY` from `backend/.env`. See `LIVE_UDID_SETUP.md` for setup steps.

## UDID API Update

The project has been updated to use the available official Data API shown on data.gov.in:

- Dataset: District wise, Disability wise, Age group wise, Gender wise Unique Disability ID (UDID) data as on 04.09.2023
- Resource ID: `78dab912-a409-46c1-a535-46d89920e905`
- API key: the public sample key from the Data API page is placed in `backend/.env` for testing.

If full data is required, replace the sample key with a generated data.gov.in API key.
