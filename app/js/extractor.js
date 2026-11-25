/*
 * VerifyFirst — evidence extractor (implemented, deterministic).
 *
 * Turns an email into checkable evidence: where the link really goes, whether the
 * sender's domain belongs to the university, and which urgency / sign-in phrases
 * appear. It does NOT decide whether an email is phishing; the (simulated)
 * classifier flag does that. The evidence feeds the explanation, so the warning can
 * point at something the student can check for themselves.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VFExtractor = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const SECOND_LEVEL = ['ac.uk', 'co.uk', 'org.uk', 'gov.uk', 'nhs.uk'];

  const URGENCY = [
    /within\s+\d+\s+hours?/i,
    /\bimmediately\b/i,
    /\burgent(ly)?\b/i,
    /\bby (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\bsuspen(d|ded|sion)\b/i,
    /\bdeactivat(e|ed|ion)\b/i,
    /\blose access\b/i,
    /\brestricted\b/i
  ];

  const SIGN_IN = [
    /\bpassword\b/i,
    /\bsign[- ]?in\b/i,
    /\blog[- ]?in\b/i,
    /\bverify\b/i,
    /\bconfirm your identity\b/i
  ];

  function hostOf(url) {
    try { return new URL(url).hostname.toLowerCase(); } catch (e) { return null; }
  }

  // Approximate registrable domain ("eTLD+1"), enough for the scenario set.
  function registrableDomain(host) {
    const parts = host.split('.');
    const lastTwo = parts.slice(-2).join('.');
    if (SECOND_LEVEL.includes(lastTwo) && parts.length >= 3) return parts.slice(-3).join('.');
    return lastTwo;
  }

  function belongsTo(host, domain) {
    return host === domain || host.endsWith('.' + domain);
  }

  // A look-alike mentions the university name or domain but is not the university.
  function isLookalike(host, domain) {
    const name = domain.split('.')[0];
    return !belongsTo(host, domain) && host.includes(name);
  }

  function matches(text, patterns) {
    const found = [];
    for (const p of patterns) {
      const m = text.match(p);
      if (m && !found.includes(m[0].toLowerCase())) found.push(m[0].toLowerCase());
    }
    return found;
  }

  function extract(email, university) {
    const domain = university.domain;
    const evidence = [];

    if (email.link) {
      const host = hostOf(email.link.href);
      const official = host ? belongsTo(host, domain) : false;
      evidence.push({
        type: 'link_domain',
        status: official ? 'match' : 'mismatch',
        host: host,
        realDomain: host ? registrableDomain(host) : null,
        expected: domain,
        lookalike: host ? isLookalike(host, domain) : false,
        startsWithOfficial: host ? (!official && host.startsWith(domain)) : false
      });
    }

    const senderDomain = (email.from.address.split('@')[1] || '').toLowerCase();
    evidence.push({
      type: 'sender_domain',
      status: belongsTo(senderDomain, domain) ? 'match' : 'mismatch',
      host: senderDomain,
      expected: domain,
      note: 'Sender addresses can be faked, so a matching sender is weak evidence.'
    });

    const text = [email.subject].concat(email.body, email.link ? [email.link.text] : []).join(' ');
    const urgency = matches(text, URGENCY);
    if (urgency.length) evidence.push({ type: 'urgency', phrases: urgency });
    const signIn = matches(text, SIGN_IN);
    if (signIn.length) evidence.push({ type: 'sign_in_request', phrases: signIn });

    return { emailId: email.id, evidence: evidence, checkable: pickCheckable(evidence) };
  }

  // The ONE detail the warning asks the student to check. A mismatching link wins,
  // because it is the strongest signal and the student can check it in seconds.
  // If the link matches, that counter-evidence is surfaced instead.
  function pickCheckable(evidence) {
    const link = evidence.find(e => e.type === 'link_domain');
    const sender = evidence.find(e => e.type === 'sender_domain');
    if (link && link.status === 'mismatch') return link;
    if (sender && sender.status === 'mismatch') return sender;
    return link || sender || null;
  }

  return { extract, hostOf, registrableDomain, belongsTo, isLookalike };
});
