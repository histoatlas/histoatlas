# Astro Migration: Component Island Strategy

## Page Shell

- `src/layouts/BaseLayout.astro`: static HTML/CSS shell (no hydration)
- `src/pages/about.astro`, `src/pages/methods.astro`, `src/pages/blog.astro`, `src/pages/terms.astro`, `src/pages/privacy.astro`, `src/pages/dpa.astro`: static pages only

## Global Islands

- `src/islands/GlobalNavIsland.tsx` (`client:load`): search interactions + keyboard shortcuts
- `src/components/layout/SelectionContextBar.tsx` (`client:load`): store-driven selection context

## Route Islands

- `src/islands/AtlasPageIsland.tsx` (`client:load`)
  - Interactive requirements: deck.gl embedding, live filtering, table sorting/pagination, URL sync, downloads
- `src/islands/SlidePageIsland.tsx` (`client:load`)
  - Interactive requirements: API-driven slide payload, similar slides, feature/tile controls
- `src/islands/ClusterPageIsland.tsx` (`client:load`)
  - Interactive requirements: tab state, enrichment charts, survival curves, paginated member table
- `src/islands/AssociationsPageIsland.tsx` (`client:load`)
  - Interactive requirements: URL-driven controls, volcano interactions, sortable table, dynamic detail panels

## Static-First Decisions

- Internal app routing moved to Astro pages + URL/path parsing hooks.
- React Router and `nuqs` adapters removed.
- Navigation links are regular anchors for cacheable MPA-style navigation.

## Next Optimization Targets

- Pre-render atlas-side metadata (`cancerTypeCounts`, static sidebar copy) directly in Astro using build-time JSON.
- Split atlas table and plot into separate islands to avoid hydrating both when only one is visible.
- Use `client:idle` for non-critical islands (search palette, selection bar) after UX validation.
