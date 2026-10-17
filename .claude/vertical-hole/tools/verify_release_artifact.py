#!/usr/bin/env python3
"""Fail-closed minimal debug sentinel check for separate DEV and RELEASE artifacts.
This is NOT proof that all debug code is absent or that deployment points to release.
"""
import argparse
import hashlib
from pathlib import Path
import sys

p = argparse.ArgumentParser(description='Check dev sentinel presence and release sentinel absence')
p.add_argument('--dev-build', type=Path, required=True)
p.add_argument('--release-build', type=Path, required=True)
p.add_argument('--marker', action='append', default=[], help='Additional known debug-only sentinel; repeatable')
a = p.parse_args()
markers = ['VH_DEV_CONSOLE_ONLY'] + a.marker
# These are signatures of real production-exposed debug code in the inspected
# October 2026 Vector Hole source. A mere absent marker is insufficient.
# New debug modules must extend this denylist AND have manual/code review.
RELEASE_DENYLIST = (
    b'class DevPanel', b'window.game.devPanel', b'DEV_ACCESS_KEY',
    b'DEV_CODE_HASH', b'DEV_SANDBOX_SAVE_KEY', b'devCodeToken(',
    b'VH_DEV_CONSOLE_ONLY',
)
issues=[]

def read_artifact(folder):
    folder=folder.expanduser().resolve()
    if not folder.is_dir():
        issues.append(f'MISSING BUILD: {folder}'); return folder, [], None
    files=[]; digest=hashlib.sha256()
    for path in sorted(folder.rglob('*')):
        if path.is_symlink():
            issues.append(f'SYMLINK IN BUILD: {path}'); continue
        if not path.is_file(): continue
        rel=path.relative_to(folder).as_posix()
        files.append(path)
        digest.update(rel.encode('utf-8')+b'\0')
        with path.open('rb') as f:
            for chunk in iter(lambda:f.read(1024*1024),b''):
                digest.update(chunk)
    if not files: issues.append(f'EMPTY BUILD: {folder}')
    return folder,files,digest.hexdigest()

d,df,dh=read_artifact(a.dev_build)
r,rf,rh=read_artifact(a.release_build)
if d==r or d in r.parents or r in d.parents:
    issues.append('Dev and release artifact paths must be separate, non-nested directories')

for marker in markers:
    if not marker.strip() or len(marker)<6:
        issues.append('Markers must be descriptive nonempty strings >=6 chars')
        continue
    b=marker.encode('utf-8')
    # bounded reads for large bundles; scan byte stream across buffer boundaries
    def hits(paths):
        found=[]
        for path in paths:
            with path.open('rb') as f:
                tail=b''
                while chunk:=f.read(1024*1024):
                    content=tail+chunk
                    if b in content:
                        found.append(str(path))
                        break
                    tail=content[-max(1,len(b)-1):]
        return found
    have_dev=hits(df); have_prod=hits(rf)
    if not have_dev: issues.append(f'Dev artifact missing sentinel: {marker}')
    if have_prod: issues.append(f'RELEASE CONTAINS DEBUG SENTINEL {marker}: '+', '.join(have_prod[:8]))
# Deliberately scan executable assets, not README/docs which may mention
# forbidden signatures as examples. Case-sensitive matches to code identifiers.
for path in rf:
    if path.suffix.lower() not in {'.js','.mjs','.cjs','.html','.htm','.map','.wasm'}:
        continue
    # Streaming is intentionally unnecessary here: build assets are expected
    # to be small enough for bounded per-file reads; never scan giant media.
    try:
        if path.stat().st_size > 150*1024*1024:
            issues.append(f'OVERSIZE EXECUTABLE ARTIFACT FOR REVIEW: {path}')
            continue
        blob=path.read_bytes()
    except OSError as e:
        issues.append(f'COULD NOT SCAN RELEASE ASSET {path}: {e}')
        continue
    for signature in RELEASE_DENYLIST:
        if signature in blob:
            issues.append(f'RELEASE CONTAINS DEBUG IMPLEMENTATION {signature.decode()}: {path}')
print(f'DEV: {d} ({len(df)} files, sha256 {dh})')
print(f'RELEASE: {r} ({len(rf)} files, sha256 {rh})')
for e in issues: print('ERROR:',e)
if issues:
    print('ARTIFACT GUARD FAIL (no GO_TOOLS / GO_RELEASE)')
    sys.exit(1)
print('STATIC DEBUG CHECK PASS (necessary not sufficient: validate workflow, live URL, all scripts, phones and save isolation)')
