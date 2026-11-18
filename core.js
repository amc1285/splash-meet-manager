/* Splash Meet Manager — core logic (shared by the meet console and the live page).
 * MIT License. No server required: everything runs in the browser.
 * Times are stored as integer hundredths of a second. Diving scores are stored as score x 100.
 */
(function (root) {
  'use strict';

  // ---------- ids & helpers ----------
  function uid(prefix) {
    return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- time parsing / formatting ----------
  // Accepts "1:02.34", "62.34", "62.3", "10234" (digits only = m ss hh), "NT", "" -> null
  function parseTime(input) {
    if (input == null) return null;
    var s = String(input).trim().toUpperCase();
    if (!s || s === 'NT' || s === 'NS') return null;
    if (/^\d+$/.test(s)) {
      if (s.length <= 2) return parseInt(s, 10) * 100; // "45" = 45 seconds
      var hh = parseInt(s.slice(-2), 10);
      var rest = s.slice(0, -2);
      var ss = parseInt(rest.slice(-2), 10);
      var mm = rest.length > 2 ? parseInt(rest.slice(0, -2), 10) : 0;
      if (ss >= 60) return null;
      return mm * 6000 + ss * 100 + hh;
    }
    var m = s.match(/^(?:(\d+):)?(\d{1,2}|\d+)(?:\.(\d{1,2}))?$/);
    if (!m) return null;
    var min = m[1] ? parseInt(m[1], 10) : 0;
    var sec = parseInt(m[2], 10);
    if (m[1] && sec >= 60) return null;
    var frac = m[3] ? (m[3].length === 1 ? parseInt(m[3], 10) * 10 : parseInt(m[3], 10)) : 0;
    return min * 6000 + sec * 100 + frac;
  }
  function formatTime(h) {
    if (h == null || isNaN(h)) return 'NT';
    h = Math.round(h);
    var min = Math.floor(h / 6000);
    var sec = Math.floor((h % 6000) / 100);
    var hun = h % 100;
    var hs = (hun < 10 ? '0' : '') + hun;
    if (min > 0) return min + ':' + (sec < 10 ? '0' : '') + sec + '.' + hs;
    return sec + '.' + hs;
  }
  function parseScore(input) { // diving
    if (input == null) return null;
    var s = String(input).trim();
    if (!s || s.toUpperCase() === 'NT') return null;
    var n = parseFloat(s);
    return isNaN(n) ? null : Math.round(n * 100);
  }
  function formatScore(v) { return v == null ? '—' : (v / 100).toFixed(2); }
  function fmtMark(ev, v) { return ev && ev.diving ? formatScore(v) : formatTime(v); }
  function parseMark(ev, s) { return ev && ev.diving ? parseScore(s) : parseTime(s); }

  // ---------- events ----------
  var GENDER_LABEL = { F: 'Girls', M: 'Boys', X: 'Mixed' };
  var STROKES = ['Free', 'Back', 'Breast', 'Fly', 'IM', 'Medley Relay', 'Free Relay', 'Diving'];

  function eventName(ev) {
    var g = GENDER_LABEL[ev.gender] || '';
    if (ev.diving) return g + ' Diving';
    return g + ' ' + ev.distance + ' ' + (ev.stroke === 'IM' ? 'IM' : ev.stroke);
  }
  function makeEvent(gender, distance, stroke, extra) {
    var e = {
      id: uid('ev'), num: 0, gender: gender, distance: distance, stroke: stroke,
      relay: /Relay/.test(stroke), diving: stroke === 'Diving', breakAfter: false, done: false
    };
    if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; });
    return e;
  }
  // NFHS high-school order. genders: 'both' | 'F' | 'M' | 'X'
  var HS_ORDER = [
    [200, 'Medley Relay'], [200, 'Free'], [200, 'IM'], [50, 'Free'], [1, 'Diving'],
    [100, 'Fly'], [100, 'Free'], [500, 'Free'], [200, 'Free Relay'], [100, 'Back'],
    [100, 'Breast'], [400, 'Free Relay']
  ];
  function hsTemplate(genders, includeDiving) {
    var gs = genders === 'both' ? ['F', 'M'] : [genders];
    var out = [];
    HS_ORDER.forEach(function (row) {
      if (row[1] === 'Diving' && !includeDiving) return;
      gs.forEach(function (g, i) {
        var ev = makeEvent(g, row[0], row[1]);
        // breaks after the 50 free/diving block and after the 200 free relay (last gender of the pair)
        if (i === gs.length - 1) {
          if ((row[1] === 'Diving') || (row[1] === 'Free' && row[0] === 50 && !includeDiving)) ev.breakAfter = true;
          if (row[1] === 'Free Relay' && row[0] === 200) ev.breakAfter = true;
        }
        out.push(ev);
      });
    });
    renumber(out);
    return out;
  }
  function renumber(events) { events.forEach(function (e, i) { e.num = i + 1; }); return events; }

  // ---------- scoring presets ----------
  var SCORING_PRESETS = {
    dual: { label: 'Dual meet (6-4-3-2-1 / 8-4-2)', ind: [6, 4, 3, 2, 1], relay: [8, 4, 2] },
    dual5: { label: 'Dual meet 5-3-1 / 7-0', ind: [5, 3, 1], relay: [7] },
    inv6: { label: '6-lane invitational', ind: [7, 5, 4, 3, 2, 1], relay: [14, 10, 8, 6, 4, 2] },
    inv8: { label: '8-lane invitational', ind: [9, 7, 6, 5, 4, 3, 2, 1], relay: [18, 14, 12, 10, 8, 6, 4, 2] },
    champ16: { label: '16-place championship', ind: [20, 17, 16, 15, 14, 13, 12, 11, 9, 7, 6, 5, 4, 3, 2, 1], relay: [40, 34, 32, 30, 28, 26, 24, 22, 18, 14, 12, 10, 8, 6, 4, 2] },
    none: { label: 'No team scoring', ind: [], relay: [] }
  };

  function newMeet(opts) {
    opts = opts || {};
    var type = opts.type || 'dual';
    var preset = type === 'dual' ? 'dual' : (type === 'intrasquad' ? 'dual' : ((opts.lanes || 6) >= 8 ? 'inv8' : 'inv6'));
    return {
      id: uid('meet'), version: 1, updated: Date.now(),
      name: opts.name || 'New Meet', date: opts.date || new Date().toISOString().slice(0, 10),
      location: opts.location || '', course: opts.course || 'SCY', lanes: opts.lanes || 6,
      type: type, startTime: opts.startTime || '18:00',
      scoring: {
        preset: preset, ind: SCORING_PRESETS[preset].ind.slice(), relay: SCORING_PRESETS[preset].relay.slice(),
        maxScorersInd: 0, maxScorersRelay: 0, // 0 = no limit
        jv: 'separate' // 'separate' = JV scored on its own; 'exhibition' = JV never scores; 'combined' = JV competes with varsity
      },
      limits: { maxInd: 2, maxTotal: 4, maxPerTeam: 3 },
      timing: { heatInterval: 30, breakMinutes: 10, divingPerDiver: 270 },
      teams: [], swimmers: [], events: hsTemplate(opts.genders || 'both', opts.diving !== false), entries: [],
      current: { eventId: null, heat: 1 },
      publish: { lastPublished: null }
    };
  }

  // ---------- lookups ----------
  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function swimmerName(meet, id, short) {
    var s = byId(meet.swimmers, id);
    if (!s) return '?';
    return short ? (s.first.charAt(0) + '. ' + s.last) : (s.first + ' ' + s.last);
  }
  function teamOf(meet, id) { return byId(meet.teams, id) || { abbr: '—', name: 'Unattached', color: '#888' }; }
  function entryLabel(meet, en) {
    var ev = byId(meet.events, en.eventId);
    if (ev && ev.relay) {
      var t = teamOf(meet, en.teamId);
      return t.name + ' ' + (en.letter || 'A');
    }
    return swimmerName(meet, en.swimmerId);
  }
  function eventEntries(meet, evId) { return meet.entries.filter(function (e) { return e.eventId === evId; }); }

  // swimmer event counts: {ind, relay, total}
  function swimmerCounts(meet, swId) {
    var ind = 0, rel = 0;
    meet.entries.forEach(function (en) {
      if (en.status === 'SCR') return;
      var ev = byId(meet.events, en.eventId);
      if (!ev) return;
      if (ev.relay) { if ((en.legs || []).indexOf(swId) >= 0) rel++; }
      else if (en.swimmerId === swId && !ev.diving) ind++;
      else if (en.swimmerId === swId && ev.diving) ind++;
    });
    return { ind: ind, relay: rel, total: ind + rel };
  }
  function entryWarnings(meet) {
    var w = [];
    var L = meet.limits || {};
    meet.swimmers.forEach(function (s) {
      var c = swimmerCounts(meet, s.id);
      if (L.maxInd && c.ind > L.maxInd) w.push(s.first + ' ' + s.last + ': ' + c.ind + ' individual events (limit ' + L.maxInd + ')');
      if (L.maxTotal && c.total > L.maxTotal) w.push(s.first + ' ' + s.last + ': ' + c.total + ' total events (limit ' + L.maxTotal + ')');
    });
    // back-to-back: swimmer in consecutive events of same gender without a break
    return w;
  }

  // ---------- seeding ----------
  function laneOrder(lanes) { // center-out: 6 -> [3,4,2,5,1,6], 8 -> [4,5,3,6,2,7,1,8]
    var c = Math.ceil(lanes / 2), out = [c];
    for (var d = 1; out.length < lanes; d++) {
      if (c + d <= lanes) out.push(c + d);
      if (c - d >= 1 && out.length < lanes) out.push(c - d);
    }
    return out;
  }
  function compareSeed(ev) {
    return function (a, b) {
      var A = a.seed, B = b.seed;
      if (A == null && B == null) return (a.exhibition ? 1 : 0) - (b.exhibition ? 1 : 0);
      if (A == null) return 1;
      if (B == null) return -1;
      return ev.diving ? B - A : A - B;
    };
  }
  // Seeds one event: fastest heat swims last, fastest swimmers in center lanes,
  // first heat gets at least 3 swimmers when possible.
  function seedEvent(meet, ev) {
    var list = eventEntries(meet, ev.id).filter(function (e) { return e.status !== 'SCR'; });
    meet.entries.forEach(function (e) { if (e.eventId === ev.id && e.status === 'SCR') { e.heat = null; e.lane = null; } });
    list.sort(compareSeed(ev));
    if (ev.diving) {
      // dive order: reverse seed (highest seed dives last)
      list.slice().reverse().forEach(function (e, i) { e.heat = 1; e.lane = i + 1; });
      return 1;
    }
    var lanes = meet.lanes, n = list.length;
    if (!n) return 0;
    var heats = Math.ceil(n / lanes);
    var sizes = [];
    for (var h = 0; h < heats; h++) sizes.push(lanes);
    var extra = heats * lanes - n; // empty lanes, taken from the slowest heat(s)
    sizes[0] -= extra;
    if (heats >= 2 && sizes[0] < 3) { var need = 3 - sizes[0]; sizes[0] += need; sizes[1] -= need; }
    var order = laneOrder(lanes);
    var idx = 0;
    for (var hh = heats - 1; hh >= 0; hh--) { // fastest first into the last heat
      var group = list.slice(idx, idx + sizes[hh]);
      idx += sizes[hh];
      group.forEach(function (e, i) { e.heat = hh + 1; e.lane = order[i]; });
    }
    return heats;
  }
  function seedAll(meet) { meet.events.forEach(function (ev) { seedEvent(meet, ev); }); }
  function heatsOf(meet, ev) {
    var map = {};
    eventEntries(meet, ev.id).forEach(function (e) {
      if (e.heat == null || e.status === 'SCR') return;
      (map[e.heat] = map[e.heat] || []).push(e);
    });
    return Object.keys(map).map(Number).sort(function (a, b) { return a - b; }).map(function (h) {
      return { heat: h, entries: map[h].sort(function (a, b) { return a.lane - b.lane; }) };
    });
  }

  // ---------- results & scoring ----------
  function divisionKey(meet, en) {
    var mode = meet.scoring.jv;
    if (mode === 'combined') return 'V';
    return en.division === 'JV' ? 'JV' : 'V';
  }
  // Returns { V: [rows], JV: [rows] } where rows = {entry, place, points, mark}
  function eventResults(meet, ev) {
    var all = eventEntries(meet, ev.id).filter(function (e) { return e.status !== 'SCR'; });
    var out = { V: [], JV: [] };
    ['V', 'JV'].forEach(function (div) {
      var rows = all.filter(function (e) { return divisionKey(meet, e) === div; });
      var finished = rows.filter(function (e) { return e.result != null && !e.status; });
      finished.sort(function (a, b) { return ev.diving ? b.result - a.result : a.result - b.result; });
      var others = rows.filter(function (e) { return !(e.result != null && !e.status); });
      var scale = ev.relay ? meet.scoring.relay : meet.scoring.ind;
      var maxS = ev.relay ? meet.scoring.maxScorersRelay : meet.scoring.maxScorersInd;
      var noScore = div === 'JV' && meet.scoring.jv === 'exhibition';
      // places (exhibition swimmers do not take a place)
      var placed = finished.filter(function (e) { return !e.exhibition; });
      var res = [];
      var place = 0, i = 0;
      while (i < placed.length) {
        var j = i;
        while (j + 1 < placed.length && placed[j + 1].result === placed[i].result) j++;
        place = i + 1;
        for (var k = i; k <= j; k++) res.push({ entry: placed[k], place: place, points: 0, mark: placed[k].result });
        i = j + 1;
      }
      // scoring places skip teams over their scorer limit; ties split the points
      var teamCount = {}, sp = 0, r = 0;
      while (r < res.length && !noScore) {
        var tieEnd = r;
        while (tieEnd + 1 < res.length && res[tieEnd + 1].place === res[r].place) tieEnd++;
        var eligible = [];
        for (var q = r; q <= tieEnd; q++) {
          var t = res[q].entry.teamId;
          if (!maxS || (teamCount[t] || 0) < maxS) { eligible.push(res[q]); }
        }
        if (eligible.length) {
          var pts = 0;
          for (var p = 0; p < eligible.length; p++) pts += (scale[sp + p] || 0);
          var share = pts / eligible.length;
          eligible.forEach(function (row) { row.points = Math.round(share * 100) / 100; teamCount[row.entry.teamId] = (teamCount[row.entry.teamId] || 0) + 1; });
          sp += eligible.length;
        }
        r = tieEnd + 1;
      }
      finished.filter(function (e) { return e.exhibition; }).forEach(function (e) { res.push({ entry: e, place: null, points: 0, mark: e.result, exh: true }); });
      others.forEach(function (e) { res.push({ entry: e, place: null, points: 0, mark: null, status: e.status || (e.result == null ? '' : '') }); });
      out[div] = res;
    });
    return out;
  }
  // Team totals: { overall: {teamId: pts}, F: {...}, M: {...}, X: {...}, V: {...}, JV: {...} }
  function teamScores(meet) {
    var s = { overall: {}, F: {}, M: {}, X: {}, V: {}, JV: {} };
    meet.teams.forEach(function (t) { Object.keys(s).forEach(function (k) { s[k][t.id] = 0; }); });
    meet.events.forEach(function (ev) {
      var r = eventResults(meet, ev);
      ['V', 'JV'].forEach(function (div) {
        r[div].forEach(function (row) {
          if (!row.points) return;
          var t = row.entry.teamId;
          if (s.overall[t] == null) return;
          s.overall[t] += row.points; s[ev.gender][t] += row.points; s[div][t] += row.points;
        });
      });
    });
    Object.keys(s).forEach(function (k) { Object.keys(s[k]).forEach(function (t) { s[k][t] = Math.round(s[k][t] * 100) / 100; }); });
    return s;
  }
  function eventComplete(meet, ev) {
    var list = eventEntries(meet, ev.id).filter(function (e) { return e.status !== 'SCR'; });
    return list.length > 0 && list.every(function (e) { return e.result != null || e.status; });
  }

  // ---------- timeline ----------
  var DEFAULT_SWIM = { 50: 3500, 100: 7500, 200: 15000, 400: 30000, 500: 37500, 1000: 78000, 1650: 130000 };
  function estHeatSeconds(ev, heatEntries) {
    var seeds = heatEntries.map(function (e) { return e.seed; }).filter(function (x) { return x != null; });
    var slow = seeds.length ? Math.max.apply(null, seeds) : (DEFAULT_SWIM[ev.distance] || ev.distance * 75);
    if (!seeds.length && ev.relay) slow = (DEFAULT_SWIM[ev.distance / 4] || 7000) * 4 * 0.85;
    return slow / 100;
  }
  function timeline(meet) {
    var parts = (meet.startTime || '18:00').split(':');
    var t = (parseInt(parts[0], 10) || 0) * 3600 + (parseInt(parts[1], 10) || 0) * 60;
    var rows = [];
    meet.events.forEach(function (ev) {
      var heats = heatsOf(meet, ev);
      var start = t;
      if (ev.diving) {
        var n = eventEntries(meet, ev.id).filter(function (e) { return e.status !== 'SCR'; }).length;
        t += n * (meet.timing.divingPerDiver || 270);
      } else {
        heats.forEach(function (h) { t += estHeatSeconds(ev, h.entries) + (meet.timing.heatInterval || 30); });
      }
      rows.push({ event: ev, start: start, heats: ev.diving ? 1 : heats.length });
      if (ev.breakAfter) { rows.push({ brk: true, start: t, minutes: meet.timing.breakMinutes || 10 }); t += (meet.timing.breakMinutes || 10) * 60; }
    });
    rows.end = t;
    return rows;
  }
  function clockStr(sec) {
    sec = Math.round(sec);
    var h = Math.floor(sec / 3600) % 24, m = Math.floor((sec % 3600) / 60);
    var ap = h >= 12 ? 'PM' : 'AM', h12 = h % 12 || 12;
    return h12 + ':' + (m < 10 ? '0' : '') + m + ' ' + ap;
  }

  // ---------- CSV ----------
  function parseCSV(text) {
    var rows = [], row = [], cur = '', q = false;
    text = String(text || '').replace(/\r\n?/g, '\n');
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',' || c === '\t') { row.push(cur.trim()); cur = ''; }
      else if (c === '\n') { row.push(cur.trim()); rows.push(row); row = []; cur = ''; }
      else cur += c;
    }
    if (cur.length || row.length) { row.push(cur.trim()); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return x !== ''; }); });
  }
  function normGender(g) {
    g = String(g || '').trim().toUpperCase();
    if (g === 'F' || g === 'W' || g === 'G' || g.indexOf('GIRL') === 0 || g.indexOf('FEM') === 0 || g.indexOf('WOM') === 0) return 'F';
    if (g === 'M' || g === 'B' || g.indexOf('BOY') === 0 || g.indexOf('MAL') === 0 || g.indexOf('MEN') === 0) return 'M';
    return '';
  }
  // Roster CSV: first,last,gender,grade,team,division  (header optional; team = abbr or name)
  function importRoster(meet, text) {
    var rows = parseCSV(text), added = 0, errors = [];
    if (rows.length && /first/i.test(rows[0][0] || '')) rows.shift();
    rows.forEach(function (r, i) {
      var first = r[0], last = r[1], g = normGender(r[2]);
      if (!first || !last || !g) { errors.push('Row ' + (i + 1) + ': need first, last, gender'); return; }
      var team = findOrCreateTeam(meet, r[4] || 'UNA');
      var exists = meet.swimmers.some(function (s) { return s.first.toLowerCase() === first.toLowerCase() && s.last.toLowerCase() === last.toLowerCase() && s.teamId === team.id; });
      if (exists) return;
      meet.swimmers.push({ id: uid('sw'), first: first, last: last, gender: g, grade: r[3] || '', teamId: team.id, division: /^jv/i.test(r[5] || '') ? 'JV' : 'V' });
      added++;
    });
    return { added: added, errors: errors };
  }
  var PALETTE = ['#0e7490', '#b91c1c', '#7c3aed', '#15803d', '#c2410c', '#1d4ed8', '#be185d', '#4d7c0f', '#a16207', '#334155'];
  function findOrCreateTeam(meet, key) {
    key = String(key).trim();
    var t = meet.teams.filter(function (x) { return x.abbr.toLowerCase() === key.toLowerCase() || x.name.toLowerCase() === key.toLowerCase(); })[0];
    if (t) return t;
    t = { id: uid('tm'), name: key, abbr: key.slice(0, 6).toUpperCase(), color: PALETTE[meet.teams.length % PALETTE.length] };
    meet.teams.push(t);
    return t;
  }

  // ---------- public snapshot for the live page ----------
  function snapshot(meet) {
    var m = clone(meet);
    delete m.publish;
    m.published = Date.now();
    return m;
  }

  var api = {
    uid: uid, clone: clone, esc: esc, parseTime: parseTime, formatTime: formatTime, parseScore: parseScore,
    formatScore: formatScore, fmtMark: fmtMark, parseMark: parseMark, GENDER_LABEL: GENDER_LABEL, STROKES: STROKES,
    eventName: eventName, makeEvent: makeEvent, hsTemplate: hsTemplate, renumber: renumber, SCORING_PRESETS: SCORING_PRESETS,
    newMeet: newMeet, byId: byId, swimmerName: swimmerName, teamOf: teamOf, entryLabel: entryLabel, eventEntries: eventEntries,
    swimmerCounts: swimmerCounts, entryWarnings: entryWarnings, laneOrder: laneOrder, seedEvent: seedEvent, seedAll: seedAll,
    heatsOf: heatsOf, eventResults: eventResults, teamScores: teamScores, eventComplete: eventComplete, timeline: timeline,
    clockStr: clockStr, parseCSV: parseCSV, importRoster: importRoster, findOrCreateTeam: findOrCreateTeam, normGender: normGender,
    PALETTE: PALETTE, snapshot: snapshot
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Splash = api;
})(this);
