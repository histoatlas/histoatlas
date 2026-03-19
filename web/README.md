# HistoAtlas Frontend (Astro + React Islands)

The frontend is now an Astro application with React islands for interactive views.

## Commands

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Architecture

- Astro pages render static layout and content first.
- React islands are hydrated for interactive sections:
  - Atlas explorer
  - Slide detail
  - Cluster detail
  - Associations explorer
  - Global search palette and selection context bar
