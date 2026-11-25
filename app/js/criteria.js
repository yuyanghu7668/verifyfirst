/*
 * VerifyFirst — success criteria for an explanation (implemented).
 *
 * Written before the prompt, as a task specification's success criteria.
 * A JSON schema only guarantees the SHAPE of the model's answer, so these checks
 * test what a program can test about its CONTENT. An explanation that fails any
 * check is not shown; the app falls back to the reviewed cached text.
 * Criterion C6 (plain, calm language) needs a human reviewer and is not checked here.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VFCriteria = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const LIMITS = { headline: 10, summary: 45, action: 25 };
  const PASSWORD_REQUEST = /\b(enter|type|give|provide|send|confirm)\s+(in\s+)?(your\s+)?password/i;

  function words(s) { return String(s || '').trim().split(/\s+/).filter(Boolean).length; }

  function check(exp, evidenceResult) {
    const failures = [];
    const c = evidenceResult && evidenceResult.checkable;

    // C1 shape: three non-empty text fields
    ['headline', 'summary', 'action'].forEach(k => {
      if (!exp || typeof exp[k] !== 'string' || !exp[k].trim()) failures.push('C1 missing ' + k);
    });
    if (failures.length) return { pass: false, failures: failures };

    // C2 length: short enough to read at the moment of action
    Object.keys(LIMITS).forEach(k => {
      if (words(exp[k]) > LIMITS[k]) failures.push(`C2 ${k} has ${words(exp[k])} words (max ${LIMITS[k]})`);
    });

    // C3 grounded: the summary names the checkable detail that code extracted
    if (c) {
      const detail = c.type === 'link_domain' && c.status === 'mismatch' ? c.realDomain : c.host;
      if (detail && !exp.summary.toLowerCase().includes(detail.toLowerCase())) {
        failures.push('C3 summary does not name ' + detail);
      }
    }

    // C4 honest about conflicting evidence: a matching link must be called a possible false alarm
    if (c && c.status === 'match' && !/false alarm/i.test(exp.summary + ' ' + exp.headline)) {
      failures.push('C4 matching evidence but no "false alarm" wording');
    }

    // C5 points to the independent check
    if (!/portal/i.test(exp.action)) failures.push('C5 action does not mention the portal');

    // C6 is human-reviewed. C7 safety: never asks for a password
    const all = [exp.headline, exp.summary, exp.action].join(' ');
    if (PASSWORD_REQUEST.test(all)) failures.push('C7 asks for a password');

    return { pass: failures.length === 0, failures: failures };
  }

  return { check, LIMITS };
});
