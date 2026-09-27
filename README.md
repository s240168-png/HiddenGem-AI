# HiddenGemsAI

Run `npm install` and `npm start`, then open `http://localhost:3000/landing.html` (or `/login.html`).

The Express API is available under `/api`, including `/api/auth`, `/api/experiences`, `/api/itineraries`, `/api/offers`, `/api/bookings`, `/api/merchant`, and `/api/weather`.

Merchant ownership is stored explicitly in `server/data/merchant-experiences.json` as
`{ "experienceId": <catalog id>, "merchantId": <user id> }`. Add a link only after
the merchant has been confirmed as the owner; unlinked catalog entries remain unowned.
Authenticated merchants can retrieve their verified listings from `GET /api/merchant/experiences`.

## Email Verification & Setup

HiddenGemsAI includes a production-ready email verification architecture with SHA-256 token hashing, 24-hour token expiration, single-use token invalidation, and 60-second rate-limited resend protection.

### Environment Configuration

Configure email delivery by setting the following environment variables in your `.env` file:

```env
# Application Base URL (used to generate email verification links)
APP_BASE_URL=http://localhost:3000

# Sender Address
EMAIL_FROM=HiddenGemsAI <noreply@hiddengemsai.com>

# Production SMTP Provider Credentials
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_SECURE=false
```

### Provider Behavior:
- **Production Mode (`NODE_ENV=production`)**: Sends verification emails via SMTP using configured credentials. Verification tokens and URLs are strictly omitted from API HTTP responses and application logs.
- **Development Mode (`NODE_ENV=development`)**: If SMTP credentials are not configured, the email service logs formatted verification links to the local developer console for testing convenience.

## Semantic Recommendations

Install the Python model dependency once with `py -3 -m pip install -r python-service/requirements.txt`.
The recommendation endpoints use `SentenceTransformer('all-MiniLM-L6-v2')` to return a `vibe_score` cosine similarity for verified, weather-safe, group-safe, and budget-safe experiences. They accept both the legacy preference payload and the canonical fields: `time_available_hours`, `group_size`, `budget_limit`, `weather_condition`, `user_vibes`, and `start_time`.


## Merchant Experience Management

Authenticated merchants can now create, edit, and delete their own experience listings from the merchant dashboard. The API is protected by the merchant role and ownership checks:

- `POST /api/merchant/experiences`
- `PATCH /api/merchant/experiences/:id`
- `DELETE /api/merchant/experiences/:id`

Travelers can open a merchant's public profile card and view that merchant's verified experiences through:

- `GET /api/merchants/:merchantId/experiences`

## Deployment

The repository includes a production-oriented Docker deployment:

- `Dockerfile` for the Node/Express web service
- `python-service/Dockerfile` for the Gunicorn recommendation service
- `docker-compose.yml` for a private Node → Python network
- `DEPLOYMENT.md` with the production setup checklist

The Python service should remain private/internal. The browser talks only to the Node application.
