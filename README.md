# OmniSync WMS

OmniSync WMS is a warehouse management portal designed for motorcycle repair and parts inventory operations.

## Project Summary

- Role-based user authentication with MongoDB-backed staff accounts and `.env` superadmin fallback.
- Central portal UI that hides all navigation until login is complete.
- Inventory, cashier, employee shift, and admin management modules.
- Offline transaction storage sync and Loyverse inventory integration.

## Key Features

- Login portal with MongoDB-backed users and `.env` superadmin fallback
- Role-aware dashboard and admin controls for superadmins only
- Inventory, cashier, and employee shift management
- Upload/import inventory via CSV or XLSX
- Loyverse API sync and mobile transaction sync endpoints
- JWT-based authentication with secure password hashing

## Getting Started

### Install dependencies

```bash
npm install
```

### Create a local environment file

```bash
cp .env.example .env
```

Update `.env` with your MongoDB connection string and optional superadmin credentials.

### Loyverse OAuth callback

When registering your Loyverse app, use your deployment callback URL:

```text
https://omnisync.vercel.app/api/callback
```

### Run the development server

```bash
npm run dev
```

### Open the app

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Copy `.env.example` to `.env` and set:

- `MONGODB_URI` - MongoDB connection string
- `MONGODB_HOST` - MongoDB cluster host for public/private key auth (e.g. `cluster.example.mongodb.net`)
- `MONGODB_API_PUB_KEY` - MongoDB API public key
- `MONGODB_API_PRIV_KEY` - MongoDB API private key
- `MONGODB_APP_NAME` - optional MongoDB client app name
- `JWT_SECRET` - JWT signing secret
- `SUPERADMIN_EMAIL` - optional superadmin fallback email
- `SUPERADMIN_PASSWORD` - optional superadmin fallback password
- `SUPERADMIN_NAME` - optional superadmin display name
- `LOYVERSE_CLIENT_ID` - Loyverse OAuth client ID
- `LOYVERSE_CLIENT_SECRET` - Loyverse OAuth client secret
- `LOYVERSE_TOKEN_URL` - Loyverse OAuth token endpoint
- `LOYVERSE_API_BASE_URL` - Loyverse API base URL
- `LOYVERSE_REDIRECT_URI` - Loyverse OAuth redirect URI, such as `https://omnisync.vercel.app/api/callback`

## Notes

- Unauthenticated users see only a centered login card.
- The app validates database users first and falls back to `.env` superadmin credentials only if no database user exists.
- New superadmin employee accounts are always stored in MongoDB.

## License

This project is licensed under the Creative Commons Attribution 3.0 License. See LICENSE for details.
