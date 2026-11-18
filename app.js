/* Splash Meet Manager — meet console. MIT License. */
(function () {
  'use strict';
  var S = window.Splash, esc = S.esc, byId = S.byId;
  var KEY_INDEX = 'splash:index', KEY_MEET = 'splash:meet:', KEY_GH = 'splash:github';
  var VIEWS = [['meet', 'Meet'], ['roster', 'Roster'], ['entries', 'Entries'], ['seeding', 'Heats'], ['run', 'Run'], ['results', 'Results'], ['reports', 'Reports'], ['live', 'Live']];
  var state = { meet: null, view: 'home', ui: { team: null, gender: 'F', eventId: null, heat: 1, rosterTeam: '', rosterGender: '' } };
  var bc = ('BroadcastChannel' in window) ? new BroadcastChannel('splash-live') : null;
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var view = $('#view');

  // ---------- storage ----------
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { toast('Could not save in this browser: ' + e.message, true); return false; } }
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function indexList() { return load(KEY_INDEX, []); }
  var saveTimer = null;
  function save(now) {
    var m = state.meet; if (!m) return;
    m.updated = Date.now();
    clearTimeout(saveTimer);
    var doit = function () {
      if (!store(KEY_MEET + m.id, m)) return;
      var idx = indexList().filter(function (x) { return x.id !== m.id; });
      idx.unshift({ id: m.id, name: m.name, date: m.date, updated: m.updated });
      store(KEY_INDEX, idx);
      if (bc) bc.postMessage({ type: 'meet', id: m.id });
      $('#saved').textContent = 'Saved ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    };
    if (now) doit(); else saveTimer = setTimeout(doit, 250);
  }
  function openMeet(id) {
    var m = load(KEY_MEET + id, null);
    if (!m) { toast('Meet not found', true); return; }
    state.meet = m;
    state.ui.eventId = (m.current && m.current.eventId) || (m.events[0] && m.events[0].id);
    state.ui.heat = (m.current && m.current.heat) || 1;
    state.ui.team = m.teams[0] ? m.teams[0].id : null;
    go('meet');
  }
  function go(v) {
    var h = v === 'home' ? '' : '#' + v + (state.meet ? '/' + state.meet.id : '');
    if (location.hash === h || (!h && !location.hash)) route(); else location.hash = h;
  }
  window.addEventListener('hashchange', route);
  function route() {
    var h = location.hash.replace('#', '').split('/');
    if (h[1] && (!state.meet || state.meet.id !== h[1])) {
      var m = load(KEY_MEET + h[1], null);
      if (m) { state.meet = m; state.ui.eventId = (m.current && m.current.eventId) || (m.events[0] && m.events[0].id); state.ui.team = m.teams[0] ? m.teams[0].id : null; }
    }
    state.view = (h[0] && state.meet) ? h[0] : 'home';
    render();
  }

  // ---------- toast / modal ----------
  function toast(msg, bad) {
    var t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : '');
    clearTimeout(t._t); t._t = setTimeout(function () { t.className = 'toast'; }, 2600);
  }
  function download(name, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }

  // ---------- render ----------
  function render() {
    var m = state.meet;
    $('#meetTitle').textContent = m && state.view !== 'home' ? m.name : '';
    var nav = $('#nav');
    nav.innerHTML = (m && state.view !== 'home') ? VIEWS.map(function (v) {
      return '<a href="#' + v[0] + '/' + m.id + '" class="' + (state.view === v[0] ? 'on' : '') + '">' + v[1] + '</a>';
    }).join('') : '';
    nav.hidden = !(m && state.view !== 'home');
    var fn = { home: vHome, meet: vMeet, roster: vRoster, entries: vEntries, seeding: vSeeding, run: vRun, results: vResults, reports: vReports, live: vLive }[state.view] || vHome;
    view.innerHTML = fn(m);
    if (state.view === 'run') startClockLoop();
    var on = nav.querySelector('.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // ---------- HOME ----------
  function vHome() {
    var idx = indexList();
    return '<section class="hero"><div><h1>Run your meet from any browser.</h1><p>Entries, heats, timing, scoring, printouts and a live scoreboard — free, open source, no install.</p></div></section>' +
      '<div class="grid2">' +
      '<section class="card"><h2>Start a meet</h2><form id="newMeet" class="form">' +
      '<label>Meet name<input name="name" required placeholder="Home vs. Visitors Dual"></label>' +
      '<div class="row"><label>Date<input type="date" name="date" value="' + new Date().toISOString().slice(0, 10) + '"></label>' +
      '<label>Start time<input type="time" name="startTime" value="18:00"></label></div>' +
      '<label>Location<input name="location" placeholder="Natatorium"></label>' +
      '<div class="row"><label>Meet type<select name="type"><option value="dual">Dual meet</option><option value="invitational">Invitational (timed finals)</option><option value="intrasquad">Intrasquad</option></select></label>' +
      '<label>Lanes<select name="lanes">' + [4, 5, 6, 8, 10].map(function (n) { return '<option' + (n === 6 ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label>' +
      '<label>Course<select name="course"><option>SCY</option><option>SCM</option><option>LCM</option></select></label></div>' +
      '<div class="row"><label>Events<select name="genders"><option value="both">Girls &amp; Boys (alternating)</option><option value="F">Girls only</option><option value="M">Boys only</option><option value="X">Mixed</option></select></label>' +
      '<label class="check"><input type="checkbox" name="diving" checked> Include diving</label></div>' +
      '<button class="btn primary">Create meet</button></form></section>' +
      '<section class="card"><h2>Your meets</h2>' +
      (idx.length ? '<ul class="meetlist">' + idx.map(function (x) {
        return '<li><button class="link" data-act="open" data-id="' + x.id + '"><strong>' + esc(x.name) + '</strong><span>' + esc(x.date || '') + '</span></button>' +
          '<button class="btn ghost sm" data-act="delMeet" data-id="' + x.id + '" title="Delete">Delete</button></li>';
      }).join('') + '</ul>' : '<p class="muted">No meets yet. Create one, or try the demo.</p>') +
      '<div class="btnrow"><button class="btn" data-act="demo">Load demo meet</button>' +
      '<label class="btn">Restore backup<input type="file" accept=".json,application/json" id="restoreFile" hidden></label></div>' +
      '<p class="muted small">Meets are saved in this browser. Download a backup from the Meet tab to move a meet to another computer.</p></section></div>';
  }

  // ---------- MEET SETUP ----------
  function vMeet(m) {
    var sc = m.scoring;
    return '<div class="grid2">' +
      '<section class="card"><h2>Meet details</h2><div class="form">' +
      field('Meet name', 'name', m.name) +
      '<div class="row">' + field('Date', 'date', m.date, 'date') + field('Start time', 'startTime', m.startTime, 'time') + '</div>' +
      field('Location', 'location', m.location) +
      '<div class="row"><label>Meet type<select data-f="type">' + opt([['dual', 'Dual meet'], ['invitational', 'Invitational'], ['intrasquad', 'Intrasquad']], m.type) + '</select></label>' +
      '<label>Lanes<input type="number" min="2" max="10" data-f="lanes" value="' + m.lanes + '"></label>' +
      '<label>Course<select data-f="course">' + opt(['SCY', 'SCM', 'LCM'], m.course) + '</select></label></div>' +
      '</div></section>' +
      '<section class="card"><h2>Scoring &amp; rules</h2><div class="form">' +
      '<label>Scoring preset<select data-act="preset">' + Object.keys(S.SCORING_PRESETS).map(function (k) { return '<option value="' + k + '"' + (sc.preset === k ? ' selected' : '') + '>' + S.SCORING_PRESETS[k].label + '</option>'; }).join('') + '<option value="custom"' + (sc.preset === 'custom' ? ' selected' : '') + '>Custom</option></select></label>' +
      '<div class="row"><label>Individual points<input data-sc="ind" value="' + sc.ind.join('-') + '"></label><label>Relay points<input data-sc="relay" value="' + sc.relay.join('-') + '"></label></div>' +
      '<div class="row"><label>Max scorers / team (indiv.)<input type="number" min="0" data-sc="maxScorersInd" value="' + sc.maxScorersInd + '"></label><label>Max scoring relays / team<input type="number" min="0" data-sc="maxScorersRelay" value="' + sc.maxScorersRelay + '"></label></div>' +
      '<label>JV swimmers<select data-sc="jv">' + opt([['separate', 'Scored separately (JV results)'], ['exhibition', 'Exhibition — never score'], ['combined', 'Compete with varsity']], sc.jv) + '</select></label>' +
      '<div class="row"><label>Max individual events / swimmer<input type="number" min="0" data-lim="maxInd" value="' + m.limits.maxInd + '"></label><label>Max total events<input type="number" min="0" data-lim="maxTotal" value="' + m.limits.maxTotal + '"></label><label>Max entries / team / event<input type="number" min="0" data-lim="maxPerTeam" value="' + m.limits.maxPerTeam + '"></label></div>' +
      '<p class="muted small">0 = no limit. Points list uses dashes, e.g. 6-4-3-2-1.</p>' +
      '<div class="row"><label>Seconds between heats<input type="number" min="0" data-tm="heatInterval" value="' + m.timing.heatInterval + '"></label><label>Break length (min)<input type="number" min="0" data-tm="breakMinutes" value="' + m.timing.breakMinutes + '"></label><label>Seconds per diver<input type="number" min="0" data-tm="divingPerDiver" value="' + m.timing.divingPerDiver + '"></label></div>' +
      '</div></section></div>' +
      '<section class="card"><div class="cardhead"><h2>Events</h2><div class="btnrow">' +
      '<button class="btn sm" data-act="addEvent">Add event</button><button class="btn sm ghost" data-act="hsTemplate">Reset to HS template</button></div></div>' +
      '<div class="tablewrap"><table class="tbl events"><thead><tr><th>#</th><th>Gender</th><th>Distance</th><th>Stroke</th><th title="Break after this event">Break</th><th>Entries</th><th></th></tr></thead><tbody>' +
      m.events.map(function (ev, i) {
        var n = S.eventEntries(m, ev.id).length;
        return '<tr data-ev="' + ev.id + '"><td>' + ev.num + '</td>' +
          '<td><select data-evf="gender">' + opt([['F', 'Girls'], ['M', 'Boys'], ['X', 'Mixed']], ev.gender) + '</select></td>' +
          '<td>' + (ev.diving ? '<span class="muted">1 m</span>' : '<input type="number" class="num" data-evf="distance" value="' + ev.distance + '">') + '</td>' +
          '<td><select data-evf="stroke">' + opt(S.STROKES, ev.stroke) + '</select></td>' +
          '<td><input type="checkbox" data-evf="breakAfter"' + (ev.breakAfter ? ' checked' : '') + '></td><td>' + n + '</td>' +
          '<td class="nowrap"><button class="icon" data-act="evUp" title="Move up"' + (i ? '' : ' disabled') + '>▲</button><button class="icon" data-act="evDown" title="Move down"' + (i < m.events.length - 1 ? '' : ' disabled') + '>▼</button><button class="icon danger" data-act="evDel" title="Delete">✕</button></td></tr>';
      }).join('') + '</tbody></table></div></section>' +
      '<section class="card"><h2>Backup</h2><div class="btnrow"><button class="btn" data-act="backup">Download backup (.json)</button><button class="btn ghost" data-act="dupMeet">Duplicate meet</button></div>' +
      '<p class="muted small">Your meet lives in this browser. Download a backup before and after the meet, and use it to move the meet to another computer.</p></section>';
  }
  function field(label, f, val, type) { return '<label>' + label + '<input' + (type ? ' type="' + type + '"' : '') + ' data-f="' + f + '" value="' + esc(val) + '"></label>'; }
  function opt(list, cur) {
    return list.map(function (o) { var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; return '<option value="' + esc(v) + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('');
  }

  // ---------- ROSTER ----------
  function vRoster(m) {
    var ft = state.ui.rosterTeam, fg = state.ui.rosterGender;
    var list = m.swimmers.filter(function (s) { return (!ft || s.teamId === ft) && (!fg || s.gender === fg); })
      .sort(function (a, b) { return a.last.localeCompare(b.last) || a.first.localeCompare(b.first); });
    return '<div class="grid2">' +
      '<section class="card"><h2>Teams</h2>' +
      (m.teams.length ? '<ul class="teams">' + m.teams.map(function (t) {
        var n = m.swimmers.filter(function (s) { return s.teamId === t.id; }).length;
        return '<li data-tm="' + t.id + '"><input type="color" data-tf="color" value="' + t.color + '" aria-label="Team color"><input data-tf="name" value="' + esc(t.name) + '" aria-label="Team name"><input data-tf="abbr" class="abbr" value="' + esc(t.abbr) + '" aria-label="Abbreviation"><span class="muted small">' + n + '</span><button class="icon danger" data-act="delTeam" title="Delete team">✕</button></li>';
      }).join('') + '</ul>' : '<p class="muted">Add the teams swimming in this meet.</p>') +
      '<form id="addTeam" class="inline"><input name="name" placeholder="Team name" required><input name="abbr" placeholder="ABBR" class="abbr" maxlength="6"><button class="btn sm primary">Add team</button></form></section>' +
      '<section class="card"><h2>Import roster</h2><p class="muted small">Paste from a spreadsheet: <code>first, last, gender, grade, team, division</code>. Team can be a name or abbreviation (new teams are created). Division is V or JV.</p>' +
      '<textarea id="rosterCsv" rows="5" placeholder="Ava,Brooks,F,11,RIV,V&#10;Leo,Chen,M,9,LAK,JV"></textarea>' +
      '<div class="btnrow"><button class="btn" data-act="importRoster">Import</button><label class="btn ghost">Choose CSV file<input type="file" accept=".csv,.txt" id="rosterFile" hidden></label></div></section></div>' +
      '<section class="card"><div class="cardhead"><h2>Swimmers <span class="muted">(' + list.length + ')</span></h2><div class="row compact">' +
      '<select data-act="rosterTeam"><option value="">All teams</option>' + opt(m.teams.map(function (t) { return [t.id, t.name]; }), ft) + '</select>' +
      '<select data-act="rosterGender"><option value="">All</option>' + opt([['F', 'Girls'], ['M', 'Boys']], fg) + '</select></div></div>' +
      (m.teams.length ? '<form id="addSwimmer" class="inline wrap"><input name="first" placeholder="First" required><input name="last" placeholder="Last" required>' +
        '<select name="gender">' + opt([['F', 'Girl'], ['M', 'Boy']], fg || 'F') + '</select><input name="grade" placeholder="Gr" class="abbr">' +
        '<select name="team">' + opt(m.teams.map(function (t) { return [t.id, t.abbr]; }), ft || (m.teams[0] && m.teams[0].id)) + '</select>' +
        '<select name="division">' + opt([['V', 'Varsity'], ['JV', 'JV']], 'V') + '</select><button class="btn sm primary">Add</button></form>' : '') +
      '<div class="tablewrap"><table class="tbl"><thead><tr><th>Name</th><th>G</th><th>Gr</th><th>Team</th><th>Div</th><th>Events</th><th></th></tr></thead><tbody>' +
      list.map(function (s) {
        var c = S.swimmerCounts(m, s.id);
        return '<tr data-sw="' + s.id + '"><td><input data-sf="first" value="' + esc(s.first) + '" class="nm"> <input data-sf="last" value="' + esc(s.last) + '" class="nm"></td>' +
          '<td><select data-sf="gender">' + opt([['F', 'F'], ['M', 'M']], s.gender) + '</select></td><td><input data-sf="grade" class="abbr" value="' + esc(s.grade) + '"></td>' +
          '<td><select data-sf="teamId">' + opt(m.teams.map(function (t) { return [t.id, t.abbr]; }), s.teamId) + '</select></td>' +
          '<td><select data-sf="division">' + opt([['V', 'V'], ['JV', 'JV']], s.division) + '</select></td>' +
          '<td>' + c.ind + ' / ' + c.total + '</td><td><button class="icon danger" data-act="delSwimmer" title="Remove">✕</button></td></tr>';
      }).join('') + '</tbody></table></div></section>';
  }

  // ---------- ENTRIES ----------
  function vEntries(m) {
    if (!m.teams.length) return '<section class="card"><p>Add teams and swimmers on the <a href="#roster/' + m.id + '">Roster</a> tab first.</p></section>';
    var team = state.ui.team && byId(m.teams, state.ui.team) ? state.ui.team : m.teams[0].id; state.ui.team = team;
    var g = state.ui.gender;
    var genders = uniq(m.events.map(function (e) { return e.gender; }));
    if (genders.indexOf(g) < 0) { g = genders[0]; state.ui.gender = g; }
    var evs = m.events.filter(function (e) { return e.gender === g && !e.relay; });
    var rels = m.events.filter(function (e) { return e.gender === g && e.relay; });
    var sw = m.swimmers.filter(function (s) { return s.teamId === team && (g === 'X' || s.gender === g); }).sort(function (a, b) { return a.last.localeCompare(b.last); });
    var names = sw.map(function (s) { return s.first + ' ' + s.last + ':'; });
    var warns = S.entryWarnings(m).filter(function (w) { return names.some(function (n) { return w.indexOf(n) === 0; }); });
    var head = '<section class="card"><div class="cardhead"><h2>Entries</h2><div class="row compact">' +
      '<select data-act="entTeam">' + opt(m.teams.map(function (t) { return [t.id, t.name]; }), team) + '</select>' +
      '<select data-act="entGender">' + opt(genders.map(function (x) { return [x, S.GENDER_LABEL[x]]; }), g) + '</select></div></div>' +
      '<p class="muted small">Type a seed time in a cell to enter the swimmer (e.g. <code>1:05.32</code> or <code>10532</code>), <code>NT</code> for no time, prefix <code>x</code> for exhibition (<code>x28.40</code>). Clear the cell to remove the entry. Diving cells take a seed score.</p>' +
      (warns.length ? '<div class="warn"><strong>Check limits:</strong><ul>' + warns.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></div>' : '') + '</section>';
    var grid = '<section class="card"><h3>Individual events</h3>' + (sw.length ? '<div class="tablewrap grid"><table class="tbl lineup"><thead><tr><th class="sticky">Swimmer</th>' +
      evs.map(function (e) { return '<th title="' + esc(S.eventName(e)) + '">#' + e.num + '<br><span>' + (e.diving ? 'Dive' : e.distance + ' ' + abbrStroke(e.stroke)) + '</span></th>'; }).join('') + '<th>Ind/Tot</th></tr></thead><tbody>' +
      sw.map(function (s) {
        var c = S.swimmerCounts(m, s.id), over = (m.limits.maxInd && c.ind > m.limits.maxInd) || (m.limits.maxTotal && c.total > m.limits.maxTotal);
        return '<tr><th class="sticky">' + esc(s.last + ', ' + s.first) + (s.division === 'JV' ? ' <span class="tag">JV</span>' : '') + '</th>' +
          evs.map(function (e) {
            var en = m.entries.filter(function (x) { return x.eventId === e.id && x.swimmerId === s.id; })[0];
            var v = en ? ((en.exhibition ? 'x' : '') + (en.seed == null ? 'NT' : S.fmtMark(e, en.seed))) : '';
            return '<td><input class="cell' + (en ? ' has' : '') + '" data-cell="' + e.id + '|' + s.id + '" value="' + esc(v) + '" inputmode="decimal" aria-label="' + esc(s.first + ' ' + s.last + ' ' + S.eventName(e)) + '"></td>';
          }).join('') + '<td class="' + (over ? 'bad' : '') + '" data-count="' + s.id + '">' + c.ind + '/' + c.total + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="muted">No ' + S.GENDER_LABEL[g].toLowerCase() + ' on this team yet.</p>') + '</section>';
    var relays = '<section class="card"><h3>Relays</h3>' + rels.map(function (e) {
      var list = m.entries.filter(function (x) { return x.eventId === e.id && x.teamId === team; }).sort(function (a, b) { return (a.letter || '').localeCompare(b.letter || ''); });
      return '<div class="relay"><div class="cardhead"><h4>#' + e.num + ' ' + esc(S.eventName(e)) + '</h4><button class="btn sm" data-act="addRelay" data-ev="' + e.id + '">Add relay</button></div>' +
        list.map(function (en) {
          return '<div class="relayrow" data-en="' + en.id + '"><input class="abbr" data-rf="letter" value="' + esc(en.letter) + '" aria-label="Relay letter">' +
            '<input class="time" data-rf="seed" value="' + (en.seed == null ? 'NT' : S.formatTime(en.seed)) + '" aria-label="Seed time">' +
            [0, 1, 2, 3].map(function (i) {
              return '<select data-leg="' + i + '" aria-label="Leg ' + (i + 1) + '"><option value="">Leg ' + (i + 1) + '…</option>' + opt(sw.map(function (s) { return [s.id, s.last + ', ' + s.first]; }), (en.legs || [])[i]) + '</select>';
            }).join('') +
            '<select data-rf="division">' + opt([['V', 'V'], ['JV', 'JV']], en.division || 'V') + '</select>' +
            '<label class="check sm"><input type="checkbox" data-rf="exhibition"' + (en.exhibition ? ' checked' : '') + '> Exh</label>' +
            '<button class="icon danger" data-act="delEntry" title="Remove relay">✕</button></div>';
        }).join('') + '</div>';
    }).join('') + (rels.length ? '' : '<p class="muted">No relay events for this group.</p>') + '</section>';
    var imp = '<section class="card"><h3>Import entries</h3><p class="muted small">Paste <code>event #, first, last, team, seed</code> — one swimmer per line. Swimmers not on the roster are added.</p>' +
      '<textarea id="entryCsv" rows="4" placeholder="3,Ava,Brooks,RIV,2:15.40"></textarea><div class="btnrow"><button class="btn" data-act="importEntries">Import entries</button></div></section>';
    return head + grid + relays + imp;
  }
  function abbrStroke(s) { return { Free: 'FR', Back: 'BK', Breast: 'BR', Fly: 'FL', IM: 'IM', 'Medley Relay': 'MR', 'Free Relay': 'FRR', Diving: 'DV' }[s] || s; }
  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }

  // ---------- SEEDING / HEAT SHEET ----------
  function vSeeding(m) {
    return '<section class="card"><div class="cardhead"><h2>Heats &amp; lanes</h2><div class="btnrow"><button class="btn primary" data-act="seedAll">Seed all events</button><button class="btn ghost" data-act="report" data-r="heat">Print heat sheet</button></div></div>' +
      '<p class="muted small">Fastest heat swims last, fastest swimmers in the center lanes, and the first heat gets at least 3 swimmers. Re-seeding keeps results already entered. You can edit any heat or lane by hand.</p></section>' +
      m.events.map(function (ev) {
        var heats = S.heatsOf(m, ev), unseeded = S.eventEntries(m, ev.id).filter(function (e) { return e.heat == null && e.status !== 'SCR'; });
        return '<section class="card"><div class="cardhead"><h3>#' + ev.num + ' ' + esc(S.eventName(ev)) + '</h3><button class="btn sm ghost" data-act="seedOne" data-ev="' + ev.id + '">Re-seed</button></div>' +
          (!heats.length && !unseeded.length ? '<p class="muted small">No entries.</p>' : '') +
          (unseeded.length ? '<p class="warn small">' + unseeded.length + ' entr' + (unseeded.length > 1 ? 'ies are' : 'y is') + ' not seeded yet.</p>' : '') +
          heats.map(function (h) {
            return '<div class="tablewrap"><table class="tbl compact"><caption>' + (ev.diving ? 'Dive order' : 'Heat ' + h.heat + ' of ' + heats.length) + '</caption><thead><tr><th>' + (ev.diving ? 'Order' : 'Lane') + '</th><th>Name</th><th>Team</th><th>Seed</th><th>Heat</th><th>' + (ev.diving ? 'Ord' : 'Lane') + '</th><th>Scratch</th></tr></thead><tbody>' +
              h.entries.map(function (en) {
                var t = S.teamOf(m, en.teamId);
                return '<tr data-en="' + en.id + '"><td>' + en.lane + '</td><td>' + esc(S.entryLabel(m, en)) + (en.exhibition ? ' <span class="tag">X</span>' : '') + (en.division === 'JV' ? ' <span class="tag">JV</span>' : '') + relayLegs(m, ev, en) + '</td><td><span class="dot" style="background:' + t.color + '"></span>' + esc(t.abbr) + '</td><td>' + S.fmtMark(ev, en.seed) + '</td>' +
                  '<td><input type="number" class="num" min="1" data-hl="heat" value="' + en.heat + '"></td><td><input type="number" class="num" min="1" data-hl="lane" value="' + en.lane + '"></td>' +
                  '<td><button class="icon danger" data-act="scratch" title="Scratch">SCR</button></td></tr>';
              }).join('') + '</tbody></table></div>';
          }).join('') + scratchedList(m, ev) + '</section>';
      }).join('');
  }
  function relayLegs(m, ev, en) {
    if (!ev.relay || !en.legs || !en.legs.filter(Boolean).length) return '';
    return '<div class="legs">' + en.legs.map(function (id, i) { return id ? (i + 1) + '. ' + esc(S.swimmerName(m, id, true)) : ''; }).filter(Boolean).join(' · ') + '</div>';
  }
  function scratchedList(m, ev) {
    var s = S.eventEntries(m, ev.id).filter(function (e) { return e.status === 'SCR'; });
    if (!s.length) return '';
    return '<p class="muted small">Scratched: ' + s.map(function (e) { return esc(S.entryLabel(m, e)) + ' <button class="link sm" data-act="unscratch" data-en="' + e.id + '">undo</button>'; }).join(', ') + '</p>';
  }

  // ---------- RUN ----------
  var clock = { running: false, start: 0, elapsed: 0 };
  function vRun(m) {
    if (!m.events.length) return '<section class="card"><p>No events.</p></section>';
    var ev = byId(m.events, state.ui.eventId) || m.events[0]; state.ui.eventId = ev.id;
    var heats = S.heatsOf(m, ev);
    if (state.ui.heat > heats.length) state.ui.heat = heats.length || 1;
    var h = heats[state.ui.heat - 1];
    var res = S.eventResults(m, ev);
    var bar = '<section class="card runbar"><div class="row compact">' +
      '<button class="btn" data-act="prevEvent" aria-label="Previous event">◀</button>' +
      '<select data-act="runEvent" class="grow">' + m.events.map(function (e) { return '<option value="' + e.id + '"' + (e.id === ev.id ? ' selected' : '') + '>' + (S.eventComplete(m, e) ? '✓ ' : '') + '#' + e.num + ' ' + esc(S.eventName(e)) + '</option>'; }).join('') + '</select>' +
      '<button class="btn" data-act="nextEvent" aria-label="Next event">▶</button></div>' +
      (heats.length > 1 ? '<div class="heattabs">' + heats.map(function (x) { var done = x.entries.every(function (e) { return e.result != null || e.status; }); return '<button class="' + (x.heat === state.ui.heat ? 'on' : '') + (done ? ' done' : '') + '" data-act="heat" data-h="' + x.heat + '">' + (ev.diving ? 'Divers' : 'Heat ' + x.heat) + '</button>'; }).join('') + '</div>' : '') + '</section>';
    if (!h) return bar + '<section class="card"><p>No seeded entries in this event. Seed it on the <a href="#seeding/' + m.id + '">Heats</a> tab.</p></section>';
    var clk = ev.diving ? '' : '<section class="card clockcard"><div class="clock" id="clock">0.00</div><div class="btnrow center">' +
      '<button class="btn primary big" data-act="clockStart" id="clockBtn">Start</button><button class="btn big ghost" data-act="clockReset">Reset</button></div>' +
      '<p class="muted small center">Space = start/stop · lane number keys = touch · Enter = save heat</p></section>';
    var lanes = '<section class="card"><h2>#' + ev.num + ' ' + esc(S.eventName(ev)) + (ev.diving ? '' : ' — Heat ' + h.heat + ' of ' + heats.length) + '</h2><div class="lanes">' +
      h.entries.map(function (en) {
        var t = S.teamOf(m, en.teamId);
        return '<div class="lane" data-en="' + en.id + '"><div class="ln">' + en.lane + '</div><div class="who"><strong>' + esc(S.entryLabel(m, en)) + '</strong>' + (en.exhibition ? ' <span class="tag">X</span>' : '') + (en.division === 'JV' ? ' <span class="tag">JV</span>' : '') +
          '<span class="muted small"><span class="dot" style="background:' + t.color + '"></span>' + esc(t.abbr) + ' · seed ' + S.fmtMark(ev, en.seed) + '</span>' + relayLegs(m, ev, en) + '</div>' +
          (ev.diving ? '' : '<button class="btn touch" data-act="touch" data-lane="' + en.lane + '">Touch</button>') +
          '<input class="time result" data-res="' + en.id + '" value="' + (en.result != null ? S.fmtMark(ev, en.result) : '') + '" placeholder="' + (ev.diving ? 'score' : 'time') + '" inputmode="decimal" aria-label="Result lane ' + en.lane + '">' +
          '<select data-st="' + en.id + '" aria-label="Status">' + opt([['', 'OK'], ['DQ', 'DQ'], ['NS', 'NS'], ['DNF', 'DNF']], en.status || '') + '</select></div>';
      }).join('') + '</div><div class="btnrow"><button class="btn primary" data-act="saveHeat">Save ' + (ev.diving ? 'scores' : 'heat') + ' &amp; next</button><button class="btn ghost" data-act="saveOnly">Save</button></div></section>';
    var resTbl = '<section class="card"><h3>Event results</h3>' + resultsTable(m, ev, res) + '</section>';
    return bar + clk + lanes + resTbl;
  }
  function resultsTable(m, ev, res) {
    var out = '';
    ['V', 'JV'].forEach(function (div) {
      var rows = res[div]; if (!rows.length) return;
      if (div === 'JV' || res.JV.length) out += '<h4>' + (div === 'V' ? 'Varsity' : 'JV') + '</h4>';
      out += '<div class="tablewrap"><table class="tbl compact"><thead><tr><th>Pl</th><th>Name</th><th>Team</th><th>Seed</th><th>' + (ev.diving ? 'Score' : 'Time') + '</th><th>Pts</th></tr></thead><tbody>' +
        rows.map(function (r) {
          var t = S.teamOf(m, r.entry.teamId);
          return '<tr><td>' + (r.place || (r.exh ? 'X' : '')) + '</td><td>' + esc(S.entryLabel(m, r.entry)) + '</td><td><span class="dot" style="background:' + t.color + '"></span>' + esc(t.abbr) + '</td><td class="muted">' + S.fmtMark(ev, r.entry.seed) + '</td><td><strong>' + (r.entry.status ? r.entry.status : (r.mark != null ? S.fmtMark(ev, r.mark) : '')) + '</strong></td><td>' + (r.points || '') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    });
    return out || '<p class="muted small">No results yet.</p>';
  }
  var clockRaf = null;
  function startClockLoop() {
    cancelAnimationFrame(clockRaf);
    var last = '';
    (function tick() {
      var el = document.getElementById('clock');
      if (!el) return;
      var t = clock.running ? (performance.now() - clock.start) : clock.elapsed;
      var s = S.formatTime(Math.floor(t / 10));
      if (s !== last) { el.textContent = s; last = s; }
      var b = document.getElementById('clockBtn'); if (b) b.textContent = clock.running ? 'Stop' : (clock.elapsed ? 'Resume' : 'Start');
      clockRaf = requestAnimationFrame(tick);
    })();
  }
  function clockNow() { return clock.running ? performance.now() - clock.start : clock.elapsed; }
  function clockToggle() {
    if (clock.running) { clock.elapsed = performance.now() - clock.start; clock.running = false; }
    else { clock.start = performance.now() - clock.elapsed; clock.running = true; }
    broadcastClock();
  }
  function clockReset() { clock.running = false; clock.elapsed = 0; broadcastClock(); }
  function broadcastClock() {
    if (!bc || !state.meet) return;
    bc.postMessage({ type: 'clock', id: state.meet.id, running: clock.running, startEpoch: Date.now() - clockNow(), elapsed: clockNow(), eventId: state.ui.eventId, heat: state.ui.heat });
  }
  function setCurrent() {
    var m = state.meet; m.current = { eventId: state.ui.eventId, heat: state.ui.heat };
    save(); broadcastClock();
  }
  function touchLane(lane) {
    var t = Math.floor(clockNow() / 10); if (!t) { toast('Start the clock first'); return; }
    var en = currentHeatEntries().filter(function (e) { return e.lane === lane; })[0];
    if (!en) return;
    var inp = view.querySelector('[data-res="' + en.id + '"]'); if (inp) { inp.value = S.formatTime(t); inp.classList.add('flash'); setTimeout(function () { inp.classList.remove('flash'); }, 500); }
  }
  function currentHeatEntries() {
    var m = state.meet, ev = byId(m.events, state.ui.eventId); if (!ev) return [];
    var h = S.heatsOf(m, ev)[state.ui.heat - 1]; return h ? h.entries : [];
  }
  function saveHeat(advance) {
    var m = state.meet, ev = byId(m.events, state.ui.eventId), bad = 0;
    view.querySelectorAll('[data-res]').forEach(function (inp) {
      var en = byId(m.entries, inp.getAttribute('data-res'));
      var st = view.querySelector('[data-st="' + en.id + '"]').value;
      var v = inp.value.trim();
      var mark = S.parseMark(ev, v);
      if (v && mark == null) { bad++; inp.classList.add('err'); return; }
      en.result = mark; en.status = st || '';
    });
    if (bad) { toast(bad + ' result' + (bad > 1 ? 's' : '') + ' could not be read', true); return; }
    clockReset();
    if (advance) {
      var heats = S.heatsOf(m, ev);
      if (state.ui.heat < heats.length) state.ui.heat++;
      else { var i = m.events.indexOf(ev); if (i < m.events.length - 1) { state.ui.eventId = m.events[i + 1].id; state.ui.heat = 1; } }
    }
    setCurrent(); save(true); render(); toast('Saved'); autoPublish();
  }

  // ---------- RESULTS ----------
  function scoreTable(m) {
    var s = S.teamScores(m);
    var cols = [['overall', 'Total']];
    var gs = uniq(m.events.map(function (e) { return e.gender; }));
    if (gs.length > 1) gs.forEach(function (g) { cols.push([g, S.GENDER_LABEL[g]]); });
    if (m.scoring.jv === 'separate' && m.entries.some(function (e) { return e.division === 'JV'; })) { cols.push(['V', 'Varsity'], ['JV', 'JV']); }
    var teams = m.teams.slice().sort(function (a, b) { return s.overall[b.id] - s.overall[a.id]; });
    return '<div class="tablewrap"><table class="tbl scores"><thead><tr><th>Team</th>' + cols.map(function (c) { return '<th>' + c[1] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      teams.map(function (t) { return '<tr><td><span class="dot" style="background:' + t.color + '"></span>' + esc(t.name) + '</td>' + cols.map(function (c) { return '<td>' + s[c[0]][t.id] + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }
  function vResults(m) {
    return '<section class="card"><div class="cardhead"><h2>Team scores</h2><button class="btn sm ghost" data-act="report" data-r="results">Print results</button></div>' + scoreTable(m) + '</section>' +
      m.events.filter(function (ev) { return S.eventEntries(m, ev.id).some(function (e) { return e.result != null || e.status === 'DQ'; }); }).map(function (ev) {
        return '<section class="card"><h3>#' + ev.num + ' ' + esc(S.eventName(ev)) + '</h3>' + resultsTable(m, ev, S.eventResults(m, ev)) + '</section>';
      }).join('') || '';
  }

  // ---------- REPORTS ----------
  var REPORTS = [
    ['psych', 'Psych sheet', 'Every entry ranked by seed time.'],
    ['heat', 'Heat sheet', 'Heats and lanes for the program.'],
    ['timer', 'Timer sheets', 'One sheet per lane for the timers.'],
    ['lineup', 'Entries by team', 'Each team’s lineup for coaches.'],
    ['timeline', 'Timeline', 'Estimated start time for each event.'],
    ['results', 'Results', 'Team scores and full results.'],
    ['labels', 'Award labels', 'Top places on 30-up address labels.']
  ];
  function vReports() {
    return '<section class="card"><h2>Reports</h2><p class="muted small">Opens a print-ready page. Use your browser’s print dialog to print or save as PDF.</p><div class="reports">' +
      REPORTS.map(function (r) { return '<button class="report" data-act="report" data-r="' + r[0] + '"><strong>' + r[1] + '</strong><span>' + r[2] + '</span></button>'; }).join('') +
      '</div><label class="check"><input type="checkbox" id="labelPlaces" checked> Award labels: top <input type="number" id="labelN" value="6" min="1" max="16" class="num"> places</label></section>';
  }
  function report(kind) {
    var m = state.meet, html = '';
    var head = function (title) { return '<header class="phead"><h1>' + esc(m.name) + '</h1><p>' + esc([m.date, m.location, m.course].filter(Boolean).join(' · ')) + '</p><h2>' + title + '</h2></header>'; };
    if (kind === 'psych') {
      html = head('Psych Sheet') + m.events.map(function (ev) {
        var list = S.eventEntries(m, ev.id).filter(function (e) { return e.status !== 'SCR'; }).sort(function (a, b) {
          if (a.seed == null) return 1; if (b.seed == null) return -1; return ev.diving ? b.seed - a.seed : a.seed - b.seed;
        });
        return '<div class="pblock"><h3>Event ' + ev.num + ' — ' + esc(S.eventName(ev)) + '</h3><table><tr><th></th><th>Name</th><th>Yr</th><th>Team</th><th>Seed</th></tr>' +
          list.map(function (e, i) { var s = byId(m.swimmers, e.swimmerId); return '<tr><td>' + (i + 1) + '</td><td>' + esc(S.entryLabel(m, e)) + (e.exhibition ? ' (X)' : '') + '</td><td>' + esc(s ? s.grade : '') + '</td><td>' + esc(S.teamOf(m, e.teamId).abbr) + '</td><td>' + S.fmtMark(ev, e.seed) + '</td></tr>'; }).join('') + '</table></div>' + (ev.breakAfter ? '<p class="brk">— Break —</p>' : '');
      }).join('');
    } else if (kind === 'heat') {
      html = head('Heat Sheet') + m.events.map(function (ev) {
        var heats = S.heatsOf(m, ev);
        return '<div class="pblock"><h3>Event ' + ev.num + ' — ' + esc(S.eventName(ev)) + '</h3>' + (heats.length ? '' : '<p>No entries</p>') +
          heats.map(function (h) {
            return '<table><caption>' + (ev.diving ? 'Dive order' : 'Heat ' + h.heat + ' of ' + heats.length) + '</caption><tr><th>' + (ev.diving ? '#' : 'Lane') + '</th><th>Name</th><th>Yr</th><th>Team</th><th>Seed</th><th>Final</th></tr>' +
              h.entries.map(function (e) { var s = byId(m.swimmers, e.swimmerId); return '<tr><td>' + e.lane + '</td><td>' + esc(S.entryLabel(m, e)) + (e.exhibition ? ' (X)' : '') + relayLegsPlain(m, ev, e) + '</td><td>' + esc(s ? s.grade : '') + '</td><td>' + esc(S.teamOf(m, e.teamId).abbr) + '</td><td>' + S.fmtMark(ev, e.seed) + '</td><td class="blank"></td></tr>'; }).join('') + '</table>';
          }).join('') + '</div>' + (ev.breakAfter ? '<p class="brk">— Break —</p>' : '');
      }).join('');
    } else if (kind === 'timer') {
      for (var lane = 1; lane <= m.lanes; lane++) {
        var rows = [];
        m.events.forEach(function (ev) {
          if (ev.diving) return;
          S.heatsOf(m, ev).forEach(function (h) { h.entries.forEach(function (e) { if (e.lane === lane) rows.push([ev, h.heat, e]); }); });
        });
        html += '<div class="page">' + head('Timer Sheet — Lane ' + lane) + '<table class="timer"><tr><th>Ev</th><th>Heat</th><th>Name</th><th>Team</th><th>Watch 1</th><th>Watch 2</th><th>Final</th></tr>' +
          rows.map(function (r) { return '<tr><td>' + r[0].num + '</td><td>' + r[1] + '</td><td>' + esc(S.entryLabel(m, r[2])) + '<br><small>' + esc(S.eventName(r[0])) + '</small></td><td>' + esc(S.teamOf(m, r[2].teamId).abbr) + '</td><td class="blank"></td><td class="blank"></td><td class="blank"></td></tr>'; }).join('') + '</table></div>';
      }
    } else if (kind === 'lineup') {
      html = m.teams.map(function (t) {
        return '<div class="page">' + head('Entries — ' + esc(t.name)) + m.events.map(function (ev) {
          var list = S.eventEntries(m, ev.id).filter(function (e) { return e.teamId === t.id && e.status !== 'SCR'; });
          if (!list.length) return '';
          return '<div class="pblock"><h3>Event ' + ev.num + ' — ' + esc(S.eventName(ev)) + '</h3><table>' + list.map(function (e) { return '<tr><td>' + esc(S.entryLabel(m, e)) + (e.exhibition ? ' (X)' : '') + relayLegsPlain(m, ev, e) + '</td><td>' + S.fmtMark(ev, e.seed) + '</td><td>' + (e.heat ? 'H' + e.heat + ' L' + e.lane : '') + '</td></tr>'; }).join('') + '</table></div>';
        }).join('') + '</div>';
      }).join('');
    } else if (kind === 'timeline') {
      var tl = S.timeline(m);
      html = head('Meet Timeline') + '<table><tr><th>Start</th><th>Event</th><th>Heats</th></tr>' + tl.map(function (r) {
        return r.brk ? '<tr class="brkrow"><td>' + S.clockStr(r.start) + '</td><td colspan="2">Break (' + r.minutes + ' min)</td></tr>' : '<tr><td>' + S.clockStr(r.start) + '</td><td>' + r.event.num + '. ' + esc(S.eventName(r.event)) + '</td><td>' + r.heats + '</td></tr>';
      }).join('') + '<tr><td><strong>' + S.clockStr(tl.end) + '</strong></td><td colspan="2"><strong>Estimated finish</strong></td></tr></table><p class="small">Estimates use the slowest seed in each heat plus ' + m.timing.heatInterval + ' s between heats.</p>';
    } else if (kind === 'results') {
      html = head('Results') + scoreTable(m) + m.events.map(function (ev) {
        var r = S.eventResults(m, ev);
        if (!r.V.concat(r.JV).some(function (x) { return x.mark != null || x.entry.status; })) return '';
        return '<div class="pblock"><h3>Event ' + ev.num + ' — ' + esc(S.eventName(ev)) + '</h3>' + resultsTable(m, ev, r) + '</div>';
      }).join('');
    } else if (kind === 'labels') {
      var n = parseInt(($('#labelN') || {}).value, 10) || 6, labels = [];
      m.events.forEach(function (ev) {
        var r = S.eventResults(m, ev);
        ['V', 'JV'].forEach(function (div) {
          r[div].forEach(function (x) {
            if (x.place && x.place <= n) labels.push('<div class="label"><strong>' + esc(m.name) + '</strong><span>' + esc(S.eventName(ev)) + (div === 'JV' ? ' (JV)' : '') + '</span><span class="pl">' + ordinal(x.place) + ' place — ' + S.fmtMark(ev, x.mark) + '</span><span>' + esc(S.entryLabel(m, x.entry)) + ' · ' + esc(S.teamOf(m, x.entry.teamId).abbr) + '</span></div>');
          });
        });
      });
      html = '<div class="labels">' + (labels.join('') || '<p>No results yet.</p>') + '</div>';
    }
    var p = $('#print');
    p.innerHTML = '<div class="printbar noprint"><button class="btn primary" data-act="doPrint">Print</button><button class="btn ghost" data-act="closePrint">Close</button></div><div class="sheet ' + kind + '">' + html + '</div>';
    p.hidden = false; document.body.classList.add('printing'); window.scrollTo(0, 0);
  }
  function relayLegsPlain(m, ev, e) { if (!ev.relay || !e.legs) return ''; var l = e.legs.filter(Boolean); return l.length ? '<br><small>' + l.map(function (id) { return esc(S.swimmerName(m, id, true)); }).join(', ') + '</small>' : ''; }
  function ordinal(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

  // ---------- LIVE ----------
  function gh() { return load(KEY_GH, { owner: '', repo: '', branch: 'live-results', token: '', auto: true }); }
  function liveUrl(m) {
    var g = gh();
    var base = location.href.replace(/[#?].*$/, '').replace(/index\.html$/, '');
    return base + 'live.html?gh=' + encodeURIComponent(g.owner + '/' + g.repo) + '&branch=' + encodeURIComponent(g.branch || 'live-results') + '&meet=' + m.id;
  }
  function guessRepo() {
    var mm = location.hostname.match(/^([^.]+)\.github\.io$/);
    return mm ? { owner: mm[1], repo: location.pathname.split('/').filter(Boolean)[0] || '' } : null;
  }
  function vLive(m) {
    var g = gh(), guess = guessRepo();
    if (guess && !g.owner) { g.owner = guess.owner; g.repo = guess.repo; }
    var local = location.href.replace(/[#?].*$/, '').replace(/index\.html$/, '') + 'live.html?local=' + m.id;
    var ready = g.owner && g.repo && g.token;
    return '<section class="card"><h2>Scoreboard on this computer</h2><p>Open the scoreboard in another window or on a projector. It updates instantly — including the running clock — with no internet needed.</p>' +
      '<div class="btnrow"><a class="btn primary" href="' + local + '" target="_blank" rel="noopener">Open scoreboard</a><a class="btn ghost" href="' + local + '&board=1" target="_blank" rel="noopener">Big projector view</a></div></section>' +
      '<section class="card"><h2>Live results online (free, through GitHub)</h2>' +
      '<p>Fans can follow results on their phones. Each time you save a heat, Splash posts a small results file to your GitHub repository, and the public live page reads it. Fans see updates within about a minute.</p>' +
      '<details><summary>One-time setup (5 minutes)</summary><ol class="small">' +
      '<li>On GitHub, open <strong>Settings → Developer settings → Personal access tokens → Fine-grained tokens</strong> and choose <strong>Generate new token</strong>.</li>' +
      '<li>Repository access: <strong>Only select repositories</strong> → pick your Splash repository.</li>' +
      '<li>Permissions: <strong>Contents → Read and write</strong>. Generate, then paste the token below.</li>' +
      '<li>The token is stored only in this browser on this computer. Use <em>Forget token</em> after the meet if this is a shared computer.</li></ol></details>' +
      '<form id="ghForm" class="form"><div class="row"><label>GitHub user or org<input name="owner" value="' + esc(g.owner) + '" placeholder="your-username"></label><label>Repository<input name="repo" value="' + esc(g.repo) + '" placeholder="splash-meet-manager"></label><label>Results branch<input name="branch" value="' + esc(g.branch || 'live-results') + '"></label></div>' +
      '<label>Access token<input name="token" type="password" value="' + esc(g.token) + '" placeholder="github_pat_…" autocomplete="off"></label>' +
      '<label class="check"><input type="checkbox" name="auto"' + (g.auto ? ' checked' : '') + '> Publish automatically every time a heat is saved</label>' +
      '<div class="btnrow"><button class="btn">Save settings</button><button type="button" class="btn primary" data-act="publish"' + (ready ? '' : ' disabled') + '>Publish now</button><button type="button" class="btn ghost" data-act="forgetToken">Forget token</button></div></form>' +
      '<p class="muted small" id="pubStatus">' + (m.publish && m.publish.lastPublished ? 'Last published ' + new Date(m.publish.lastPublished).toLocaleString() : 'Not published yet.') + '</p>' +
      (g.owner && g.repo ? '<div class="share"><label>Fan link<input readonly value="' + esc(liveUrl(m)) + '" onclick="this.select()"></label><div class="btnrow"><button class="btn sm" data-act="copyLink">Copy link</button><a class="btn sm ghost" href="' + esc(liveUrl(m)) + '" target="_blank" rel="noopener">Open</a></div><div id="qr"></div></div>' : '') +
      '</section>';
  }
  function b64utf8(s) { var bytes = new TextEncoder().encode(s), bin = ''; for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); }
  var publishing = false;
  function publish(silent) {
    var g = gh(), m = state.meet;
    if (!g.owner || !g.repo || !g.token) { if (!silent) toast('Add your GitHub settings first', true); return Promise.resolve(); }
    if (publishing) return Promise.resolve();
    publishing = true;
    var api = 'https://api.github.com/repos/' + encodeURIComponent(g.owner) + '/' + encodeURIComponent(g.repo);
    var hdr = { Authorization: 'Bearer ' + g.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    var branch = g.branch || 'live-results', path = 'live/' + m.id + '.json';
    var status = function (t) { var el = document.getElementById('pubStatus'); if (el) el.textContent = t; };
    status('Publishing…');
    function ensureBranch() {
      return fetch(api + '/git/ref/heads/' + encodeURIComponent(branch), { headers: hdr }).then(function (r) {
        if (r.ok) return;
        if (r.status !== 404) throw new Error('GitHub said ' + r.status + ' — check the user, repository and token');
        return fetch(api, { headers: hdr }).then(function (r2) { if (!r2.ok) throw new Error('Repository not found (' + r2.status + ')'); return r2.json(); })
          .then(function (repo) { return fetch(api + '/git/ref/heads/' + encodeURIComponent(repo.default_branch), { headers: hdr }); })
          .then(function (r3) { return r3.json(); })
          .then(function (ref) { return fetch(api + '/git/refs', { method: 'POST', headers: hdr, body: JSON.stringify({ ref: 'refs/heads/' + branch, sha: ref.object.sha }) }); })
          .then(function (r4) { if (!r4.ok) throw new Error('Could not create branch ' + branch + ' (' + r4.status + ')'); });
      });
    }
    function put(retry) {
      return fetch(api + '/contents/' + path + '?ref=' + encodeURIComponent(branch), { headers: hdr }).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (cur) {
          var body = { message: 'Live results: ' + m.name, content: b64utf8(JSON.stringify(S.snapshot(m))), branch: branch };
          if (cur && cur.sha) body.sha = cur.sha;
          return fetch(api + '/contents/' + path, { method: 'PUT', headers: hdr, body: JSON.stringify(body) });
        }).then(function (r) {
          if (r.status === 409 && !retry) return put(true);
          if (!r.ok) throw new Error('Publish failed (' + r.status + ')');
        });
    }
    return ensureBranch().then(function () { return put(false); }).then(function () {
      m.publish = { lastPublished: Date.now() }; save(true);
      status('Published ' + new Date().toLocaleTimeString()); if (!silent) toast('Published live results');
    }).catch(function (e) { status(e.message); toast(e.message, true); }).then(function () { publishing = false; });
  }
  function autoPublish() { var g = gh(); if (g.auto && g.token && g.owner && g.repo) publish(true); }
  function drawQR() {
    var el = document.getElementById('qr'); if (!el || !state.meet) return;
    var go2 = function () { el.innerHTML = ''; try { new window.QRCode(el, { text: liveUrl(state.meet), width: 160, height: 160 }); } catch (e) { } };
    if (window.QRCode) return go2();
    var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'; s.onload = go2; document.head.appendChild(s);
  }

  // ---------- demo ----------
  function demoMeet() {
    var m = S.newMeet({ name: 'Riverbend vs. Lakeview (Demo)', type: 'dual', location: 'Riverbend Aquatic Center' });
    var A = S.findOrCreateTeam(m, 'Riverbend'), B = S.findOrCreateTeam(m, 'Lakeview');
    A.abbr = 'RIV'; B.abbr = 'LAK'; B.color = '#c2410c';
    var firstF = ['Ava', 'Mia', 'Nora', 'Ella', 'Ivy', 'Zoe', 'Lila', 'Ruby', 'June', 'Tess', 'Cora', 'Maya'];
    var firstM = ['Leo', 'Owen', 'Eli', 'Max', 'Sam', 'Jack', 'Finn', 'Noah', 'Cole', 'Luke', 'Reid', 'Ben'];
    var lasts = ['Brooks', 'Chen', 'Diaz', 'Evans', 'Ford', 'Gray', 'Hale', 'Ito', 'Jones', 'Khan', 'Lopez', 'Moss', 'Nash', 'Ortiz', 'Park', 'Quinn', 'Reyes', 'Shaw', 'Tran', 'Vance', 'Wade', 'Young', 'Zhao', 'Bell'];
    var base = { 'Free50': 2650, 'Free100': 5800, 'Free200': 12800, 'Free500': 34500, 'IM200': 14500, 'Fly100': 6500, 'Back100': 6600, 'Breast100': 7300 };
    var k = 0, rnd = mulberry(7);
    [A, B].forEach(function (t) {
      ['F', 'M'].forEach(function (g) {
        (g === 'F' ? firstF : firstM).slice(0, 9).forEach(function (f, i) {
          m.swimmers.push({ id: S.uid('sw'), first: f, last: lasts[(k++) % lasts.length], gender: g, grade: String(9 + (i % 4)), teamId: t.id, division: i >= 7 ? 'JV' : 'V' });
        });
      });
    });
    // individual events first, then relays filled from swimmers still under the 4-event limit
    m.events.filter(function (e) { return !e.relay; }).concat(m.events.filter(function (e) { return e.relay; })).forEach(function (ev) {
      [A, B].forEach(function (t) {
        var pool = m.swimmers.filter(function (s) { return s.teamId === t.id && s.gender === ev.gender; });
        if (ev.relay) {
          ['A', 'B'].forEach(function (L, j) {
            var avail = pool.filter(function (s) { return S.swimmerCounts(m, s.id).total < 4; })
              .sort(function (a, b) { return S.swimmerCounts(m, a.id).total - S.swimmerCounts(m, b.id).total; });
            if (avail.length < 4) return;
            var legs = avail.slice(0, 4).map(function (s) { return s.id; });
            var leg = ev.stroke === 'Medley Relay' ? 2900 : (ev.distance === 400 ? 6000 : 2700);
            m.entries.push({ id: S.uid('en'), eventId: ev.id, teamId: t.id, swimmerId: null, legs: legs, letter: L, seed: Math.round(leg * 4 * (ev.gender === 'M' ? 0.9 : 1) * (1 + j * 0.06 + rnd() * 0.04)), division: 'V', exhibition: false });
          });
          return;
        }
        var picks = pool.slice().sort(function () { return rnd() - 0.5; }).filter(function (s) { return S.swimmerCounts(m, s.id).ind < 2; }).slice(0, 3);
        picks.forEach(function (s) {
          var seed = ev.diving ? Math.round((150 + rnd() * 90) * 100) : Math.round((base[ev.stroke + ev.distance] || 6000) * (ev.gender === 'M' ? 0.9 : 1) * (1 + rnd() * 0.15));
          m.entries.push({ id: S.uid('en'), eventId: ev.id, teamId: t.id, swimmerId: s.id, seed: seed, division: s.division, exhibition: false });
        });
      });
    });
    S.seedAll(m);
    return m;
  }
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---------- event handlers ----------
  document.addEventListener('submit', function (e) {
    var f = e.target, m = state.meet; e.preventDefault();
    var d = {}; new FormData(f).forEach(function (v, k) { d[k] = v; });
    if (f.id === 'newMeet') {
      var nm = S.newMeet({ name: d.name, date: d.date, startTime: d.startTime, location: d.location, type: d.type, lanes: +d.lanes, course: d.course, genders: d.genders, diving: !!d.diving });
      state.meet = nm; save(true); state.ui.eventId = nm.events[0] && nm.events[0].id; go('roster');
    } else if (f.id === 'addTeam') {
      var t = S.findOrCreateTeam(m, d.name); if (d.abbr) t.abbr = d.abbr.toUpperCase(); t.name = d.name;
      state.ui.team = state.ui.team || t.id; save(); render();
    } else if (f.id === 'addSwimmer') {
      m.swimmers.push({ id: S.uid('sw'), first: d.first.trim(), last: d.last.trim(), gender: d.gender, grade: d.grade, teamId: d.team, division: d.division });
      save(); render(); var i = view.querySelector('#addSwimmer [name=first]'); if (i) i.focus();
    } else if (f.id === 'ghForm') {
      store(KEY_GH, { owner: d.owner.trim(), repo: d.repo.trim(), branch: (d.branch || 'live-results').trim(), token: d.token.trim(), auto: !!d.auto });
      toast('Settings saved'); render(); drawQR();
    }
  });

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b || b.tagName === 'SELECT') return;
    var a = b.getAttribute('data-act'), m = state.meet;
    var row = b.closest('[data-ev],[data-en],[data-sw],[data-tm]');
    switch (a) {
      case 'open': openMeet(b.dataset.id); break;
      case 'delMeet':
        if (!confirm('Delete this meet from this browser? This cannot be undone. (Download a backup first if you might need it.)')) return;
        localStorage.removeItem(KEY_MEET + b.dataset.id); store(KEY_INDEX, indexList().filter(function (x) { return x.id !== b.dataset.id; }));
        if (m && m.id === b.dataset.id) state.meet = null; render(); break;
      case 'demo': state.meet = demoMeet(); save(true); state.ui.eventId = state.meet.events[0].id; state.ui.team = state.meet.teams[0].id; go('meet'); toast('Demo meet loaded'); break;
      case 'backup': download(m.name.replace(/[^\w-]+/g, '_') + '.splash.json', JSON.stringify(m, null, 1)); break;
      case 'dupMeet': var c = S.clone(m); c.id = S.uid('meet'); c.name = m.name + ' (copy)'; state.meet = c; save(true); go('meet'); toast('Duplicated'); break;
      case 'addEvent': m.events.push(S.makeEvent('F', 100, 'Free')); S.renumber(m.events); save(); render(); break;
      case 'hsTemplate':
        if (m.entries.length && !confirm('Replace all events with the high-school template? Entries in removed events will be deleted.')) return;
        m.events = S.hsTemplate(uniq(m.events.map(function (x) { return x.gender; })).length > 1 ? 'both' : (m.events[0] ? m.events[0].gender : 'both'), true);
        m.entries = []; save(); render(); break;
      case 'evUp': case 'evDown':
        var i = m.events.indexOf(byId(m.events, row.dataset.ev)), j = a === 'evUp' ? i - 1 : i + 1;
        var tmp = m.events[i]; m.events[i] = m.events[j]; m.events[j] = tmp; S.renumber(m.events); save(); render(); break;
      case 'evDel':
        var ev = byId(m.events, row.dataset.ev), n = S.eventEntries(m, ev.id).length;
        if (n && !confirm('Delete ' + S.eventName(ev) + ' and its ' + n + ' entries?')) return;
        m.events = m.events.filter(function (x) { return x !== ev; }); m.entries = m.entries.filter(function (x) { return x.eventId !== ev.id; }); S.renumber(m.events); save(); render(); break;
      case 'delTeam':
        var tid = row.dataset.tm;
        if (!confirm('Delete this team, its swimmers and entries?')) return;
        m.teams = m.teams.filter(function (t) { return t.id !== tid; }); m.swimmers = m.swimmers.filter(function (s) { return s.teamId !== tid; }); m.entries = m.entries.filter(function (x) { return x.teamId !== tid; });
        save(); render(); break;
      case 'delSwimmer':
        var sid = row.dataset.sw;
        m.swimmers = m.swimmers.filter(function (s) { return s.id !== sid; });
        m.entries = m.entries.filter(function (x) { return x.swimmerId !== sid; });
        m.entries.forEach(function (x) { if (x.legs) x.legs = x.legs.map(function (l) { return l === sid ? '' : l; }); });
        save(); render(); break;
      case 'importRoster': doImportRoster($('#rosterCsv').value); break;
      case 'importEntries': doImportEntries($('#entryCsv').value); break;
      case 'addRelay':
        var used = m.entries.filter(function (x) { return x.eventId === b.dataset.ev && x.teamId === state.ui.team; }).map(function (x) { return x.letter; });
        var L = 'ABCDEFGH'.split('').filter(function (x) { return used.indexOf(x) < 0; })[0] || 'A';
        m.entries.push({ id: S.uid('en'), eventId: b.dataset.ev, teamId: state.ui.team, swimmerId: null, legs: ['', '', '', ''], letter: L, seed: null, division: 'V', exhibition: false });
        save(); render(); break;
      case 'delEntry': m.entries = m.entries.filter(function (x) { return x.id !== row.dataset.en; }); save(); render(); break;
      case 'seedAll':
        var hasRes = m.entries.some(function (x) { return x.result != null; });
        if (hasRes && !confirm('Some events have results. Re-seed everything anyway? Results stay with each swimmer but heats and lanes may change.')) return;
        S.seedAll(m); save(); render(); toast('All events seeded'); break;
      case 'seedOne': S.seedEvent(m, byId(m.events, b.dataset.ev)); save(); render(); break;
      case 'scratch': var en = byId(m.entries, row.dataset.en); en.status = 'SCR'; en.heat = null; en.lane = null; save(); render(); break;
      case 'unscratch': var en2 = byId(m.entries, b.dataset.en); en2.status = ''; S.seedEvent(m, byId(m.events, en2.eventId)); save(); render(); break;
      case 'prevEvent': case 'nextEvent':
        var k = m.events.indexOf(byId(m.events, state.ui.eventId)) + (a === 'prevEvent' ? -1 : 1);
        if (k >= 0 && k < m.events.length) { state.ui.eventId = m.events[k].id; state.ui.heat = 1; clockReset(); setCurrent(); render(); } break;
      case 'heat': state.ui.heat = +b.dataset.h; clockReset(); setCurrent(); render(); break;
      case 'clockStart': clockToggle(); break;
      case 'clockReset': clockReset(); break;
      case 'touch': touchLane(+b.dataset.lane); break;
      case 'saveHeat': saveHeat(true); break;
      case 'saveOnly': saveHeat(false); break;
      case 'report': report(b.dataset.r); break;
      case 'doPrint': window.print(); break;
      case 'closePrint': $('#print').hidden = true; document.body.classList.remove('printing'); break;
      case 'publish': publish(false); break;
      case 'forgetToken': var g = gh(); g.token = ''; store(KEY_GH, g); render(); toast('Token removed from this browser'); break;
      case 'copyLink': navigator.clipboard && navigator.clipboard.writeText(liveUrl(m)).then(function () { toast('Link copied'); }); break;
    }
  });

  document.addEventListener('change', function (e) {
    var el = e.target, m = state.meet; if (!m) { if (el.id === 'restoreFile') readFile(el, restore); return; }
    var row = el.closest('[data-ev],[data-en],[data-sw],[data-tm]');
    var ds = el.dataset;
    if (ds.f) { m[ds.f] = el.type === 'number' ? (+el.value || 0) : el.value; if (ds.f === 'name') $('#meetTitle').textContent = m.name; save(); if (ds.f === 'lanes') toast('Re-seed events to use the new lane count'); return; }
    if (ds.sc) {
      if (ds.sc === 'ind' || ds.sc === 'relay') { m.scoring[ds.sc] = el.value.split(/[^0-9.]+/).filter(Boolean).map(Number); m.scoring.preset = 'custom'; }
      else m.scoring[ds.sc] = el.type === 'number' ? (+el.value || 0) : el.value;
      save(); render(); return;
    }
    if (ds.lim) { m.limits[ds.lim] = +el.value || 0; save(); return; }
    if (ds.tm) { m.timing[ds.tm] = +el.value || 0; save(); return; }
    if (ds.evf) {
      var ev = byId(m.events, row.dataset.ev);
      if (ds.evf === 'breakAfter') ev.breakAfter = el.checked;
      else if (ds.evf === 'distance') ev.distance = +el.value || ev.distance;
      else if (ds.evf === 'stroke') { ev.stroke = el.value; ev.relay = /Relay/.test(el.value); ev.diving = el.value === 'Diving'; if (ev.diving) ev.distance = 1; else if (ev.distance === 1) ev.distance = 100; }
      else ev[ds.evf] = el.value;
      save(); render(); return;
    }
    if (ds.tf) { var t = byId(m.teams, row.dataset.tm); t[ds.tf] = ds.tf === 'abbr' ? el.value.toUpperCase() : el.value; save(); return; }
    if (ds.sf) {
      var s = byId(m.swimmers, row.dataset.sw); s[ds.sf] = el.value;
      if (ds.sf === 'teamId' || ds.sf === 'division') m.entries.forEach(function (x) { if (x.swimmerId === s.id) { if (ds.sf === 'teamId') x.teamId = s.teamId; else x.division = s.division; } });
      save(); return;
    }
    if (ds.cell) return cellChange(el);
    if (ds.rf || ds.leg != null) {
      var en = byId(m.entries, row.dataset.en);
      if (ds.leg != null) { en.legs = en.legs || ['', '', '', '']; en.legs[+ds.leg] = el.value; }
      else if (ds.rf === 'seed') { en.seed = S.parseTime(el.value); el.value = en.seed == null ? 'NT' : S.formatTime(en.seed); }
      else if (ds.rf === 'exhibition') en.exhibition = el.checked;
      else en[ds.rf] = ds.rf === 'letter' ? el.value.toUpperCase() : el.value;
      save(); return;
    }
    if (ds.hl) { var en3 = byId(m.entries, row.dataset.en); en3[ds.hl] = +el.value || 1; save(); render(); return; }
    var act = ds.act;
    if (act === 'preset') { if (el.value !== 'custom') { var p = S.SCORING_PRESETS[el.value]; m.scoring.preset = el.value; m.scoring.ind = p.ind.slice(); m.scoring.relay = p.relay.slice(); } save(); render(); return; }
    if (act === 'rosterTeam') { state.ui.rosterTeam = el.value; render(); return; }
    if (act === 'rosterGender') { state.ui.rosterGender = el.value; render(); return; }
    if (act === 'entTeam') { state.ui.team = el.value; render(); return; }
    if (act === 'entGender') { state.ui.gender = el.value; render(); return; }
    if (act === 'runEvent') { state.ui.eventId = el.value; state.ui.heat = 1; clockReset(); setCurrent(); render(); return; }
    if (el.id === 'rosterFile') readFile(el, function (txt) { doImportRoster(txt); });
    if (el.id === 'restoreFile') readFile(el, restore);
  });

  function cellChange(el) {
    var m = state.meet, p = el.dataset.cell.split('|'), ev = byId(m.events, p[0]), sw = byId(m.swimmers, p[1]);
    var raw = el.value.trim(), exh = /^x/i.test(raw); if (exh) raw = raw.slice(1).trim();
    var en = m.entries.filter(function (x) { return x.eventId === ev.id && x.swimmerId === sw.id; })[0];
    if (!el.value.trim()) { if (en) m.entries = m.entries.filter(function (x) { return x !== en; }); el.classList.remove('has', 'err'); }
    else {
      var v = S.parseMark(ev, raw);
      if (v == null && raw && raw.toUpperCase() !== 'NT') { el.classList.add('err'); toast('Could not read "' + el.value + '"', true); return; }
      if (!en) {
        var cnt = m.entries.filter(function (x) { return x.eventId === ev.id && x.teamId === sw.teamId && !x.exhibition && x.status !== 'SCR'; }).length;
        if (m.limits.maxPerTeam && !exh && cnt >= m.limits.maxPerTeam) toast('Note: ' + S.teamOf(m, sw.teamId).abbr + ' now has more than ' + m.limits.maxPerTeam + ' scoring entries in this event');
        en = { id: S.uid('en'), eventId: ev.id, teamId: sw.teamId, swimmerId: sw.id, division: sw.division, heat: null, lane: null };
        m.entries.push(en);
      }
      en.seed = v; en.exhibition = exh;
      el.value = (exh ? 'x' : '') + (v == null ? 'NT' : S.fmtMark(ev, v)); el.classList.add('has'); el.classList.remove('err');
    }
    var c = S.swimmerCounts(m, sw.id), td = view.querySelector('[data-count="' + sw.id + '"]');
    if (td) { td.textContent = c.ind + '/' + c.total; td.className = ((m.limits.maxInd && c.ind > m.limits.maxInd) || (m.limits.maxTotal && c.total > m.limits.maxTotal)) ? 'bad' : ''; }
    save();
  }
  function readFile(input, cb) { var f = input.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { cb(r.result); input.value = ''; }; r.readAsText(f); }
  function restore(txt) {
    try {
      var m = JSON.parse(txt); if (!m || !m.events || !m.id) throw new Error('Not a Splash backup');
      if (indexList().some(function (x) { return x.id === m.id; }) && !confirm('This meet already exists in this browser. Replace it with the backup?')) return;
      state.meet = m; save(true); go('meet'); toast('Meet restored');
    } catch (e) { toast('Could not read backup: ' + e.message, true); }
  }
  function doImportRoster(txt) {
    var r = S.importRoster(state.meet, txt); save(); render();
    toast('Added ' + r.added + ' swimmer' + (r.added === 1 ? '' : 's') + (r.errors.length ? ' · ' + r.errors.length + ' rows skipped' : ''), !!r.errors.length && !r.added);
  }
  function doImportEntries(txt) {
    var m = state.meet, rows = S.parseCSV(txt), added = 0, skipped = 0;
    if (rows.length && /event/i.test(rows[0][0] || '')) rows.shift();
    rows.forEach(function (r) {
      var ev = m.events.filter(function (e) { return String(e.num) === String(r[0]).replace(/\D/g, ''); })[0];
      if (!ev || ev.relay || !r[1] || !r[2]) { skipped++; return; }
      var team = S.findOrCreateTeam(m, r[3] || 'UNA');
      var sw = m.swimmers.filter(function (s) { return s.first.toLowerCase() === r[1].toLowerCase() && s.last.toLowerCase() === r[2].toLowerCase() && s.teamId === team.id; })[0];
      if (!sw) { sw = { id: S.uid('sw'), first: r[1], last: r[2], gender: ev.gender === 'X' ? 'F' : ev.gender, grade: '', teamId: team.id, division: 'V' }; m.swimmers.push(sw); }
      var en = m.entries.filter(function (x) { return x.eventId === ev.id && x.swimmerId === sw.id; })[0];
      if (!en) { en = { id: S.uid('en'), eventId: ev.id, teamId: team.id, swimmerId: sw.id, division: sw.division }; m.entries.push(en); }
      en.seed = S.parseMark(ev, r[4]); added++;
    });
    save(); render(); toast('Imported ' + added + ' entries' + (skipped ? ', skipped ' + skipped : ''), !added && skipped);
  }

  // keyboard for the Run screen
  document.addEventListener('keydown', function (e) {
    if (state.view !== 'run' || !$('#print').hidden) return;
    var typing = /INPUT|SELECT|TEXTAREA/.test(e.target.tagName);
    if (e.key === 'Enter' && typing && e.target.dataset.res != null) { e.preventDefault(); saveHeat(true); return; }
    if (typing) return;
    if (e.code === 'Space') { e.preventDefault(); clockToggle(); }
    else if (/^[1-9]$/.test(e.key)) { touchLane(+e.key); }
    else if (e.key === '0') { touchLane(10); }
    else if (e.key === 'Enter') { saveHeat(true); }
  });

  // live view tab: draw QR after render
  var _render = render;
  render = function () { _render(); if (state.view === 'live') drawQR(); };

  // init
  if (!('localStorage' in window)) toast('This browser cannot save meets', true);
  route();
})();
