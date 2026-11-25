// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../app/js/data.js');
const X = require('../app/js/extractor.js');
const L = require('../app/js/logger.js');

const byId = id => D.EMAILS.find(e => e.id === id);
const extract = id => X.extract(byId(id), D.UNIVERSITY);

test('registrable domain handles .ac.uk and look-alike prefixes', () => {
  assert.equal(X.registrableDomain('portal.northvale.ac.uk'), 'northvale.ac.uk');
  assert.equal(X.registrableDomain('northvale.ac.uk.mailbox-restore.net'), 'mailbox-restore.net');
  assert.equal(X.registrableDomain('northvale-support.com'), 'northvale-support.com');
});

test('P1: link to northvale-support.com is a mismatch and a look-alike', () => {
  const r = extract('P1');
  assert.equal(r.checkable.type, 'link_domain');
  assert.equal(r.checkable.status, 'mismatch');
  assert.equal(r.checkable.realDomain, 'northvale-support.com');
  assert.equal(r.checkable.lookalike, true);
  assert.ok(r.evidence.find(e => e.type === 'urgency').phrases.includes('within 24 hours'));
});

test('P2: address that starts with the university domain is caught', () => {
  const r = extract('P2');
  assert.equal(r.checkable.status, 'mismatch');
  assert.equal(r.checkable.realDomain, 'mailbox-restore.net');
  assert.equal(r.checkable.startsWithOfficial, true);
  // The sender address is spoofed to look official: weak evidence, reported as a match.
  assert.equal(r.evidence.find(e => e.type === 'sender_domain').status, 'match');
});

test('G2 (false alarm): link matches, so the counter-evidence is the checkable detail', () => {
  const r = extract('G2');
  assert.equal(r.checkable.type, 'link_domain');
  assert.equal(r.checkable.status, 'match');
  assert.ok(r.evidence.some(e => e.type === 'urgency'));
  assert.ok(r.evidence.some(e => e.type === 'sign_in_request'));
});

test('P3 (missed by the classifier) still has mismatch evidence available', () => {
  const r = extract('P3');
  assert.equal(r.checkable.status, 'mismatch');
  assert.equal(r.checkable.realDomain, 'secure-northvale.com');
});

test('scenario set: 3 phishing + 3 genuine targets, one false alarm and one miss', () => {
  const targets = D.EMAILS.filter(e => e.role === 'target');
  assert.equal(targets.filter(e => e.truth === 'phishing').length, 3);
  assert.equal(targets.filter(e => e.truth === 'genuine').length, 3);
  const falseAlarms = targets.filter(e => e.truth === 'genuine' && e.flag.flagged).map(e => e.id);
  const misses = targets.filter(e => e.truth === 'phishing' && !e.flag.flagged).map(e => e.id);
  assert.deepEqual(falseAlarms, ['G2']);
  assert.deepEqual(misses, ['P3']);
  // Every flagged email has a cached explanation.
  targets.filter(e => e.flag.flagged).forEach(e => assert.ok(D.EXPLANATIONS[e.id], e.id));
});

test('metrics: unsafe link, verification, rejection and decision time', () => {
  let t = 0;
  const log = L.createLog(() => t);
  const at = (ms, type, id) => { t = ms; log.log(type, id); };
  at(1000, 'email_open', 'P1');
  at(4000, 'link_click', 'P1');
  at(4100, 'warning_shown', 'P1');
  at(6000, 'portal_open', 'P1');
  at(9000, 'report', 'P1');           // safe, verified, 8 s
  at(10000, 'email_open', 'G2');
  at(12000, 'link_click', 'G2');
  at(12100, 'warning_shown', 'G2');
  at(13000, 'delete', 'G2');          // false alarm obeyed: genuine notice rejected
  at(14000, 'email_open', 'P3');
  at(15000, 'link_followed', 'P3');   // missed phishing: unsafe link
  const m = L.computeMetrics(log.events, D.EMAILS);
  const row = id => m.perEmail.find(r => r.emailId === id);

  assert.equal(row('P1').verifiedInPortal, true);
  assert.equal(row('P1').correct, true);
  assert.equal(row('P1').decisionTimeS, 8);
  assert.equal(row('G2').rejectedGenuine, true);
  assert.equal(row('G2').correct, false);
  assert.equal(row('P3').unsafeLink, true);
  assert.equal(m.summary.unsafeLinkChoices, 1);
  assert.equal(m.summary.independentVerifications, 1);
  assert.equal(m.summary.genuineNoticesRejected, 1);
  assert.equal(m.summary.falseAlarmHandledCorrectly, false);
  assert.equal(m.summary.missedPhishingHandledCorrectly, false);
  assert.equal(row('G1').opened, false);
  assert.equal(row('G1').decisionTimeS, null);
});

test('AI-error measures are empty when those emails were never opened', () => {
  const m = L.computeMetrics([{ t: 0, type: 'email_open', emailId: 'P1' }], D.EMAILS);
  assert.equal(m.summary.falseAlarmHandledCorrectly, null);
  assert.equal(m.summary.missedPhishingHandledCorrectly, null);
});

test('CSV has a header and one row per target email', () => {
  const m = L.computeMetrics([], D.EMAILS);
  const csv = L.toCSV({ participant: 'P01', condition: 'generic' }, m).split('\n');
  assert.equal(csv.length, 7);
  assert.ok(csv[0].startsWith('participant,condition,emailId'));
});

// ---------- success criteria (app/js/criteria.js) ----------
const C = require('../app/js/criteria.js');

test('every cached explanation passes the program-checked success criteria', () => {
  Object.keys(D.EXPLANATIONS).forEach(id => {
    const r = C.check(D.EXPLANATIONS[id], extract(id));
    assert.equal(r.pass, true, id + ': ' + r.failures.join('; '));
  });
});

test('criteria catch an explanation that copies the wrong domain (C3)', () => {
  const copied = Object.assign({}, D.EXPLANATIONS.P1); // P1 text reused for P2
  const r = C.check(copied, extract('P2'));
  assert.equal(r.pass, false);
  assert.ok(r.failures.some(f => f.startsWith('C3')));
});

test('criteria catch a false alarm explained as certain phishing (C4)', () => {
  const r = C.check({ headline: 'Phishing email', summary: 'The link goes to portal.northvale.ac.uk and the email is urgent.', action: 'Open the student portal yourself.' }, extract('G2'));
  assert.ok(r.failures.some(f => f.startsWith('C4')));
});

test('criteria catch a password request, a missing portal step and overlong text', () => {
  const long = Array(50).fill('word').join(' ');
  const r = C.check({ headline: 'Check this', summary: long + ' northvale-support.com', action: 'Please enter your password to continue.' }, extract('P1'));
  const codes = r.failures.map(f => f.slice(0, 2));
  ['C2', 'C5', 'C7'].forEach(code => assert.ok(codes.includes(code), code));
});
