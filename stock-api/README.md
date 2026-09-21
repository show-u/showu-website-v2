# ShowU Stock API

No database. Every request fetches official TWSE/TPEx data online, calculates price structure, and returns JSON.

## Run

```bash
npm start
```

## Endpoints

- `GET /health`
- `GET /api/analyze?stock=2330`
- `GET /api/analyze?stock=台積電`
- `GET /api/analyze?stock=6488`

Supports TWSE listed and TPEx mainboard stocks.
