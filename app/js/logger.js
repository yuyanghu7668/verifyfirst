/*
 * VerifyFirst — event log and outcome measures (implemented).
 *
 * Measures follow the Assignment 1 plan: unsafe link choices, independent
 * verification, rejection of genuine notices and decision time.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VFLogger = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const DECISIONS = ['report', 'delete', 'keep'];

  function createLog(now) {
    const clock = now || (() => Date.now());
    const start = clock();
    const events = [];
    return {
      events: events,
      log(type, emailId, detail) {
        const e = { t: clock() - start, type: type, emailId: emailId || null };
        if (detail !== undefined) e.detail = detail;
        events.push(e);
        return e;
      }
    };
  }

  function computeMetrics(events, emails) {
    const perEmail = emails.filter(e => e.role === 'target').map(email => {
      const mine = events.filter(e => e.emailId === email.id);
      const has = type => mine.some(e => e.type === type);
      const firstOpen = mine.find(e => e.type === 'email_open');
      const firstDecision = mine.find(e => DECISIONS.includes(e.type) || e.type === 'link_followed');
      const decisions = mine.filter(e => DECISIONS.includes(e.type));
      const finalDecision = decisions.length ? decisions[decisions.length - 1].type : 'none';
      const followedLink = has('link_followed');
      const phishing = email.truth === 'phishing';
      const rejected = !phishing && (finalDecision === 'report' || finalDecision === 'delete');
      const accepted = !phishing && (finalDecision === 'keep' || followedLink);
      const correct = phishing
        ? (!followedLink && (finalDecision === 'report' || finalDecision === 'delete'))
        : (accepted && !rejected);

      return {
        emailId: email.id,
        truth: email.truth,
        aiFlagged: !!email.flag.flagged,
        aiCorrect: !!email.flag.flagged === phishing,
        opened: !!firstOpen,
        hoveredLink: has('link_hover'),
        warningShown: has('warning_shown'),
        warningExpanded: has('warning_expand'),
        verifiedInPortal: has('portal_open'),
        followedLink: followedLink,
        unsafeLink: phishing && followedLink,
        finalDecision: finalDecision,
        rejectedGenuine: rejected,
        correct: correct,
        decisionTimeS: firstOpen && firstDecision ? round((firstDecision.t - firstOpen.t) / 1000) : null
      };
    });

    const times = perEmail.map(r => r.decisionTimeS).filter(v => v !== null);
    const summary = {
      targetEmails: perEmail.length,
      unsafeLinkChoices: count(perEmail, r => r.unsafeLink),
      independentVerifications: count(perEmail, r => r.verifiedInPortal),
      genuineNoticesRejected: count(perEmail, r => r.rejectedGenuine),
      correctDecisions: count(perEmail, r => r.correct),
      meanDecisionTimeS: times.length ? round(times.reduce((a, b) => a + b, 0) / times.length) : null,
      // null when the participant never opened that email
      falseAlarmHandledCorrectly: pick(perEmail, r => !r.aiCorrect && r.aiFlagged, r => r.opened ? r.correct : null),
      missedPhishingHandledCorrectly: pick(perEmail, r => !r.aiCorrect && !r.aiFlagged, r => r.opened ? r.correct : null)
    };
    return { perEmail: perEmail, summary: summary };
  }

  function toCSV(session, metrics) {
    const cols = ['participant', 'condition', 'emailId', 'truth', 'aiFlagged', 'aiCorrect', 'opened',
      'hoveredLink', 'warningShown', 'warningExpanded', 'verifiedInPortal', 'followedLink', 'unsafeLink',
      'finalDecision', 'rejectedGenuine', 'correct', 'decisionTimeS'];
    const rows = metrics.perEmail.map(r => cols.map(c => {
      if (c === 'participant') return session.participant;
      if (c === 'condition') return session.condition;
      return r[c] === null ? '' : String(r[c]);
    }).join(','));
    return [cols.join(',')].concat(rows).join('\n');
  }

  function count(list, fn) { return list.filter(fn).length; }
  function pick(list, find, value) { const r = list.find(find); return r ? value(r) : null; }
  function round(n) { return Math.round(n * 10) / 10; }

  return { createLog, computeMetrics, toCSV, DECISIONS };
});
