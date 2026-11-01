// Instal·la skills globals per a Claude Code (a ~/.claude/skills).
// Ús: node scripts/install-skills.mjs   · Requisits: Node >= 22 i Git.
// Al núvol: posa-ho a l'script de configuració de l'entorn (docs/MANUAL_SETUP.md §4).
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
const failed = [];

// 1) Skills instal·lables amb el CLI `skills`
const skills = [
  // Bàsiques
  ['blader/humanizer'],
  ['anthropics/skills', 'skill-creator'],
  ['mattpocock/skills', 'grill-me'],
  ['JuliusBrussee/caveman'],
  ['coreyhaines31/marketingskills'],
  // Disseny
  ['Leonxlnx/taste-skill'],
  ['vercel-labs/agent-skills', 'web-design-guidelines'],
  ['microsoft/playwright-cli'],
  // ['<owner>/<image-to-code-repo>'], // PENDENT
  // Replicar projectes
  ['Jakeschincariol/replica-skill'],
];

for (const [repo, skill] of skills) {
  const cmd = `npx -y skills add ${repo}${skill ? ` --skill ${skill}` : ''} -g -a claude-code -y`;
  console.log(`\n>>> ${cmd}`);
  try {
    run(cmd);
  } catch {
    failed.push(repo + (skill ? ` (${skill})` : ''));
  }
}

// playwright-cli: la skill necessita també el binari
console.log('\n>>> npm i -g @playwright/cli');
try {
  run('npm i -g @playwright/cli');
} catch {
  failed.push('@playwright/cli');
}

// 2) awesome-design-md: no és una skill -> es clona i s'embolcalla amb una skill pròpia
const claudeDir = join(homedir(), '.claude');
const designRepo = join(claudeDir, 'awesome-design-md');
const designSkill = join(claudeDir, 'skills', 'design-md');

console.log('\n>>> awesome-design-md');
try {
  if (existsSync(designRepo)) {
    run(`git -C "${designRepo}" pull`);
  } else {
    run(
      `git clone --depth 1 https://github.com/VoltAgent/awesome-design-md.git "${designRepo}"`,
    );
  }

  mkdirSync(designSkill, { recursive: true });
  writeFileSync(
    join(designSkill, 'SKILL.md'),
    `---
name: design-md
description: Aplica el sistema de disseny d'una marca coneguda (Stripe, Linear, Vercel, Apple...) a partir de la col·lecció awesome-design-md. Fes-la servir quan l'usuari demani un disseny "a l'estil de" una web o marca, o vulgui un DESIGN.md per al projecte.
---

# Design MD

La col·lecció és a \`~/.claude/awesome-design-md/\`.

1. Busca la marca demanada dins la col·lecció (cerca els fitxers \`DESIGN.md\` i el nom de la marca a la seva ruta).
2. Llegeix el seu \`DESIGN.md\` sencer.
3. Copia'l a l'arrel del projecte com a \`DESIGN.md\`.
4. Aplica'n els colors, la tipografia, els espaiats i els components a tota la UI que generis.
5. Si no hi ha la marca demanada, llista les disponibles i proposa'n la més semblant.
`,
    'utf8',
  );
  console.log('design-md creada ✅');
} catch {
  failed.push('awesome-design-md (design-md)');
}

// 3) Resum
run('npx -y skills ls -g');
console.log(
  failed.length ? `\nHan fallat: ${failed.join(', ')}` : '\nTot instal·lat ✅',
);
if (failed.length) process.exitCode = 1;
