# @ledge/web-charts

Gràfiques SVG per a `apps/web`: Angular dibuixa el DOM i d3 (`d3-scale`, `d3-shape`) només calcula escales i camins. No coneix el domini: rep `LineSeries`.

- `format.ts`: moneda i dates (ca-ES, EUR, UTC).
- `line-chart.geometry.ts`: geometria pura (testejada sense DOM).
- `ledge-line-chart`: línies, tooltip, teclat (← → Inici Fi Esc) i vista de taula.
- `ledge-chart-frame`: targeta amb estats `empty` / `loading` / `error` / `ready`.

Disseny i regles: [`docs/CHARTS.md`](../../../docs/CHARTS.md). Tests: `npx nx test web-charts`.
