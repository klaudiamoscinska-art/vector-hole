// CG-DATA-1: a QA stand-in for the CrazyGames HTML5 SDK v3 (https://sdk.crazygames.com/
// crazygames-sdk-v3.js), served by the QA suites in place of the real file -- nothing
// leaves the machine. It follows what the real SDK 3.8.0 does (its code, read 2026-11-06):
// init() is async; data.getItem/setItem/removeItem/clear are sync on an in-memory copy;
// a guest's data is one localStorage blob SDK_DATA_<gameId> = {"data":{...}}; a
// logged-in player's comes from the account (here: window.__cgCloud, a Playwright
// binding, or a localStorage stand-in), and an account with no data takes over the
// guest's; getItem returns `value || null`; over 1 MB setItem throws dataLimitExcedeed
// AFTER taking the value into memory; a login fires the auth listeners and switches
// SDK.data to the account's data. A mock is not the portal: its PASS is not a
// CrazyGames PASS.
//
// window.__cgMock (set before the page loads, read again on every data call):
//   mode: 'sdk' (above) | 'passthrough' (every key is a plain localStorage key, so the
//         older package suites keep seeding 'vectorHoleSave_v1' directly)
//   environment: 'local' | 'crazygames' | 'disabled' (default by host)
//   initDelayMs, initFails, initHangs, dataDisabled, failGet, failSet, limitBytes,
//   failRemove: [keys] whose removeItem throws (CG-DATA-2 R1: a partly failed reset)
//   user: { id, username } or null (also kept in localStorage.__cgMockUser)
(() => {
  const GAME_ID = 'qa-mock';
  const GUEST_KEY = 'SDK_DATA_' + GAME_ID, CACHE_KEY = 'SDK_DATA_CLOUD_CACHE_' + GAME_ID;
  const cfg = () => window.__cgMock || (window.__cgMock = {});
  const log = window.__cgMockLog = [];
  const ls = () => { try { return window.localStorage; } catch (e) { return null; } };
  const err = (code, message) => Object.assign(new Error(message), { code });
  const readJson = (k) => { try { const s = ls(); return JSON.parse((s && s.getItem(k)) || 'null'); } catch (e) { return null; } };
  const writeJson = (k, v) => { const s = ls(); if (s) s.setItem(k, JSON.stringify(v)); };
  const env = () => cfg().environment || (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'local' : 'crazygames');

  const cloud = {
    async load(id) {
      if (typeof window.__cgCloud === 'function') return JSON.parse((await window.__cgCloud('load', id, null)) || 'null');
      return readJson('__cgMockCloud:' + id);
    },
    save(id, data) {
      log.push(['cloud-save', id]);
      if (typeof window.__cgCloud === 'function') window.__cgCloud('save', id, JSON.stringify(data));
      else writeJson('__cgMockCloud:' + id, data);
    }
  };

  let user = null, data = {}, handler = 'none', ready = false;
  const listeners = [];
  const currentUser = () => (cfg().user !== undefined ? cfg().user : readJson('__cgMockUser'));

  function persist() {
    const json = JSON.stringify(data);
    if (new TextEncoder().encode(json).length > (cfg().limitBytes || 1048576)) {
      throw err('dataLimitExcedeed', 'Game data when converted to a JSON string cannot exceed 1048576 bytes. Data was not saved');
    }
    if (handler === 'local') writeJson(GUEST_KEY, { data, metadata: { date: new Date() } });
    else { cloud.save(user.id, data); writeJson(CACHE_KEY, { data, metadata: { date: new Date() } }); }
  }
  async function loadFor(u) {
    if (!u) { handler = 'local'; data = (readJson(GUEST_KEY) || {}).data || {}; return; }
    handler = 'cloud';
    const remote = await cloud.load(u.id);
    if (remote && Object.keys(remote).length) { data = remote; return; }
    const guest = readJson(GUEST_KEY);
    data = (guest && guest.data) || {};
    if (guest) cloud.save(u.id, data); // an account with no data takes over the guest's
  }

  const passthrough = () => cfg().mode === 'passthrough';
  const check = (op) => {
    if (!ready) throw err('sdkNotInitialized', 'init() first');
    if (env() === 'disabled') throw err('sdkDisabled', 'CrazySDK is disabled on this domain.');
    if (cfg().dataDisabled) throw err('dataModuleDisabled', 'The data module is disabled.');
    if (op === 'get' && cfg().failGet) throw err('other', 'mock read failure');
    if (op === 'set' && cfg().failSet) throw err('other', 'mock write failure');
  };
  const dataModule = {
    getItem(k) {
      check('get'); log.push(['getItem', k]);
      if (passthrough()) return ls().getItem(k);
      return Object.prototype.hasOwnProperty.call(data, k) ? (data[k] || null) : null;
    },
    setItem(k, v) {
      check('set'); log.push(['setItem', k]);
      if (passthrough()) { ls().setItem(k, String(v)); return; }
      data[k] = String(v);
      persist();
    },
    removeItem(k) {
      check('set'); log.push(['removeItem', k]);
      if ((cfg().failRemove || []).includes(k)) throw err('other', 'mock remove failure');
      if (passthrough()) { ls().removeItem(k); return; }
      delete data[k];
      persist();
    },
    clear() {
      check('set'); log.push(['clear']);
      if (passthrough()) { ls().clear(); return; }
      data = {};
      persist();
    }
  };

  const SDK = {
    async init() {
      const c = cfg();
      log.push(['init', env()]);
      if (c.initHangs) return new Promise(() => {});
      if (c.initDelayMs) await new Promise(res => setTimeout(res, c.initDelayMs));
      if (c.initFails) throw err('initFailed', 'The SDK failed to initialize');
      if (env() !== 'disabled' && !passthrough()) { user = currentUser(); await loadFor(user); }
      ready = true;
    },
    get environment() { return env(); },
    data: dataModule,
    user: {
      get isUserAccountAvailable() { return env() === 'crazygames'; },
      async getUser() { return user; },
      addAuthListener(fn) { listeners.push(fn); },
      removeAuthListener(fn) { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }
    },
    game: { gameplayStart() {}, gameplayStop() {}, happytime() {}, loadingStart() {}, loadingStop() {} },
    ad: { requestAd(type, cb) { setTimeout(() => cb && cb.adError && cb.adError({ code: 'unfilled' }), 0); }, hasAdblock: async () => false }
  };
  window.CrazyGames = { SDK };

  // Test hooks: a login while playing (the portal then reloads the game), a logout.
  window.__cgMockLogin = async (u, { order = 'listener-first' } = {}) => {
    writeJson('__cgMockUser', u);
    if (cfg().user !== undefined) cfg().user = u;
    const fire = () => listeners.forEach(fn => { try { fn(u); } catch (e) { console.error(e); } });
    if (order === 'listener-first') { fire(); user = u; await loadFor(u); }
    else { user = u; await loadFor(u); if (order !== 'switch-only') fire(); } // switch-only: no listener call at all
    log.push(['login', u.id, order]);
  };
  window.__cgMockLogout = () => { const s = ls(); if (s) s.removeItem('__cgMockUser'); if (cfg().user !== undefined) cfg().user = null; };
})();
