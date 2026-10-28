# Live UDID Data Setup

This project is configured to fetch official UDID data from the Open Government Data Platform India (`data.gov.in`).

## UDID API used

The available Data API selected from your screenshot is:

```text
District wise, Disability wise, Age group wise, Gender wise Unique Disability ID (UDID) data as on 04.09.2023
```

Resource ID:

```text
78dab912-a409-46c1-a535-46d89920e905
```

This is official Indian government data from the Data API page. The newer 11.06.2024 item was visible as a dataset, but its Data API was not available in your case, so this project uses the available official API.

## API key already added for testing

`backend/.env` already contains the public sample API key displayed on the Data API page:

```env
OGD_API_KEY=579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b
```

This lets the project run and fetch official OGD data. However, the public sample key may return limited rows per request. The backend supports pagination using `offset`, but for best results you should log in to data.gov.in, generate your own API key, and replace the sample key.

## Backend routes used by the dashboard

```text
GET http://localhost:5001/api/udid/live
GET http://localhost:5001/api/udid/certificates
```

## Run backend

```bash
cd backend
npm install
npm start
```

## Run frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

## Important

- Budget/scheme financial data is official Union Budget data stored in `backend/data/budget_2026.json`.
- UDID demographic data is fetched from the official `api.data.gov.in` resource shown above.
- If the dashboard says partial data, replace the sample key with your generated data.gov.in API key.
