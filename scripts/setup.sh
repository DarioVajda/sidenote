#!/usr/bin/env bash
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Research Notes — First-time setup ==="
echo ""

# Dependencies
echo "→ Installing npm dependencies..."
cd "$REPO_ROOT" && npm install

# Data directories
echo "→ Creating data directories..."
mkdir -p "$REPO_ROOT/data/pdfs"

# Database
echo "→ Setting up database..."
cd "$REPO_ROOT" && npx drizzle-kit push

# Agent skills
echo "→ Installing Claude Code agent skills..."
CLAUDE_SKILLS="$HOME/.claude/skills"
mkdir -p "$CLAUDE_SKILLS"

for skill in do-research before-research ask-paper; do
  SKILL_SRC="$REPO_ROOT/agents/skills/$skill"
  SKILL_LINK="$CLAUDE_SKILLS/$skill"

  if [ -L "$SKILL_LINK" ]; then
    rm "$SKILL_LINK"
  elif [ -e "$SKILL_LINK" ]; then
    echo "  ⚠ $SKILL_LINK exists and is not a symlink — skipping (remove it manually to install)"
    continue
  fi

  ln -s "$SKILL_SRC" "$SKILL_LINK"
  echo "  ✓ Linked $skill"
done

# System dependency checks
echo ""
echo "→ Checking system dependencies..."
WARNINGS=0

if ! command -v pdftoppm &>/dev/null; then
  echo "  ⚠ pdftoppm not found — needed by /do-research for PDF page rendering"
  echo "    Fix: brew install poppler"
  WARNINGS=$((WARNINGS + 1))
else
  echo "  ✓ pdftoppm"
fi

if ! python3 -c "import PIL" &>/dev/null 2>&1; then
  echo "  ⚠ Python Pillow not found — needed by /do-research for reference verification"
  echo "    Fix: pip install Pillow"
  WARNINGS=$((WARNINGS + 1))
else
  echo "  ✓ Pillow"
fi

echo ""
if [ "$WARNINGS" -eq 0 ]; then
  echo "✓ Setup complete. Run 'npm run dev' to start the app."
else
  echo "✓ Setup complete with $WARNINGS warning(s) above. Run 'npm run dev' to start the app."
fi
