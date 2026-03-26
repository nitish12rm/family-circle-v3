# Family Circle v3 — Setup Guide

## Prerequisites
- Node.js 20+ (install from https://nodejs.org)
- MongoDB Atlas account (free tier works)
- Cloudinary account (free tier works) — optional for media uploads

## 1. Install Dependencies

```bash
cd family-circle-v3
npm install
```

## 2. Configure Environment Variables

Copy `.env.local.example` to `.env.local` and fill in values:

```bash
cp .env.local.example .env.local
```

### MongoDB Atlas
1. Go to https://cloud.mongodb.com
2. Create a free cluster
3. Create a database user (username + password)
4. Whitelist your IP (or use 0.0.0.0/0 for any IP)
5. Get the connection string (Drivers → Node.js)
6. Paste it as `MONGODB_URI`

### JWT Secret
Generate a random string:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Cloudinary (optional — for photo/file uploads)
1. Go to https://cloudinary.com
2. Create free account
3. Copy Cloud Name, API Key, API Secret from dashboard

## 3. Add PWA Icons

Place two PNG files in `public/icons/`:
- `icon-192.png` (192×192 px)
- `icon-512.png` (512×512 px)

Quick way: Use any online icon generator or use the SVG below:
- Background: #0C0C0D
- Icon color: #7C5CFC

## 4. Run

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

Open http://localhost:3000

## Features
- Sign up / Sign in
- Onboarding (profile + family setup)
- Family Feed (posts with photos)
- Interactive Family Tree (pan, zoom, add members & relationships)
- Group Chat (3-second polling)
- Document sharing (Cloudinary)
- User profiles with avatars
- PWA (installable on iOS, Android, Desktop)

## Architecture
- **Next.js 15** App Router (React Server + Client Components)
- **MongoDB** via Mongoose (cloud hosted)
- **JWT** authentication (30-day tokens, stored in localStorage)
- **Tailwind CSS** for styling (dark theme)
- **Zustand** for client state management
- **@ducanh2912/next-pwa** for service worker / PWA
