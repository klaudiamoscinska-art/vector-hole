#!/usr/bin/env python3
"""Fail-closed static veto for unsafe GitHub Pages workflows (stdlib only).

Not a YAML parser or an approval proof. Unknown syntax -> REVIEW/FAIL, not PASS.
PASS only indicates no *known* unsafe triggers/paths in inspected jobs. Real
artifact, branch protections, environment reviewers and live URL need checks.
"""
from pathlib import Path
import argparse
import re
import sys

parser = argparse.ArgumentParser()
parser.add_argument('--repo', type=Path, required=True)
a = parser.parse_args()
root = a.repo.expanduser().resolve()
folder = root / '.github/workflows'
if not folder.is_dir():
    print('NOT RUN: no GitHub Actions workflow directory; review actual deployment provider')
    sys.exit(2)
files = sorted(p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in {'.yml', '.yaml'})
issues = []
found = False


def useful_lines(data):
    # Do not interpret arbitrary YAML anchors/expressions as safe. Keep their
    # original text so conservative allow-lists reject them.
    return [line.split(' #', 1)[0].rstrip() for line in data.splitlines()]


def indent(line):
    return len(line) - len(line.lstrip(' '))


def block(lines, start):
    """Lines beneath a mapping key, stopping at sibling/parent key."""
    level = indent(lines[start])
    end = start + 1
    while end < len(lines):
        s = lines[end]
        if s.strip() and indent(s) <= level:
            break
        end += 1
    return lines[start + 1:end]


def trigger_check(lines, filename):
    indices = [i for i, line in enumerate(lines) if re.match(r'^\s*(?:on|["\']on["\']):\s*', line) and indent(line) == 0]
    if len(indices) != 1:
        issues.append(f'{filename}: cannot establish exactly one top-level on: trigger; manual review required')
        return
    line = lines[indices[0]]
    if line.split(':', 1)[1].strip():
        issues.append(f'{filename}: inline on: triggers not verified; use explicit push/branches map or workflow_dispatch')
        return
    event_body = block(lines, indices[0])
    events = [(i, re.match(r'^\s*([\w-]+):\s*(.*)$', item)) for i, item in enumerate(event_body) if item.strip() and indent(item) == 2]
    if not events or any(not match for _, match in events):
        issues.append(f'{filename}: cannot inspect workflow triggers')
        return
    names = [match.group(1) for _, match in events]
    if any(e not in {'push', 'workflow_dispatch'} for e in names):
        issues.append(f'{filename}: deployment has unreviewed event(s): {names}')
    if len(names) != len(set(names)):
        issues.append(f'{filename}: duplicate event declarations')
    if 'push' in names:
        i = next(idx for idx, m in events if m.group(1) == 'push')
        push_line = event_body[i]
        if push_line.split(':', 1)[1].strip():
            issues.append(f'{filename}: push trigger must explicitly restrict branches')
            return
        body = block(event_body, i)
        if any(re.match(r'^\s*(branches-ignore|tags|tags-ignore):', s) for s in body):
            issues.append(f'{filename}: unsupported branch/tag filtering; manual review required')
        entries = [j for j, s in enumerate(body) if re.match(r'^\s*branches:', s) and indent(s) == 4]
        if len(entries) != 1:
            issues.append(f'{filename}: push without a single explicit branches allowlist')
            return
        j = entries[0]
        tail = body[j].split(':', 1)[1].strip()
        if tail:
            if not (tail.startswith('[') and tail.endswith(']')):
                issues.append(f'{filename}: unparseable inline branches allowlist')
                return
            branches = [s.strip().strip('"\'') for s in tail[1:-1].split(',')]
        else:
            branches = [m.group(1).strip().strip('"\'') for s in block(body, j)
                        if (m := re.match(r'^\s*-\s*(.+?)\s*$', s))]
        if branches != ['main']:
            issues.append(f'{filename}: push branches {branches!r}; only reviewed main is allowed by this guard')


def safe_path(value):
    val = value.strip().strip('"\'').rstrip('/')
    # Require a literal curated build output, not root, another repo folder or
    # an expression whose resolved value could silently be the repository root.
    if not val or '${{' in val or '*' in val or '$' in val or '\\' in val:
        return False
    if val.startswith('./'):
        val = val[2:]
    if val in {'.', '..'} or val.startswith('/') or '//' in val:
        return False
    components = val.split('/')
    if '..' in components or '.' in components or not all(components):
        return False
    if components[0] not in {'release', 'dist', 'build', 'public', 'site', 'out'}:
        return False
    return not any(c.lower() in {'dev','debug','test','tests','qa','.claude'} for c in components)


def job_check(lines, filename):
    job_top = next((i for i, s in enumerate(lines) if re.match(r'^jobs:\s*$', s)), None)
    if job_top is None:
        issues.append(f'{filename}: jobs mapping missing')
        return
    job_lines = block(lines, job_top)
    heads = [(i, re.match(r'^  ([\w-]+):\s*$', s)) for i, s in enumerate(job_lines) if indent(s) == 2 and s.strip()]
    if not heads or any(not m for _, m in heads):
        issues.append(f'{filename}: cannot inspect jobs')
        return
    uploads = 0
    deploys = 0
    for i, match in heads:
        body = block(job_lines, i)
        if not any('actions/deploy-pages@' in s or 'actions/upload-pages-artifact@' in s for s in body):
            continue
        envs = [idx for idx, s in enumerate(body) if re.match(r'^\s*environment:\s*', s) and indent(s) == 4]
        environment = None
        if len(envs) == 1:
            raw = body[envs[0]].split(':', 1)[1].strip().strip('"\'')
            if raw:
                environment = raw
            else:
                for s in block(body, envs[0]):
                    m = re.match(r'^\s*name:\s*([^\s#]+)', s)
                    if m:
                        environment = m.group(1).strip('"\'')
                        break
        if environment != 'github-pages':
            issues.append(f'{filename}: deployment job {match.group(1)} has no fixed github-pages environment')
        # GitHub Actions commonly writes "- name: Upload" followed by an
        # indented "uses: ..." rather than "- uses: ..." on one line.
        # Group whole steps; a line-oriented detector would miss both actions.
        step_headers = [idx for idx, line in enumerate(body)
                        if re.match(r'^\s*-\s*(?:name|uses|id|run):', line)
                        and indent(line) == 6]
        for idx in step_headers:
            step = [body[idx]]
            next_idx = idx + 1
            while next_idx < len(body):
                line = body[next_idx]
                if line.strip() and indent(line) <= 6:
                    break
                step.append(line)
                next_idx += 1
            uses = [m.group(1).strip('"\'') for line in step
                    if (m := re.match(r'^\s*(?:-\s*)?uses:\s*(\S+)', line))]
            if any('actions/deploy-pages@' in action for action in uses):
                deploys += 1
            if not any('actions/upload-pages-artifact@' in action for action in uses):
                continue
            uploads += 1
            paths = [m.group(1).strip() for line in step
                     if (m := re.match(r'^\s*path:\s*(.*?)\s*$', line))]
            if len(paths) != 1 or not safe_path(paths[0]):
                issues.append(f'{filename}: upload in job {match.group(1)} lacks a safe literal release path: {paths!r}')
    if uploads == 0 or deploys == 0:
        issues.append(f'{filename}: Pages upload + deployment job pair not established')


for file in files:
    raw = file.read_text(encoding='utf-8')
    if not any(token in raw for token in ('actions/deploy-pages@', 'actions/upload-pages-artifact@')):
        continue
    found = True
    lines = useful_lines(raw)
    trigger_check(lines, file.name)
    job_check(lines, file.name)
    print('CHECKED:', file.relative_to(root))
if not found:
    print('NOT RUN: no Pages workflow found; check other deployment mechanisms')
    sys.exit(2)
for issue in issues:
    print('ERROR:', issue)
if issues:
    print('PAGES WORKFLOW GUARD FAIL — STOP GO_RELEASE')
    sys.exit(1)
print('PAGES WORKFLOW STATIC CHECK PASS (not permission, environment reviewer, built bytes, or live URL proof)')
