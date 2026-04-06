# GreenPulse — Tree Planting Verification App

Mobile application (Android-first) for verifying tree plantings and issuing CO₂ certificates.

## Architecture

```
┌─────────────────┐     HTTPS      ┌──────────────────────┐
│  React Native   │ ─────────────► │  FastAPI (Railway)   │
│  (Expo Router)  │                │  /api/v1/*           │
└────────┬────────┘                └──────┬───────────────┘
         │                                │
         │ Supabase Auth JWT              │ Supabase SDK
         ▼                                ▼
┌─────────────────┐                ┌──────────────────────┐
│  Supabase Auth  │                │  PostgreSQL (EU)      │
│  (Email/Google) │                │  + Supabase Storage  │
└─────────────────┘                └──────────────────────┘
                                           │
                                   ┌───────┴──────┐
                                   │  AWS         │
                                   │  Rekognition │
                                   │  (CV model)  │
                                   └──────────────┘
```

**Data flow (UC-1 — critical path):**
1. User opens camera → takes photo of seedling
2. Photo + GPS → `POST /api/v1/verify`
3. Backend: EXIF check → GPS dedup → CV inference → CO₂ calculation
4. If confidence < 70% → user picks species from top-5
5. RevenueCat payment ($1)
6. PDF certificate generated → Supabase Storage
7. Certificate in profile + email delivery

## Prerequisites

- Node.js 20+
- Python 3.12+
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- Docker (for local backend)
- Supabase account (EU region)
- Railway account
- AWS account (Rekognition)
- RevenueCat account

## Local Setup

### Backend

```bash
cd backend
cp .env.example .env
# Fill in .env values

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Mobile

```bash
cd mobile
npm install
npx expo start
# Press 'a' for Android emulator
```

## Supabase Setup

1. Create project in **EU region** (GDPR)
2. Run migrations in order:
   ```sql
   -- In Supabase SQL Editor, run each file:
   database/migrations/001_users.sql
   database/migrations/002_verifications.sql
   database/migrations/003_certificates.sql
   database/migrations/004_rls_policies.sql
   database/seed.sql
   ```
3. Create Storage buckets:
   - `verification-photos` (private)
   - `certificates` (public)
4. Enable Auth providers: Email, Google

## AWS Rekognition Setup

1. Create Custom Labels project in `eu-west-1`
2. Train model with plant species dataset
3. Copy Project ARN → `AWS_REKOGNITION_PROJECT_ARN` in `.env`
4. Create IAM user with `AmazonRekognitionFullAccess` → copy keys to `.env`

## Deploy Backend to Railway

```bash
# 1. Install Railway CLI
npm install -g @railway/cli
railway login

# 2. Link project
cd backend
railway link

# 3. Set environment variables
railway variables set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... # etc.

# 4. Deploy
railway up
```

Add `RAILWAY_TOKEN` to GitHub repo secrets for CI/CD auto-deploy.

## EAS Build + Google Play

```bash
cd mobile

# Configure EAS project
eas init

# Build preview APK (for testing)
eas build --platform android --profile preview

# Build production AAB
eas build --platform android --profile production

# Submit to Google Play Internal Testing
eas submit --platform android --latest
```

**Google Play requirements:**
- Minimum 10 internal testers
- Privacy Policy URL required
- Target API level: 34+
- ASO: Title "GreenPulse — Tree Planting Certificate"

## Environment Variables

See `.env.example` for all required variables.

**GitHub Secrets needed for CI/CD:**
| Secret | Used by |
|--------|---------|
| `RAILWAY_TOKEN` | deploy-backend.yml |
| `EXPO_TOKEN` | build-mobile.yml |

## Project Structure

```
greenpulse/
├── mobile/          # React Native + Expo
│   ├── app/         # Expo Router screens
│   ├── services/    # API, Auth, RevenueCat, Analytics
│   ├── store/       # Zustand state
│   └── components/  # Reusable UI
├── backend/         # FastAPI
│   ├── app/
│   │   ├── api/v1/  # Endpoints
│   │   ├── core/    # Config, DB, Security
│   │   ├── models/  # Pydantic schemas
│   │   └── services/ # Business logic
│   └── Dockerfile
├── database/        # SQL migrations (Supabase)
├── landing/         # Marketing website
├── docs/            # API reference
└── .github/         # CI/CD workflows
```

## MVP Checklist (before Google Play submission)

- [ ] Native camera only — no gallery button anywhere
- [ ] GPS required — blocks verification without it
- [ ] CV returns result in ≤ 5 sec
- [ ] confidence < 70% → shows top-5 species picker
- [ ] RevenueCat sandbox payment works ($1)
- [ ] PDF certificate with QR generated
- [ ] QR leads to public verification page
- [ ] EXIF antifrod working
- [ ] GPS dedup (10m / 24h) → POSSIBLE_DUPLICATE flag
- [ ] DUPLICATE_PHOTO hash → 403
- [ ] DELETE /api/v1/users/me → GDPR wipe
- [ ] GPS stored rounded to 4 decimals (~11m)
- [ ] Sentry errors received
- [ ] PostHog events in funnel
- [ ] UptimeRobot pinging /health
- [ ] GitHub Actions auto-deploys on push to main
- [ ] Privacy Policy URL in app.json + Google Play
- [ ] 10+ internal testers added
