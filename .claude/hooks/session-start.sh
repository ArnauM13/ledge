#!/bin/bash
# SessionStart: instal·la les skills de Claude Code (scripts/install-skills.mjs)
# a ~/.claude/skills en les sessions al núvol. Al teu ordinador no fa res:
# allà ja les tens globals. Vegeu docs/SKILLS.md.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# Només s'instal·la si l'script ha canviat des de l'última instal·lació bona,
# o si falta alguna peça (el contenidor és nou i ~/.claude/skills és buit).
skills_dir="$HOME/.claude/skills"
hashes="$skills_dir/.ledge-install-skills.sha256"
required=(design-taste-frontend web-design-guidelines playwright-cli design-md humanizer skill-creator grill-me caveman copywriting replica-design)

missing=0
for s in "${required[@]}"; do
  [ -f "$skills_dir/$s/SKILL.md" ] || missing=1
done
command -v playwright-cli >/dev/null 2>&1 || missing=1

if [ "$missing" = 1 ] || ! sha256sum --check --status "$hashes" 2>/dev/null; then
  # Esborra el hash primer: si la instal·lació falla, es torna a provar la sessió següent
  rm -f "$hashes"
  node scripts/install-skills.mjs >&2
  mkdir -p "$skills_dir"
  sha256sum scripts/install-skills.mjs .claude/hooks/session-start.sh > "$hashes"
fi
