# Momentum Calendar

A local-first student habit tracker calendar with a welcome screen, habit completion tracking, streak analytics, templates, completion history, and JSON backup tools.

## Stack

- Pure HTML, CSS, and JavaScript
- Vite production build
- Browser `localStorage` for the profile name and habit data
- Vercel-ready static deployment

## Environment Variables

No environment variables are required for local development, production builds, or Vercel deployment.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173` or `http://127.0.0.1:5173`.

## Production Build

```bash
npm run build
npm run preview
```

## Vercel Deployment

1. Push the repository to GitHub.
2. Import the repository in Vercel.
3. Set Framework Preset to `Vite`.
4. Confirm Build Command is `npm run build`.
5. Confirm Output Directory is `dist`.
6. Deploy without adding any external provider configuration.

## Data Storage

The app stores the entered name and habit state in the browser. Export and import JSON backups from the dashboard if you want to move data between browsers or devices.
