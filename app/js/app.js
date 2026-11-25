/*
 * VerifyFirst — user interface.
 *
 * Two study conditions:
 *   generic   : a flagged email shows a standard warning when its link is clicked.
 *   explained : the warning names one checkable detail (from extractor.js), gives an
 *               AI-written explanation, shows the AI's confidence and suggests opening
 *               the student portal independently.
 * In both conditions the student portal is always available from the top bar.
 */
(function () {
  'use strict';

  const D = window.VF_DATA;
  const X = window.VFExtractor;
  const L = window.VFLogger;
  const C = window.VFCriteria;
  const STORE_KEY = 'verifyfirst.sessions';
  const params = new URLSearchParams(location.search);

  const app = document.getElementById('app');
  const statusBar = document.getElementById('status-bar');
  const modalRoot = document.getElementById('modal-root');

  // Evidence is computed once, at load, for every email.
  const EVIDENCE = {};
  D.EMAILS.forEach(e => { EVIDENCE[e.id] = X.extract(e, D.UNIVERSITY); });

  let S = null; // session state
  let liveAvailable = false;

  // ---------- helpers ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function emailById(id) { return D.EMAILS.find(e => e.id === id); }
  function log(type, emailId, detail) { if (S) S.log.log(type, emailId, detail); }
  function loadSessions() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveSession(record) {
    try {
      const all = loadSessions();
      all.push(record);
      localStorage.setItem(STORE_KEY, JSON.stringify(all));
      return all.length;
    } catch (e) { return null; }
  }
  function download(name, text, type) {
    const blob = new Blob([text], { type: type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  // Splits a host so the part that decides where you really go can be emphasised.
  function hostParts(host) {
    const real = X.registrableDomain(host);
    const prefix = host.slice(0, host.length - real.length);
    return { prefix: prefix, real: real };
  }

  // ---------- live explanations (optional) ----------
  function detectLive() {
    if (location.protocol === 'file:') return Promise.resolve(false);
    return fetch('api/health', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { live: false })
      .then(j => !!j.live)
      .catch(() => false);
  }

  function prefetchLiveExplanations() {
    const flagged = D.EMAILS.filter(e => e.flag.flagged);
    return Promise.all(flagged.map(email => {
      const body = { emailId: email.id, confidence: email.flag.confidence, evidence: EVIDENCE[email.id] };
      return fetch('api/explain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(exp => {
          // The schema guarantees shape, not truth: check the success criteria in code
          // before anything reaches the student.
          const result = C.check(exp, EVIDENCE[email.id]);
          if (!result.pass) throw new Error('criteria failed: ' + result.failures.join('; '));
          S.explanations[email.id] = exp;
          log('explanation_ready', email.id, { source: 'live' });
        })
        .catch(err => log('explanation_ready', email.id, { source: 'cached-fallback', error: String(err.message || err) }));
    }));
  }

  // ---------- start screen ----------
  function renderStart() {
    const sessions = loadSessions();
    const nextId = 'P' + String(sessions.length + 1).padStart(2, '0');
    const presetCondition = params.get('condition');
    app.innerHTML = `
      <main class="start">
        <section class="card start-card">
          <p class="eyebrow">Research prototype</p>
          <h1>VerifyFirst inbox study</h1>
          <p>You will see a simulated university inbox for the fictional <strong>${esc(D.UNIVERSITY.name)}</strong>.
             Deal with each email as you normally would: read it, follow links if you want to, report, delete or keep it.
             An AI assistant checks incoming emails and may show warnings. It is not always right.</p>
          <p class="note"><strong>Nothing here is real.</strong> No page in this study asks for a password and no real website is opened. Never type a real password.</p>
          <form id="start-form" class="start-form">
            <label>Participant ID <input id="pid" value="${esc(params.get('pid') || nextId)}" required></label>
            <label>Condition
              <select id="condition">
                <option value="auto">Auto (alternates A and B)</option>
                <option value="generic" ${presetCondition === 'generic' ? 'selected' : ''}>A: generic warning</option>
                <option value="explained" ${presetCondition === 'explained' ? 'selected' : ''}>B: AI explanation</option>
              </select>
            </label>
            ${liveAvailable ? `
            <label>Explanation source
              <select id="source">
                <option value="cached">Cached (identical for everyone)</option>
                <option value="live">Live LLM (server.py)</option>
              </select>
            </label>` : ''}
            <button class="btn primary" type="submit">Start</button>
          </form>
          <p class="small muted">Researcher: ${sessions.length} saved session(s) on this device.</p>
        </section>
      </main>`;
    document.getElementById('start-form').addEventListener('submit', ev => {
      ev.preventDefault();
      let condition = document.getElementById('condition').value;
      if (condition === 'auto') condition = loadSessions().length % 2 === 0 ? 'explained' : 'generic';
      const sourceEl = document.getElementById('source');
      startSession(document.getElementById('pid').value.trim() || nextId, condition, sourceEl ? sourceEl.value : 'cached');
    });
  }

  function startSession(participant, condition, source) {
    S = {
      participant: participant,
      condition: condition,
      explanationSource: source,
      startedAt: new Date().toISOString(),
      log: L.createLog(),
      explanations: Object.assign({}, D.EXPLANATIONS),
      current: null,
      opened: {},
      hovered: {},
      decision: {},
      view: 'mail'
    };
    log('session_start', null, { condition: condition, explanationSource: source });
    if (condition === 'explained' && source === 'live') prefetchLiveExplanations();
    renderMail();
  }

  // ---------- mail ----------
  function topBar(active) {
    return `
      <header class="topbar">
        <div class="brand"><span class="logo" aria-hidden="true">N</span> Northvale Mail</div>
        <nav class="top-actions">
          <button class="bookmark ${active === 'portal' ? 'active' : ''}" id="open-portal" title="Opens the portal at its usual address">
            <span class="bm-label">Student portal</span>
            <span class="bm-url">${esc(D.UNIVERSITY.portalHost)}</span>
          </button>
          <button class="btn ghost" id="finish">Finish</button>
        </nav>
      </header>`;
  }

  function wireTopBar() {
    document.getElementById('open-portal').addEventListener('click', () => openPortal('topbar'));
    document.getElementById('finish').addEventListener('click', confirmFinish);
  }

  function chip(decision) {
    const label = { report: 'Reported', delete: 'Deleted', keep: 'Kept' }[decision];
    return label ? `<span class="chip chip-${decision}">${label}</span>` : '';
  }

  function renderMail() {
    S.view = 'mail';
    const list = D.EMAILS.map(e => `
      <li>
        <button class="mail-item ${S.current === e.id ? 'selected' : ''} ${S.opened[e.id] ? '' : 'unread'}" data-id="${e.id}">
          <span class="mi-from">${esc(e.from.name)}</span>
          <span class="mi-time">${esc(e.received)}</span>
          <span class="mi-subject">${esc(e.subject)}</span>
          ${chip(S.decision[e.id])}
        </button>
      </li>`).join('');

    app.innerHTML = `
      ${topBar('mail')}
      <div class="mail-layout">
        <aside class="mail-list" aria-label="Inbox">
          <h2 class="list-title">Inbox</h2>
          <ul>${list}</ul>
        </aside>
        <main class="reader" id="reader">${S.current ? readerHtml(emailById(S.current)) : emptyReader()}</main>
      </div>`;
    wireTopBar();
    app.querySelectorAll('.mail-item').forEach(b => b.addEventListener('click', () => openEmail(b.dataset.id)));
    if (S.current) wireReader(emailById(S.current));
  }

  function emptyReader() {
    return `<div class="empty"><p><strong>Select an email to read it.</strong></p>
      <p class="muted">Deal with each email as you normally would. Choose <em>Finish</em> when you are done.</p></div>`;
  }

  function readerHtml(email) {
    const paras = email.body.map(p => {
      if (p === '{link}') return `<p><a class="mail-link" id="mail-link" href="${esc(email.link.href)}">${esc(email.link.text)}</a></p>`;
      return `<p>${esc(p).replace(/\n/g, '<br>')}</p>`;
    }).join('');
    const d = S.decision[email.id];
    return `
      <article class="message">
        <h2 class="subject">${esc(email.subject)}</h2>
        <div class="meta">
          <span class="avatar" aria-hidden="true">${esc(email.from.name.charAt(0))}</span>
          <div><div><strong>${esc(email.from.name)}</strong> <span class="muted">&lt;${esc(email.from.address)}&gt;</span></div>
          <div class="muted small">To: you &middot; ${esc(email.received)}</div></div>
        </div>
        <div class="body">${paras}</div>
        <div class="actions" role="group" aria-label="What do you want to do with this email?">
          <button class="btn ${d === 'report' ? 'selected' : ''}" data-decision="report">Report phishing</button>
          <button class="btn ${d === 'delete' ? 'selected' : ''}" data-decision="delete">Delete</button>
          <button class="btn ${d === 'keep' ? 'selected' : ''}" data-decision="keep">Keep</button>
          ${d ? `<span class="muted small">You chose: ${chip(d)} (you can change this)</span>` : ''}
        </div>
      </article>`;
  }

  function wireReader(email) {
    const link = document.getElementById('mail-link');
    if (link) {
      let timer = null;
      const show = () => {
        statusBar.textContent = email.link.href;
        statusBar.hidden = false;
        if (!S.hovered[email.id]) {
          timer = setTimeout(() => { S.hovered[email.id] = true; log('link_hover', email.id, { host: X.hostOf(email.link.href) }); }, 500);
        }
      };
      const hide = () => { statusBar.hidden = true; clearTimeout(timer); };
      link.addEventListener('mouseenter', show);
      link.addEventListener('focus', show);
      link.addEventListener('mouseleave', hide);
      link.addEventListener('blur', hide);
      link.addEventListener('click', ev => { ev.preventDefault(); hide(); clickLink(email); });
    }
    app.querySelectorAll('[data-decision]').forEach(b => b.addEventListener('click', () => {
      S.decision[email.id] = b.dataset.decision;
      log(b.dataset.decision, email.id);
      renderMail();
    }));
  }

  function openEmail(id) {
    S.current = id;
    if (!S.opened[id]) S.opened[id] = true;
    log('email_open', id);
    renderMail();
    const reader = document.getElementById('reader');
    if (reader) reader.focus && reader.scrollTo(0, 0);
  }

  // ---------- link click and warnings ----------
  function clickLink(email) {
    log('link_click', email.id, { host: X.hostOf(email.link.href) });
    if (email.flag.flagged) showWarning(email);
    else followLink(email);
  }

  function followLink(email) {
    log('link_followed', email.id, { host: X.hostOf(email.link.href) });
    openModal(`
      <div class="modal external" role="dialog" aria-modal="true" aria-labelledby="ext-title">
        <div class="fake-address"><span class="lock" aria-hidden="true"></span>${esc(email.link.href)}</div>
        <h2 id="ext-title">Simulated web page</h2>
        <p>You followed the link to <strong>${esc(X.hostOf(email.link.href))}</strong>.</p>
        <p class="muted">To keep this study safe, no real website is loaded and nothing you type is collected.</p>
        <div class="modal-actions"><button class="btn primary" id="ext-back">Return to the inbox</button></div>
      </div>`);
    document.getElementById('ext-back').addEventListener('click', closeModal);
  }

  function showWarning(email) {
    log('warning_shown', email.id, { condition: S.condition });
    if (S.condition === 'generic') return showGenericWarning(email);
    return showExplainedWarning(email);
  }

  function showGenericWarning(email) {
    const w = D.GENERIC_WARNING;
    openModal(`
      <div class="modal warning generic" role="alertdialog" aria-modal="true" aria-labelledby="w-title" aria-describedby="w-sum">
        <div class="w-icon" aria-hidden="true">!</div>
        <h2 id="w-title">${esc(w.headline)}</h2>
        <p id="w-sum">${esc(w.summary)}</p>
        <div class="modal-actions">
          <button class="btn primary" id="w-back">Back to the email</button>
          <button class="btn link" id="w-continue">Open the link anyway</button>
        </div>
      </div>`);
    wireWarning(email);
  }

  function checkableHtml(c) {
    if (!c) return '';
    if (c.type === 'link_domain') {
      const p = hostParts(c.host);
      const ok = c.status === 'match';
      return `
        <div class="checkable ${ok ? 'ok' : 'bad'}">
          <div class="ck-label">Where the link really goes</div>
          <div class="ck-host"><span class="ck-prefix">${esc(p.prefix)}</span><mark>${esc(p.real)}</mark></div>
          <div class="ck-verdict">${ok ? '&#10003; This is a university address' : '&#10007; Not a university address'}</div>
          <div class="ck-label second">University addresses end in</div>
          <div class="ck-host"><mark class="expected">${esc(c.expected)}</mark></div>
        </div>`;
    }
    return `
      <div class="checkable ${c.status === 'match' ? 'ok' : 'bad'}">
        <div class="ck-label">Sender address</div>
        <div class="ck-host"><mark>${esc(c.host)}</mark></div>
        <div class="ck-label second">University addresses end in</div>
        <div class="ck-host"><mark class="expected">${esc(c.expected)}</mark></div>
      </div>`;
  }

  function evidenceList(ev) {
    return ev.evidence.map(e => {
      if (e.type === 'urgency') return `<li>Urgent wording: ${e.phrases.map(p => `“${esc(p)}”`).join(', ')}</li>`;
      if (e.type === 'sign_in_request') return `<li>Asks you to sign in or verify: ${e.phrases.map(p => `“${esc(p)}”`).join(', ')}</li>`;
      if (e.type === 'sender_domain') {
        return e.status === 'match'
          ? `<li>Sender: ${esc(e.host)} looks like a university address, but sender addresses can be faked.</li>`
          : `<li>Sender: ${esc(e.host)} is not a university address.</li>`;
      }
      if (e.type === 'link_domain') {
        return e.status === 'match'
          ? `<li>Link: goes to ${esc(e.host)}, a university address.</li>`
          : `<li>Link: goes to ${esc(e.realDomain)}${e.startsWithOfficial ? ', disguised to start with the university’s name' : ''}.</li>`;
      }
      return '';
    }).join('');
  }

  function showExplainedWarning(email) {
    const exp = S.explanations[email.id] || D.EXPLANATIONS[email.id];
    const ev = EVIDENCE[email.id];
    const conf = email.flag.confidence;
    openModal(`
      <div class="modal warning explained ${conf}" role="alertdialog" aria-modal="true" aria-labelledby="w-title" aria-describedby="w-sum">
        <div class="w-head">
          <div class="w-icon" aria-hidden="true">!</div>
          <div>
            <p class="eyebrow">AI safety check</p>
            <h2 id="w-title">${esc(exp.headline)}</h2>
          </div>
        </div>
        ${checkableHtml(ev.checkable)}
        <p id="w-sum">${esc(exp.summary)}</p>
        <p class="w-action"><strong>What to do:</strong> ${esc(exp.action)}</p>
        <details id="w-why">
          <summary>Why was this flagged?</summary>
          <ul>${evidenceList(ev)}</ul>
        </details>
        <p class="confidence">AI confidence: <strong>${conf === 'high' ? 'High' : 'Medium'}</strong>. This tool can be wrong; the portal is the reliable check.</p>
        <div class="modal-actions">
          <button class="btn primary" id="w-portal">Open the student portal</button>
          <button class="btn" id="w-back">Back to the email</button>
          <button class="btn link" id="w-continue">Open the link anyway</button>
        </div>
      </div>`);
    document.getElementById('w-why').addEventListener('toggle', e => { if (e.target.open) log('warning_expand', email.id); });
    document.getElementById('w-portal').addEventListener('click', () => {
      log('warning_action', email.id, { action: 'portal' });
      closeModal();
      openPortal('warning');
    });
    wireWarning(email);
  }

  function wireWarning(email) {
    document.getElementById('w-back').addEventListener('click', () => { log('warning_action', email.id, { action: 'back' }); closeModal(); });
    document.getElementById('w-continue').addEventListener('click', () => {
      log('warning_action', email.id, { action: 'continue' });
      closeModal();
      followLink(email);
    });
  }

  // ---------- portal (the independent check) ----------
  function openPortal(source) {
    log('portal_open', S.current, { source: source });
    S.view = 'portal';
    const P = D.PORTAL;
    const notices = P.notices.map(n => `<li><span>${esc(n.title)}</span><span class="muted">${esc(n.due)}</span></li>`).join('');
    app.innerHTML = `
      ${topBar('portal')}
      <main class="portal">
        <div class="fake-address"><span class="lock" aria-hidden="true"></span>https://${esc(D.UNIVERSITY.portalHost)}</div>
        <div class="portal-head">
          <h1>${esc(D.UNIVERSITY.name)} student portal</h1>
          <button class="btn" id="back-mail">&larr; Back to mail</button>
        </div>
        <div class="portal-grid">
          <section class="card"><h2>Account status</h2><p class="status-ok">${esc(P.accountStatus)}</p>
            <p class="muted small">No suspension or restriction is scheduled for your account.</p></section>
          <section class="card"><h2>Mailbox</h2><p class="big">${esc(P.mailbox)}</p></section>
          <section class="card"><h2>Sign-in activity</h2><p class="big">${esc(P.security)}</p></section>
          <section class="card wide"><h2>Actions needed</h2><ul class="notices">${notices}</ul>
            <p class="muted small">Every genuine request from the university about your account is listed here.</p></section>
        </div>
      </main>`;
    wireTopBar();
    document.getElementById('back-mail').addEventListener('click', () => { log('portal_close', S.current); renderMail(); });
  }

  // ---------- modal plumbing ----------
  let lastFocus = null;
  function openModal(html) {
    lastFocus = document.activeElement;
    modalRoot.innerHTML = `<div class="backdrop">${html}</div>`;
    const first = modalRoot.querySelector('button');
    if (first) first.focus();
    document.addEventListener('keydown', escClose);
  }
  function closeModal() {
    modalRoot.innerHTML = '';
    document.removeEventListener('keydown', escClose);
    if (lastFocus && document.body.contains(lastFocus)) lastFocus.focus();
  }
  function escClose(e) {
    if (e.key !== 'Escape') return;
    const back = document.getElementById('w-back') || document.getElementById('ext-back') || document.getElementById('f-cancel');
    if (back) back.click();
  }

  // ---------- finish and debrief ----------
  function confirmFinish() {
    const pending = D.EMAILS.filter(e => e.role === 'target' && !S.decision[e.id]).length;
    if (!pending) return finish();
    openModal(`
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="f-title">
        <h2 id="f-title">Finish now?</h2>
        <p>${pending} account email${pending > 1 ? 's have' : ' has'} no decision yet (report, delete or keep).</p>
        <div class="modal-actions">
          <button class="btn primary" id="f-cancel">Back to the inbox</button>
          <button class="btn" id="f-ok">Finish anyway</button>
        </div>
      </div>`);
    document.getElementById('f-cancel').addEventListener('click', closeModal);
    document.getElementById('f-ok').addEventListener('click', () => { closeModal(); finish(); });
  }

  function finish() {
    log('session_end');
    const metrics = L.computeMetrics(S.log.events, D.EMAILS);
    const record = {
      participant: S.participant,
      condition: S.condition,
      explanationSource: S.explanationSource,
      startedAt: S.startedAt,
      events: S.log.events,
      metrics: metrics
    };
    const saved = saveSession(record);
    renderDebrief(record, saved);
  }

  function yesNo(v) { return v ? 'Yes' : 'No'; }

  function renderDebrief(record, saved) {
    const m = record.metrics;
    const rows = m.perEmail.map(r => {
      const e = emailById(r.emailId);
      return `<tr>
        <td>${esc(e.subject)}</td>
        <td><span class="tag ${r.truth}">${r.truth === 'phishing' ? 'Phishing' : 'Genuine'}</span></td>
        <td>${r.aiFlagged ? 'Flagged' : 'Not flagged'}${r.aiCorrect ? '' : ' <strong>(AI wrong)</strong>'}</td>
        <td>${r.finalDecision === 'none' ? '&ndash;' : esc(r.finalDecision)}${r.followedLink ? ', followed link' : ''}</td>
      </tr>`;
    }).join('');
    const s = m.summary;
    app.innerHTML = `
      <main class="debrief">
        <section class="card">
          <p class="eyebrow">Thank you</p>
          <h1>What was really in the inbox</h1>
          <p>Three account emails were phishing and three were genuine. The AI was wrong on purpose twice:
             it flagged the genuine MFA email and missed the “Unusual sign-in” phishing email.</p>
          <p><strong>The reliable check:</strong> open the student portal yourself, from a bookmark or by typing its address. If the university really needs you to act, it will be listed there.</p>
          <table class="results"><thead><tr><th>Email</th><th>Really</th><th>AI said</th><th>You</th></tr></thead><tbody>${rows}</tbody></table>
        </section>
        <section class="card researcher">
          <h2>Researcher panel</h2>
          <p class="muted small">Participant ${esc(record.participant)} &middot; condition ${record.condition === 'explained' ? 'B (AI explanation)' : 'A (generic warning)'} &middot; explanations: ${esc(record.explanationSource)}${saved ? ` &middot; saved (${saved} on this device)` : ' &middot; not saved (browser storage unavailable)'}</p>
          <dl class="metrics">
            <div><dt>Unsafe link choices</dt><dd>${s.unsafeLinkChoices}</dd></div>
            <div><dt>Independent portal checks</dt><dd>${s.independentVerifications} / ${s.targetEmails}</dd></div>
            <div><dt>Genuine notices rejected</dt><dd>${s.genuineNoticesRejected}</dd></div>
            <div><dt>Correct decisions</dt><dd>${s.correctDecisions} / ${s.targetEmails}</dd></div>
            <div><dt>Mean decision time</dt><dd>${s.meanDecisionTimeS === null ? '&ndash;' : s.meanDecisionTimeS + ' s'}</dd></div>
            <div><dt>False alarm handled</dt><dd>${s.falseAlarmHandledCorrectly === null ? 'not opened' : yesNo(s.falseAlarmHandledCorrectly)}</dd></div>
            <div><dt>Missed phishing handled</dt><dd>${s.missedPhishingHandledCorrectly === null ? 'not opened' : yesNo(s.missedPhishingHandledCorrectly)}</dd></div>
          </dl>
          <div class="modal-actions left">
            <button class="btn" id="dl-json">Download session (JSON)</button>
            <button class="btn" id="dl-csv">Download session (CSV)</button>
            <button class="btn" id="dl-all">Download all sessions (CSV)</button>
            <button class="btn primary" id="next">Next participant</button>
          </div>
        </section>
      </main>`;
    document.getElementById('dl-json').addEventListener('click', () => download(`verifyfirst-${record.participant}.json`, JSON.stringify(record, null, 2), 'application/json'));
    document.getElementById('dl-csv').addEventListener('click', () => download(`verifyfirst-${record.participant}.csv`, L.toCSV(record, record.metrics), 'text/csv'));
    document.getElementById('dl-all').addEventListener('click', () => {
      const all = loadSessions();
      const csv = all.map((r, i) => { const c = L.toCSV(r, r.metrics); return i === 0 ? c : c.split('\n').slice(1).join('\n'); }).join('\n');
      download('verifyfirst-all-sessions.csv', csv || L.toCSV(record, record.metrics), 'text/csv');
    });
    document.getElementById('next').addEventListener('click', () => { S = null; renderStart(); });
  }

  // Exposed for automated walkthroughs (scripts/capture_screenshots.mjs).
  window.VerifyFirst = { state: () => S, metrics: () => S && L.computeMetrics(S.log.events, D.EMAILS) };

  detectLive().then(v => { liveAvailable = v; renderStart(); });
})();
