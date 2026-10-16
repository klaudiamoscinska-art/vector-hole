#!/usr/bin/env python3
"""Non-destructive installer for Vertical Hole Claude Code skills pack (Python stdlib)."""
from pathlib import Path
import argparse
import shutil
import sys
from datetime import datetime, timezone

source = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description='Install Vertical Hole Claude Code skills into a game repository')
parser.add_argument('repo', type=Path, help='Existing target repo folder')
parser.add_argument('--force', action='store_true', help='Back up then replace existing matching skills/docs')
args = parser.parse_args()
target = args.repo.expanduser().resolve()
if not target.is_dir():
    parser.error('Target directory does not exist')
if target == source.resolve():
    print('The extracted pack is already in the selected directory. Nothing to copy.')
    sys.exit(0)

stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
conflicts = []
items = []
for folder in ('.claude/skills', '.claude/vertical-hole'):
    for x in sorted((source/folder).iterdir()):
        items.append((x,target/folder/x.name))
for x, dst in items:
    if dst.exists():
        conflicts.append(dst)
if conflicts and not args.force:
    print('SKIPPED: existing files/directories. Existing data was not changed.')
    for x in conflicts: print('  CONFLICT',x)
    print('Review and rerun with --force to back up and replace; otherwise install into a clean repo.')
    sys.exit(2)
backup_dir = target / '.claude' / '_vh_backups' / stamp
for src,dst in items:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        back = backup_dir / dst.relative_to(target)
        back.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(dst),str(back))
    if src.is_dir(): shutil.copytree(src,dst)
    else: shutil.copy2(src,dst)
    print('INSTALLED',dst.relative_to(target))
claude = target/'CLAUDE.md'
if claude.exists():
    print('PRESERVED existing CLAUDE.md — merge the provided CLAUDE.md manually.')
else:
    shutil.copy2(source/'CLAUDE.md',claude)
    print('INSTALLED CLAUDE.md')
if conflicts:
    print('Backups:',backup_dir)
print('Start Claude Code inside',target,'and invoke /vh-director or /skills.')
