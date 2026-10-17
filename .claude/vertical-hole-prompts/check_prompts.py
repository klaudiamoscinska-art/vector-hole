#!/usr/bin/env python3
"""Static consistency check for P00 + 15 original + 5 audit repairs; NOT a test of the game."""
from pathlib import Path
import re
import sys

root=Path(__file__).resolve().parent
names=['P00.md','P14B.md','P06B.md','P14A.md','P14D.md','P04-05.md',
       'P07.md','P08.md','P06A.md','P09.md','P10.md','P11.md',
       'P12.md','P13.md','P14E.md','P14C.md']
repairs=['PX01-SAVE.md','PX02-ISOLATION.md','PX03-DEV-PANEL.md','PX04-PAGES.md','PX05-LIVE-PRODUCTION.md']
errors=[]
if len(names)!=16 or len(set(names))!=16:errors.append('internal name list incorrect')
for name in names+repairs:
 path=root/name
 if not path.is_file():
  errors.append('missing '+name);continue
 contents=path.read_text(encoding='utf-8')
 if not contents.startswith('/vh-'):errors.append(name+': must begin with skill invocation')
 if name in repairs:
  for key in ('VH-0', 'PASS', 'FAIL', 'NOT RUN', 'Nie publikuj'):
   if key not in contents:errors.append(name+': missing '+key)
 elif name!='P00.md':
  for key in ('GO_CORE','GO_TOOLS','NOT RUN','SAVE_MIGRATION_CONTRACT.md', 'EVIDENCE_FRESHNESS.md', 'CHANGE_SAFETY.md'):
   if key not in contents:errors.append(name+': missing '+key)
 else:
  for key in ('CORE-ENERGY','CORE-ISOLATION','CORE-LOOP','CORE-SAVE','TOOLS-DEV','source_snapshot_sha256','RELEASE_DEBUG_GUARD'):
   if key not in contents:errors.append(name+': missing '+key)
p00=(root/'P00.md').read_text(encoding='utf-8')
for phrase in ('WYŁĄCZNIE WERYFIKACJA', 'Nie wdrażaj ich drugi raz', 'NIE zmieniaj kodu źródłowego gry'):
 if phrase not in p00: errors.append('P00 missing verification-only policy: '+phrase)
for phrase in ('class DevPanel', 'SKINS.perks', 'check_pages_workflow.py', 'SAVE-08', 'SAVE-09', 'GO_RELEASE=STOP', 'context.route', 'LIVE-PRODUCTION=NOT RUN', 'PX01-SAVE.md', 'PX05-LIVE-PRODUCTION.md', 'fałszywego PASS workflow'):
 if phrase not in p00: errors.append('P00 missing 2026-10-17 blocker: '+phrase)
for filename, words in {'PX01-SAVE.md':['autosave','surowych bajtów'], 'PX03-DEV-PANEL.md':['ReferenceError','rzeczywistym uruchomieniu'], 'PX04-PAGES.md':['feature/**','GitHub Settings','fixture'], 'PX05-LIVE-PRODUCTION.md':['starego live','NOT RUN']}.items():
 for word in words:
  if word not in (root/filename).read_text(encoding='utf-8'):
   errors.append(f'{filename}: missing regression requirement: {word}')
intro=(root/'README.md').read_text(encoding='utf-8').rstrip()
# Cross-pack version safety: v1.4.1 workflow guard could falsely PASS an
# unsafe Pages deployment. Reject a README leading users to that pack.
intro_top=intro.split('##', 1)[0]
if not re.search(r'v1\.4\.2\s+lub\s+nowsza', intro_top):
 errors.append('README: missing minimum safe skills version v1.4.2 or newer')
if re.search(r'Najpierw\s+zainstaluj[^\n]*v1\.4\.[01]', intro_top, flags=re.IGNORECASE):
 errors.append('README: points users to obsolete unsafe skills pack')
if 'scripts/install.py' not in intro_top or 'nie bezpośrednio na repo' not in intro_top:
 errors.append('README: missing safe installer guidance')
expected=intro+'\n\n---\n\n# PEŁNE TREŚCI — P00 + 15 PROMPTÓW + 5 NAPRAW KRYTYCZNYCH\n'
for name in names+repairs:
 if (root/name).is_file():
  expected+='\n---\n\n## '+name+'\n\n'+(root/name).read_text(encoding='utf-8').strip()+'\n'
full=(root/'WSZYSTKIE_PROMPTY.md').read_text(encoding='utf-8')
if full!=expected:errors.append('WSZYSTKIE_PROMPTY.md not in sync with individual prompt files and README')
if "createArenaRun(upgrades=['magnet_full_run'])" not in (root/'P11.md').read_text(encoding='utf-8'):
 errors.append('P11 does not contain the explicit forbidden arena-magnet warning')
if 'UNKNOWN' not in (root/'P14D.md').read_text(encoding='utf-8'): errors.append('P14D missing frozen timer protection')
if 'N_all_eligible_entries' not in (root/'P14D.md').read_text(encoding='utf-8'):
 errors.append('P14D missing R5 independent denominator')
if errors:
 for e in errors:print('ERROR:',e)
 print('PROMPT STRUCTURE FAIL')
 sys.exit(1)
print('PROMPT STRUCTURE PASS — 16 original + 5 repair prompts, generated collection consistent (NOT game runtime)')
