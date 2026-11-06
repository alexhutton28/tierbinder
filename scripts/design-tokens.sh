#!/bin/sh
# Regenerates design/theme.css from design/hutton-design-system.md with the hutton-design
# skill, then prints its completeness and contrast check. Commit the generated file;
# never edit it by hand. --keep-defaults stays until the code stops using Tailwind's
# default utilities.
set -eu

GEN="${HUTTON_DESIGN_GEN:-$HOME/.claude/skills/hutton-design/scripts/gen-tokens.py}"
cd "$(dirname "$0")/.."

python3 -I "$GEN" design/hutton-design-system.md --format tailwind4 --keep-defaults \
  --out design/theme.css
python3 -I "$GEN" design/hutton-design-system.md --check
