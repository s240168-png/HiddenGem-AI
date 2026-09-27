# HiddenGemsAI — Web Deployment Guide

This project is now structured as a two-service deployment:

- **web**: Node.js/Express application, public HTTP entry point on port 3000.
- **python-service**: Flask/Gunicorn recommendation engine, private/internal on port 5000.
- **MongoDB**: use MongoDB Atlas or another managed MongoDB deployment. Do not expose a database container publicly.

## 1. Before deployment

Create a production environment file from `.env.example` and provide real values:

```env
NODE_ENV=production
PORT=3000
APP_BASE_URL=https://YOUR_PUBLIC_DOMAIN
CORS_ORIGIN=https://YOUR_PUBLIC_DOMAIN

MONGODB_URI=mongodb+srv://...
JWT_SECRET=use-a-random-secret-at-least-32-characters-long

EMAIL_FROM=HiddenGemsAI <noreply@YOUR_DOMAIN>
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_SECURE=false
```

Do not commit `.env`, real user seed files, or SMTP/JWT credentials.

## 2. Docker Compose deployment

On a Linux server with Docker Compose:

```bash
git clone YOUR_REPOSITORY
cd HiddenGem-AI
cp .env.example .env
# edit .env with production values
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f web
docker compose logs -f python-service
```

The public service is the `web` container. The Python container is intentionally not published with a `ports:` mapping, so it is reachable only from the Docker network.

## 3. MongoDB

Use MongoDB Atlas (or another managed MongoDB service). Add the deployment server's outbound IP/network to the database access policy and use a dedicated application database user.

Do not use the local JSON files as a production source of truth. MongoDB is the runtime source of truth.

## 4. Email verification

Production registration requires working SMTP configuration. If SMTP is missing or fails in production, registration fails with a controlled error instead of silently claiming that an email was sent.

Test the full flow after deployment:

1. Register a new traveler.
2. Confirm the email arrives.
3. Open the verification link.
4. Confirm login works.
5. Confirm an unverified account cannot log in.

## 5. Health checks

Node:

```text
GET /api/health
```

Python:

```text
GET /health
```

A Python `/health` response of HTTP 500 means the service is running but the SentenceTransformer model is not loaded. Install dependencies and allow the model weights to be downloaded in the deployment environment.

## 6. Recommendation model

The Python service loads:

```text
all-MiniLM-L6-v2
```

The first production boot may take longer because model files may need to be downloaded and cached. Keep the Python service on one Gunicorn worker per instance because every worker loads its own model copy.

Scale horizontally with multiple single-worker Python instances if needed.

## 7. Security model

- Browser users never call the Python service directly.
- Recommendation, itinerary generation, and weather endpoints require traveler authentication.
- Login, registration, verification resend, recommendation generation, and weather simulation have rate limits.
- Node JSON bodies are capped by `MAX_CONTENT_LENGTH`.
- Python requests are also capped.
- Merchant experience CRUD is protected by merchant role and ownership checks.
- Public merchant experience browsing only returns verified experiences.
- Security headers are added by Express.
- Cookies are HTTP-only; production cookies are marked secure.

## 8. First production smoke test

After deployment:

```bash
curl https://YOUR_PUBLIC_DOMAIN/api/health
```

Then manually verify:

- traveler registration + email verification
- traveler login
- recommendations
- weather simulation
- itinerary generation
- booking creation
- My Bookings + cancellation
- merchant login
- merchant experience create/edit/delete
- merchant booking list + cancellation
- merchant offers
- traveler merchant "View Experiences"
- flash offers

For the ML path, also verify that generating a route succeeds with the live model rather than falling back because the Python service is unavailable.
