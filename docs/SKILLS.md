# Skills de Claude Code

> Actualitzat l'01/11/2026. Quines skills fa servir aquest projecte, com arriben a cada sessió i com s'usen aquí.

## 1. Quines i per a què

Les instal·la [`../scripts/install-skills.mjs`](../scripts/install-skills.mjs) a `~/.claude/skills` (globals).

| Skill                     | Repositori                                            | Per a què, en aquest projecte                                                                            |
| ------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **design-taste-frontend** | `Leonxlnx/taste-skill`                                | **Obligatòria a la UI.** Regles de pantalles d'app, estil (`draw.mjs --app`), `lint.mjs` i `inspect.mjs` |
| **web-design-guidelines** | `vercel-labs/agent-skills`                            | Revisió de la UI amb les Web Interface Guidelines de Vercel, en format `fitxer:línia`                    |
| **playwright-cli**        | `microsoft/playwright-cli` + binari `@playwright/cli` | Veure i provar la web amb un navegador: clics, teclat, captures                                          |
| **design-md**             | `VoltAgent/awesome-design-md` + embolcall propi       | Sistemes de disseny de marques conegudes (`DESIGN.md`). Referència, no és la línia del ledge             |
| humanizer                 | `blader/humanizer`                                    | Treure tics d'escriptura d'IA d'un text                                                                  |
| skill-creator             | `anthropics/skills`                                   | Crear o millorar skills                                                                                  |
| grill-me                  | `mattpocock/skills`                                   | Que Claude t'interrogui sobre un pla abans de fer-lo                                                     |
| caveman (i família)       | `JuliusBrussee/caveman`                               | Respostes i revisions comprimides                                                                        |
| marketingskills           | `coreyhaines31/marketingskills`                       | Màrqueting. No aplica al ledge (és privat)                                                               |
| replica-*                 | `Jakeschincariol/replica-skill`                       | Replicar projectes                                                                                       |
| image to code             | **pendent**: falta el repositori                      | —                                                                                                        |

## 2. Com arriben a cada sessió

| On                    | Com                                                                                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sessions al núvol** | **Hook `SessionStart` del repo** ([`../.claude/hooks/session-start.sh`](../.claude/hooks/session-start.sh), registrat a `../.claude/settings.json`). No cal configurar res |
| El teu ordinador      | Ja les tens globals (vas executar l'script). El hook no hi fa res                                                                                                          |

**Què fa el hook** (síncron, només si `CLAUDE_CODE_REMOTE=true`):

1. Comprova que hi hagi les skills clau (`design-taste-frontend`, `web-design-guidelines`, `playwright-cli`, `design-md` i una de cada repositori) i el binari `playwright-cli`.
2. Comprova que `scripts/install-skills.mjs` i el hook no hagin canviat des de l'última instal·lació bona (hash a `~/.claude/skills/.ledge-install-skills.sha256`).
3. Si tot hi és: no fa res (**0,006 s**). Si en falta alguna o han canviat: executa l'script (**~50–60 s**, només la primera sessió d'un contenidor nou) i desa el hash.

Provat l'01/11/2026: instal·lació des de zero (57 s), segona execució (0,006 s), fora del núvol (0,006 s, no fa res) i amb una skill esborrada (la reinstal·la, 49 s).

**Coses a saber:**

- El hook només s'aplica a les sessions que arrenquen amb aquesta versió de `main`.
- És **síncron**: la primera sessió en un contenidor nou espera ~1 minut abans de començar. A canvi, les skills hi són des del primer missatge. Es pot fer asíncron (`{"async": true}`) si prefereixes que la sessió arrenqui de seguida.
- Si una instal·lació falla, el hook falla, i la sessió següent ho torna a provar.
- Són skills de tercers: cada instal·lació baixa la darrera versió del seu repositori.
- Per afegir o treure una skill: edita `scripts/install-skills.mjs` (i, si és clau, la llista `required` del hook). El canvi de hash fa que es reinstal·lin a la sessió següent.

**Comprovar-ho en una sessió:**

```bash
ls ~/.claude/skills | grep -E "taste|web-design|playwright|design-md"
```

```bash
command -v playwright-cli
```

## 3. Com es fan servir aquí

### Qualsevol canvi a la UI (regla de `CLAUDE.md`)

1. Llegeix `docs/DESIGN_CHANGES.md` i les referències de `docs/design/`.
2. Segueix `~/.claude/skills/design-taste-frontend/references/app-screens.md` (és una **pantalla d'app**, no una pàgina).
3. Comprova-ho:

```bash
K=~/.claude/skills/design-taste-frontend
node $K/scripts/lint.mjs --app apps/web/src
node $K/scripts/inspect.mjs --app http://localhost:4200/login --out .taste-skill/after
```

4. Revisa les captures que llista l'inspector (1440, 768 i 390 px). Objectiu: **0 FAIL**; cada WARN, corregit o defensat al PR.
5. Passa les Web Interface Guidelines (skill `web-design-guidelines`) pels fitxers tocats.
6. Prova-ho amb el teclat amb `playwright-cli` (`open`, `press Tab`, `screenshot`).

### Pantalles amb sessió

L'inspector no pot fer login amb TOTP. Per revisar l'Overview o qualsevol pantalla rere el login, arrenca l'app i fes el login amb Playwright (recepta a [`CONTEXT.md`](CONTEXT.md) §6), i revisa les captures a les tres amplades.

### Estil ja decidit

`true-black-flat`, llavor 520370458, amb el shell redibuixat a «marc en T» (`DESIGN_CHANGES.md` §0). **No es torna a fer el sorteig**: les sessions noves el mantenen. Per tornar a imprimir el full d'estil en una sessió nova, executa les dues comandes de `DESIGN_CHANGES.md` §0 (llavor fixa + redibuix del shell). Generen `.taste-skill/direction.json`, que no es puja al repo; després, `draw.mjs --show` el torna a mostrar.

## 4. Límits coneguts

| Límit                                                          | Conseqüència                                                                                  |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| UXKIN (comparar amb webs reals a `web-review`)                 | Necessita compte i autorització; sense això, la revisió es fa sense comparar                  |
| L'inspector no passa el login                                  | Les pantalles amb sessió es revisen amb captures de Playwright                                |
| `api:test-integration` necessita el dimoni de Docker           | Al núvol, amb el Postgres del contenidor i `DB_HOST` (`CONTEXT.md` §6); el CI ho fa a cada PR |
| La sortida de les skills (`.taste-skill/`, `.playwright-cli/`) | És a `.gitignore`: no es puja mai                                                             |
