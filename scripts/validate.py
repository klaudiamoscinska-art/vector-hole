#!/usr/bin/env python3
"""Validate the Vertical Hole Claude Code skills pack; standard library only."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SKILLS = ROOT / '.claude' / 'skills'
DOCS = ROOT / '.claude' / 'vertical-hole'
errors = []
names = set()
for p in sorted(SKILLS.glob('*/SKILL.md')):
    content = p.read_text(encoding='utf-8')
    if not content.startswith('---\n'):
        errors.append(f'{p}: frontmatter must be the first line')
        continue
    parts = content.split('\n---\n', 1)
    if len(parts) != 2:
        errors.append(f'{p}: frontmatter close marker missing')
        continue
    fm, body = parts
    metadata = {}
    for line in fm.splitlines()[1:]:
        if not line.strip():
            continue
        match = re.match(r'^([\w-]+):\s*(.*)$', line)
        if not match:
            errors.append(f'{p}: invalid YAML entry {line!r}')
        else:
            metadata[match.group(1)] = match.group(2).strip('"')
    name = metadata.get('name')
    if name != p.parent.name:
        errors.append(f'{p}: name mismatch {name!r}')
    if not name or not re.fullmatch(r'[a-z][a-z0-9-]{0,63}', name):
        errors.append(f'{p}: invalid name')
    if name in names:
        errors.append(f'{p}: duplicate name')
    names.add(name)
    if not metadata.get('description') or len(metadata['description']) > 1024:
        errors.append(f'{p}: missing or long description')
    if '## Procedura operacyjna' not in body or '## Definition of Done' not in body:
        errors.append(f'{p}: not executable enough')
    for doc in re.findall(r'\.claude/vertical-hole/([A-Z_]+\.md)', body):
        if not (DOCS / doc).exists():
            errors.append(f'{p}: missing reference {doc}')
for p in (ROOT/'README.md', ROOT/'CLAUDE.md', ROOT/'START_PROMPT.md'):
    if not p.is_file(): errors.append(f'missing {p}')
if len(names) != 22:
    errors.append(f'expected 22 skills, found {len(names)}')
print(f'Found {len(names)} skills and {len(list(DOCS.glob("*.md")))} reference docs.')
if errors:
    print('\n'.join('ERROR: ' + e for e in errors))
    sys.exit(1)
print('PASS — structure, metadata, required sections and document references.')
