# Gràfiques de ledge — disseny

> Creat l'1/11/2026. Defineix **què** es mostra, **amb quines dades** i **com** es dibuixa.
> Relacionat: `IMPLEMENTATION_PLAN.md` (Fases 2, 4 i 5) · `apps/web/src/styles.css` (tokens).

## 1. Principis

1. **Cap xifra inventada.** Sense dades reals, la gràfica mostra l'estat buit. Les dades de prova (fixtures) només es veuen a la galeria `/dev/charts`, que només existeix al build de desenvolupament i porta el segell **«Dades de prova»**.
2. **El color té significat.** `positive` (maragda) i `negative` (vermell) només marquen el **signe d'una variació** (guany o pèrdua) o una alerta. Mai identifiquen una sèrie.
3. **Un sol eix Y.** Si dues mesures tenen escales diferents (p. ex. saldo pendent i quota anual), van en dues gràfiques.
4. **La gràfica no calcula.** El backend envia els imports ja calculats. El frontend només els converteix a `number` per dibuixar-los i formatar-los. No suma ni resta imports.
5. **Res no depèn només del color ni del hover.** Hi ha llegenda amb ≥2 sèries, etiquetes directes selectives i una vista de taula. El tooltip complementa, però no és l'única manera de veure un valor.

## 2. Catàleg

| #   | Gràfica                         | Secció       | Forma                                                               | Dades (Fase)                               |
| --- | ------------------------------- | ------------ | ------------------------------------------------------------------- | ------------------------------------------ |
| G-1 | **Evolució del patrimoni net**  | Overview     | Línia + àrea (1 sèrie: household) o 2 línies (membre A / B)         | Snapshots diaris (F2)                      |
| G-2 | Distribució per classe d'actiu  | Overview     | Una barra horitzontal 100% apilada + taula. **No donut**            | Posicions actuals (F2)                     |
| G-3 | KPIs                            | Overview     | Stat tiles (no és gràfica): patrimoni net, variació 30 d, deute viu | F2                                         |
| G-4 | Saldo pendent de la hipoteca    | Liabilities  | Línia; tram futur `ESTIMATED` discontinu                            | Calendari francès (F2.4)                   |
| G-5 | Quota anual: capital vs interès | Liabilities  | Columnes apilades per any (gràfica separada de G-4)                 | F2.4                                       |
| G-6 | Valor vs capital aportat        | Investments  | 2 línies (mateixa unitat, un sol eix)                               | F2 (posicions) + F4 (TWR/XIRR com a tiles) |
| G-7 | Cashflow mensual                | Transactions | Columnes: ingressos amunt, despeses avall, marcador del net         | Moviments (F3, G1) o entrada manual        |
| G-8 | Distribució cripto              | Crypto       | Barres horitzontals ordenades; a partir de la 6a → «Altres»         | F3 (G3/G4)                                 |
| G-9 | Rendiment acumulat indexat      | Analytics    | Línies amb base 100                                                 | F4                                         |

**Ordre d'implementació:** G-1 → G-2/G-3 → G-4/G-5 → la resta, a mesura que les fases donin dades.

### G-1 en detall (la primera)

- **Rangs:** `1M · 6M · 1A · Tot`, en un selector a sobre de la gràfica (per defecte `1A`).
- **Vista:** `Household` (1 sèrie, línia de 2px + àrea al 10%) o `Per membre` (2 línies, A = sèrie 1, B = sèrie 2, amb llegenda).
- **Etiquetes:** només el valor final, al costat del darrer punt.
- **Capçalera:** valor actual (xifra gran) + variació del rang en `positive`/`negative`, amb el signe (`+2.340,00 €` / `−1.200,00 €`). Mai només el color.
- **Hover/teclat:** línia vertical que s'enganxa a la data més propera i un tooltip amb data i valor de cada sèrie. Amb el focus a la gràfica, ← → mouen el cursor.
- **Punts `ESTIMATED`:** el tram es dibuixa discontinu i el tooltip diu «estimat».

## 3. Contracte de dades

Els tipus viuran a `libs/shared/types` (`@ledge/shared-types`). Els imports arriben com a **string decimal**, perquè a Postgres són `NUMERIC` i no han de perdre precisió en el JSON.

```ts
type DecimalString = string; // "130000.00"
type ValueQuality = 'REAL' | 'ESTIMATED';

interface NetWorthPoint {
  date: string; // ISO 8601, dia (YYYY-MM-DD)
  total: DecimalString; // household
  byMember: Record<string, DecimalString>; // memberId → import
  quality: ValueQuality;
}

interface NetWorthSeries {
  currency: 'EUR';
  members: { id: string; label: string }[]; // ordre fix → color fix
  points: NetWorthPoint[]; // ordenats per data, sense duplicats
}
```

Exemple (el cas de test de la Fase 2):

```json
{
  "currency": "EUR",
  "members": [
    { "id": "a", "label": "A" },
    { "id": "b", "label": "B" }
  ],
  "points": [
    {
      "date": "2026-10-31",
      "total": "130000.00",
      "byMember": { "a": "70000.00", "b": "60000.00" },
      "quality": "REAL"
    }
  ]
}
```

La resta de contractes (G-2 a G-9) es defineixen al PR de cada gràfica, seguint el mateix patró.

## 4. Sistema visual

Només hi ha tema fosc. Superfície de gràfica = `surface` (`#1f2125`).

### Tokens nous (`apps/web/src/styles.css`)

| Token                | Valor            | Ús                    |
| -------------------- | ---------------- | --------------------- |
| `--ledge-series-1`   | `#3987e5`        | blau (household / A)  |
| `--ledge-series-2`   | `#d95926`        | taronja (B)           |
| `--ledge-series-3`   | `#9085e9`        | violeta               |
| `--ledge-series-4`   | `#c98500`        | groc                  |
| `--ledge-series-5`   | `#d55181`        | magenta               |
| `--ledge-chart-grid` | `line`           | graella i eixos (1px) |
| `--ledge-chart-axis` | `content-subtle` | text dels eixos       |

- La paleta categòrica **exclou verds i vermells**, perquè no es confonguin amb `positive`/`negative`. Màxim 5 sèries; la 6a i següents s'agrupen a «Altres».
- **Validada** sobre `#1f2125` en aquest ordre, amb el validador de paleta del skill de dataviz: banda de lluminositat, croma, contrast ≥ 3:1, separació amb daltonisme ΔE ≥ 8,7 (adjacents) i visió normal ΔE ≥ 19,3. Si es canvia l'ordre o un valor, cal tornar-la a validar.
- **El color segueix l'entitat, no la posició.** Si un filtre amaga una sèrie, les altres no canvien de color.

### Marques

- Línies de 2px (unió i extrem arrodonits) i àrea al 10% d'opacitat.
- Barres de ≤ 24px, amb l'extrem arrodonit a 4px i separació de 2px entre segments.
- Punts de ≥ 8px amb anell de 2px del color de superfície.
- Graella horitzontal d'1px, contínua i discreta. Res de graella vertical.
- El text va amb els tokens de text (`content`, `content-muted`, `content-subtle`), **mai amb el color de la sèrie**.

### Format

- Moneda: `Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' })` → `130.000,00 €`.
- Eixos compactes: `0 €`, `50 k€`, `100 k€`, amb `tabular-nums`.
- Dates: `oct. 2026` als eixos i `31 oct. 2026` al tooltip.

## 5. Estats

| Estat     | Què es veu                                                                |
| --------- | ------------------------------------------------------------------------- |
| `empty`   | Marc de la gràfica + «Encara no hi ha dades» (sense eixos ni xifres)      |
| `loading` | Primera càrrega: marc buit. Recàrrega: es manté el dibuix anterior al 50% |
| `error`   | Missatge + «Torna-ho a provar»                                            |
| `ready`   | Gràfica                                                                   |

## 6. Accessibilitat

- `<figure>` amb `<figcaption>` (títol) i un SVG amb `role="img"` i un `aria-label` resum. Per exemple: «Patrimoni net, de 1.000,00 € l'1 de gen. a 130.000,00 € el 31 d'oct.».
- Botó **«Veure com a taula»**: una taula real (`<table>`) amb les mateixes dades.
- La gràfica és focusable i es pot fer servir amb el teclat (← →). Té focus visible.
- `prefers-reduced-motion`: sense animacions.
- Noms de sèrie i etiquetes s'insereixen amb interpolació d'Angular, mai `innerHTML`.

## 7. Arquitectura

- **Lib** `libs/web/charts` (`@ledge/web-charts`), Angular standalone + OnPush + signals.
- **Dependències:** només `d3-scale` i `d3-shape` (càlcul d'escales i camins). El DOM el genera Angular; d3 no toca el DOM.
- **Dues capes:**
  1. **Geometria pura** (`*.geometry.ts`): dades → escales, camins i ticks. Funcions sense DOM, testejades amb casos coneguts.
  2. **Components** (`ledge-line-chart`, `ledge-chart-frame`): només pinten el resultat de la geometria i gestionen hover, teclat i estats.
- **Mida:** un `ResizeObserver` dona l'amplada al contenidor i l'alçada és fixa per gràfica (G-1: 240px; 180px al mòbil).
- **Galeria** `/dev/charts`: ruta registrada només amb `isDevMode()`, amb fixtures i el segell «Dades de prova». No s'inclou al build de producció.

## 8. Pla de PRs

1. ✅ **Disseny**: aquest document.
2. **Lib + G-1**: `libs/web/charts`, tokens de sèrie, `NetWorthSeries` a shared-types, `ledge-line-chart` amb estats, tooltip, teclat i taula, i la galeria `/dev/charts`. L'Overview **no** mostra res fins que hi hagi l'endpoint (Fase 2).
3. **G-2 + G-3**: barra de distribució i stat tiles.
4. **G-4 + G-5**: hipoteca, quan existeixi el calendari de la Fase 2.4.
5. **Connexió a l'API**: `GET /api/net-worth?range=1A` quan la Fase 2 tingui snapshots. Substitueix les fixtures a l'Overview.
6. G-6 a G-9 segons les Fases 3 i 4.
