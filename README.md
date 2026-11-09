# HTR · Heavy transport route check MVP

This is the **Heavy transport route check** MVP prototype exported from Figma Make. It's a React single-page application demonstrating data marketplace and route intelligence features for heavy transport logistics.

**⚠️ Note: This is a prototype with mock data.** All data, maps, and functionality are simulated for demonstration purposes.

## Tech Stack

- **React 19** with TypeScript
- **Vite 8** (build tool)
- **Tailwind CSS 4** (styling)
- **React Router 7** (routing)
- **Leaflet** (interactive maps)
- **Lucide React** (icons)

## Features

- **Data Marketplace**: Discover, publish, and manage transport data offers
- **Route Intelligence**: Check heavy transport routes with real-time monitoring
- **Live Map Explorer**: Interactive map with mobility heatmaps and route overlays
- **Connector Management**: EDR connectors, assets, policies, and negotiations
- **Data Partners**: Network management and partner profiles

## Local Development

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm

### Install Dependencies

```bash
pnpm install
```

### Run Development Server

```bash
pnpm dev
```

The app will be available at `http://localhost:8443` (or the port specified in your terminal).

### Build for Production

```bash
pnpm build
```

The production build outputs to the `dist/` directory.

### Preview Production Build

```bash
pnpm preview
```

## Deployment

This app is configured for deployment on **Vercel** as a static SPA:

- **Build Command**: `pnpm build`
- **Output Directory**: `dist`
- **Install Command**: `pnpm install`

The included `vercel.json` ensures client-side routing works correctly (deep links don't 404 on refresh).

## Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/          # Route page components
├── context/        # React Context providers
├── data/           # Mock data and utilities
├── App.tsx         # Main app with routing
└── main.tsx        # Entry point
```

## Test permits

Bundled GPX files in `public/test-permits/` (except `invalid-test.gpx`) were pre-snapped to the road network at development time with the public OSRM demo (`https://router.project-osrm.org`) and OpenStreetMap data. They are not live-routed at runtime. © OpenStreetMap contributors, ODbL. Regenerate with `node scripts/snap-test-permits.mjs`.

## License

This is a prototype application. All mock data is for demonstration purposes only.
