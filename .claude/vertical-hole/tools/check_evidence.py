#!/usr/bin/env python3
"""Check manifest structure + live worktree fingerprint. Does NOT execute game tests.

Use --snapshot to print a reproducible source SHA256 for the current git worktree.
Checks PASS/FAIL must have been executed on this *exact* snapshot.
"""
from pathlib import Path
import argparse
import hashlib
import json
import re
import subprocess
import sys

REQUIRED = ('CORE-ENERGY', 'CORE-ISOLATION', 'CORE-LOOP', 'CORE-SAVE', 'TOOLS-DEV')
STATUS = {'PASS', 'FAIL', 'NOT RUN'}
p = argparse.ArgumentParser()
p.add_argument('--repo', type=Path, required=True)
p.add_argument('--manifest', type=Path, required=True)
p.add_argument('--snapshot', action='store_true', help='Print current worktree fingerprint; does not assert test results')
args = p.parse_args()
repo = args.repo.expanduser().resolve()
manifest = args.manifest.expanduser().resolve()
issues=[]
if not repo.is_dir():
    print('ERROR: repo not found:',repo)
    sys.exit(2)
try:
    report = json.loads(manifest.read_text(encoding='utf-8'))
except (OSError, ValueError) as e:
    print('ERROR: cannot read manifest:',e)
    sys.exit(2)
if not isinstance(report,dict):
    print('ERROR: manifest must be a JSON object')
    sys.exit(2)

def git(*argv):
    return subprocess.run(['git','-C',str(repo),*argv], stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE, check=True).stdout
try:
    revision=git('rev-parse','HEAD').decode('ascii').strip()
    paths=git('ls-files','--cached','--others','--exclude-standard','-z').split(b'\0')
except (OSError,subprocess.CalledProcessError, UnicodeError) as e:
    print('ERROR: target is not a readable git repository:',e)
    sys.exit(2)

# Files containing reports/logs are intentionally not part of the source snapshot.
# Never accept arbitrary manifest-supplied file paths as exclusions: otherwise a
# code file could be disguised as "evidence" and edits to it would not invalidate PASS.
EVIDENCE_PREFIX = '.claude/vertical-hole/evidence/'
exclusions = {'VH_PREFLIGHT_REPORT.md'}

def approved_evidence_path(raw, *, must_exist=False):
    if not isinstance(raw, str) or not raw.strip():
        return None
    candidate = (repo / raw).resolve()
    if candidate == repo or repo not in candidate.parents:
        return None
    rel = candidate.relative_to(repo).as_posix()
    # Require canonical location AND spelling, disallow traversal and symlink redirects.
    if rel != raw.replace('\\', '/') or not rel.startswith(EVIDENCE_PREFIX):
        return None
    if must_exist and (not candidate.is_file() or candidate.is_symlink() or candidate.stat().st_size == 0):
        return None
    return rel

if manifest == repo or repo in manifest.parents:
    rel_manifest = manifest.relative_to(repo).as_posix()
    if rel_manifest == 'VH_PREFLIGHT_MANIFEST.json' or rel_manifest.startswith(EVIDENCE_PREFIX):
        exclusions.add(rel_manifest)
    else:
        issues.append('Manifest inside repo must be VH_PREFLIGHT_MANIFEST.json or under '+EVIDENCE_PREFIX)

checks=report.get('checks',{})
if isinstance(checks,dict):
    for key, item in checks.items():
        if isinstance(item,dict) and item.get('status') in ('PASS','FAIL'):
            ev=item.get('evidence')
            if isinstance(ev,str) and ev.strip():
                rel=approved_evidence_path(ev)
                if rel is None:
                    issues.append(f'{key}: evidence outside designated audit-only folder: {ev}')
                else:
                    exclusions.add(rel)

h=hashlib.sha256()
source_files=0
for raw_path in sorted(set(p for p in paths if p)):
    try:
        rel=raw_path.decode('utf-8',errors='surrogateescape')
        posix=Path(rel).as_posix()
        if (posix in exclusions or posix.startswith('.claude/_vh_backups/')
                or posix.startswith('.claude/_vh_staging/')):
            continue
        path=repo/rel
        if path.is_symlink():
            # Hash symlink itself without dereferencing potentially external files.
            content=b'LINK\0'+str(path.readlink()).encode('utf-8','surrogateescape')
            h.update(raw_path+b'\0'+content+b'\0'); source_files+=1
            continue
        if not path.is_file():
            issues.append(f'git-listed path not a regular file: {rel}')
            continue
        h.update(raw_path+b'\0')
        with path.open('rb') as f:
            for chunk in iter(lambda:f.read(1024*1024),b''):
                h.update(chunk)
        h.update(b'\0')
        source_files+=1
    except OSError as e:
        issues.append(f'cannot fingerprint {rel}: {e}')
source_snapshot=h.hexdigest()
if args.snapshot:
    for issue in issues: print('ERROR:',issue)
    if issues: sys.exit(1)
    print('source_snapshot_sha256:',source_snapshot)
    print('source_snapshot_file_count:',source_files)
    print('git_revision:',revision)
    print('NOTE: this fingerprints git-visible source files, NOT ignored build output or executed tests')
    sys.exit(0)

if report.get('revision')!=revision:
    issues.append('manifest revision differs from actual git HEAD')
if not isinstance(report.get('git_status_before'),str) or not isinstance(report.get('git_status_after'),str):
    issues.append('missing git_status_before/after (strings, may be empty)')
if not isinstance(checks,dict):
    issues.append('checks must be a dict')
    checks={}
if report.get('source_snapshot_sha256') != source_snapshot:
    issues.append('STALE evidence: source_snapshot_sha256 differs from actual working tree (retest after modifications)')
if report.get('source_snapshot_file_count') != source_files:
    issues.append('source_snapshot_file_count differs from current tree')
for check in REQUIRED:
    item=checks.get(check)
    if not isinstance(item,dict):
        issues.append(f'{check}: missing check record')
        continue
    status=item.get('status')
    if status not in STATUS:
        issues.append(f'{check}: invalid status {status!r}')
        continue
    if status=='NOT RUN':
        if not str(item.get('reason','')).strip(): issues.append(f'{check}: missing reason')
        continue
    if item.get('snapshot_sha256') != source_snapshot:
        issues.append(f'{check}: PASS/FAIL result is not tied to current source snapshot')
    for field in ('command','environment'):
        if not isinstance(item.get(field),str) or not item[field].strip():
            issues.append(f'{check}: missing {field}')
    evidence=item.get('evidence')
    if not isinstance(evidence,str) or not evidence.strip():
        issues.append(f'{check}: missing evidence path')
    else:
        rel=approved_evidence_path(evidence, must_exist=True)
        if rel is None:
            issues.append(f'{check}: evidence must be a nonempty regular file in {EVIDENCE_PREFIX}: {evidence}')
        elif (repo/rel).resolve() == manifest:
            issues.append(f'{check}: manifest cannot serve as evidence')
if issues:
    for issue in issues: print('ERROR:',issue)
    print('EVIDENCE INCOMPLETE/STALE — no GO on stale or missing results')
    sys.exit(1)
core=[checks[key]['status'] for key in REQUIRED[:4]]
tools=checks['TOOLS-DEV']['status']
print('EVIDENCE CURRENT/FORMALLY COMPLETE — game tests NOT executed or verified by this script')
print('Worktree SHA256:',source_snapshot,'files:',source_files)
print('GO_CORE:', 'CANDIDATE — manual test evidence review' if all(x=='PASS' for x in core) else 'BLOCKED/NOT RUN')
print('GO_TOOLS:', 'CANDIDATE — manual build/device proof review' if tools=='PASS' else 'BLOCKED/NOT RUN')
print('GO_RELEASE: NOT ASSESSED')
