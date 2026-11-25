/*
 * VerifyFirst — scenario data.
 *
 * Everything here is fictional. "Northvale University" and northvale.ac.uk are
 * invented so the simulation never imitates a real institution.
 *
 * truth : what the email really is (genuine | phishing)
 * flag  : what the simulated AI classifier says. Flags are SCRIPTED (Wizard-of-Oz
 *         style) so that every participant meets the same deliberate AI errors:
 *           G2 = false alarm (genuine email flagged), P3 = miss (phishing not flagged).
 * role  : target emails are scored; filler emails only make the inbox realistic.
 */
(function (root, factory) {
  const data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.VF_DATA = data;
})(typeof self !== 'undefined' ? self : this, function () {
  const UNIVERSITY = {
    name: 'Northvale University',
    domain: 'northvale.ac.uk',
    portalHost: 'portal.northvale.ac.uk'
  };

  const EMAILS = [
    {
      id: 'P1', role: 'target', truth: 'phishing',
      from: { name: 'IT Service Desk', address: 'it-servicedesk@northvale-support.com' },
      subject: 'Account suspension notice: action required within 24 hours',
      received: '10:41',
      body: [
        'Dear Student,',
        'Our records show that your Northvale University account failed a routine security check. To prevent suspension, you must verify your account within 24 hours.',
        '{link}',
        'If you do not verify, your access to email, the learning platform and the student portal will be suspended.',
        'IT Service Desk\nNorthvale University'
      ],
      link: { text: 'Verify my account', href: 'https://northvale-support.com/account/verify' },
      flag: { flagged: true, confidence: 'high' }
    },
    {
      id: 'F2', role: 'filler', truth: 'genuine',
      from: { name: 'School of Computer Science', address: 'cs-teaching@northvale.ac.uk' },
      subject: 'Week 9 lab moved to Room 2.14',
      received: '10:05',
      body: [
        'Hi all,',
        'This week’s Human-Computer Interaction lab will take place in Room 2.14 instead of the usual lab. The time is unchanged.',
        'Teaching Support Office'
      ],
      link: null,
      flag: { flagged: false }
    },
    {
      id: 'G2', role: 'target', truth: 'genuine',
      from: { name: 'IT Services', address: 'noreply@northvale.ac.uk' },
      subject: 'Set up multi-factor authentication by Friday to keep access',
      received: '09:47',
      body: [
        'Dear student,',
        'From Monday, all student accounts must use multi-factor authentication (MFA). If you have not set it up by Friday 28 November, you will lose access to university systems until you do.',
        'Sign in to the student portal and follow the steps. It takes about five minutes and you will need your phone.',
        '{link}',
        'IT Services\nNorthvale University'
      ],
      link: { text: 'Set up MFA now', href: 'https://portal.northvale.ac.uk/security/mfa' },
      // Deliberate FALSE ALARM: urgent deadline + sign-in request trip the classifier.
      flag: { flagged: true, confidence: 'medium' }
    },
    {
      id: 'P2', role: 'target', truth: 'phishing',
      from: { name: 'Northvale Mail Admin', address: 'mail-admin@northvale.ac.uk' },
      subject: 'Mailbox storage full: verify now to avoid deactivation',
      received: 'Yesterday',
      body: [
        'Your mailbox has reached its storage limit. New messages are being held and your account will be deactivated if you do not verify your mailbox.',
        '{link}',
        'Thank you,\nMail Administration'
      ],
      link: { text: 'Restore my mailbox', href: 'https://northvale.ac.uk.mailbox-restore.net/login' },
      flag: { flagged: true, confidence: 'high' }
    },
    {
      id: 'G3', role: 'target', truth: 'genuine',
      from: { name: 'Student Registry', address: 'registry@northvale.ac.uk' },
      subject: 'Confirm your registration to keep your account active',
      received: 'Yesterday',
      body: [
        'Dear student,',
        'Registration for the 2026/27 academic year closes on 30 November. If you have not confirmed your registration by then, your university account may be restricted.',
        'You can confirm your registration in the student portal:',
        '{link}',
        'Student Registry'
      ],
      link: { text: 'Go to the student portal', href: 'https://portal.northvale.ac.uk/registration' },
      flag: { flagged: false }
    },
    {
      id: 'F1', role: 'filler', truth: 'genuine',
      from: { name: 'Library Services', address: 'library@northvale.ac.uk' },
      subject: 'Your reserved book is ready to collect',
      received: 'Yesterday',
      body: [
        'Hello,',
        'The item you reserved is ready to collect from the Main Library hold shelf. It will be kept for you until Friday.',
        'Library Services'
      ],
      link: null,
      flag: { flagged: false }
    },
    {
      id: 'P3', role: 'target', truth: 'phishing',
      from: { name: 'Northvale Security', address: 'alerts@northvale-security.com' },
      subject: 'Unusual sign-in detected: confirm your identity',
      received: 'Mon',
      body: [
        'We detected a sign-in to your university account from a new device.',
        'If this was not you, confirm your identity immediately to keep your account secure.',
        '{link}',
        'Northvale Security Team'
      ],
      link: { text: 'Confirm it was me', href: 'https://secure-northvale.com/verify-identity' },
      // Deliberate MISS: the classifier does not flag this phishing email.
      flag: { flagged: false }
    },
    {
      id: 'G1', role: 'target', truth: 'genuine',
      from: { name: 'IT Services', address: 'noreply@northvale.ac.uk' },
      subject: 'Your password expires in 7 days',
      received: 'Mon',
      body: [
        'Dear student,',
        'Your university password will expire in 7 days. You can change it at any time in the student portal.',
        '{link}',
        'IT Services will never ask for your password by email.',
        'IT Services'
      ],
      link: { text: 'Change password in the portal', href: 'https://portal.northvale.ac.uk/account/password' },
      flag: { flagged: false }
    }
  ];

  /*
   * Cached explanations for the AI-explanation condition.
   * Generated with an LLM from the evidence produced by extractor.js, then reviewed,
   * frozen and checked against the success criteria in criteria.js (see the unit tests),
   * so every participant reads identical text (experimental control).
   * Shortened after the pilot (P02, P03 found the first version too long).
   * Live generation is available through server/server.py (see README).
   */
  const EXPLANATIONS = {
    P1: {
      headline: 'This link does not go to the university',
      summary: 'The link goes to northvale-support.com, not to a northvale.ac.uk address.',
      action: 'Don\u2019t use the link. Check the student portal yourself.'
    },
    P2: {
      headline: 'This link hides its real address',
      summary: 'The address starts with \u201cnorthvale.ac.uk\u201d but really goes to mailbox-restore.net.',
      action: 'Don\u2019t use the link. Check your mailbox in the student portal yourself.'
    },
    G2: {
      headline: 'Check this one before you act',
      summary: 'Flagged for its deadline and sign-in request, but the link goes to portal.northvale.ac.uk, a university address. This may be a false alarm.',
      action: 'Check the student portal yourself to see whether this notice is listed.'
    }
  };

  const GENERIC_WARNING = {
    headline: 'Warning: this email may be a phishing attempt',
    summary: 'Phishing emails try to steal your login details. Be careful before opening links in this message.'
  };

  // What the independent check (the real portal) shows. Genuine notices appear here;
  // claims made only by phishing emails do not.
  const PORTAL = {
    accountStatus: 'Active',
    notices: [
      { id: 'G2', title: 'Set up multi-factor authentication', due: 'by Friday 28 November' },
      { id: 'G3', title: 'Confirm your 2026/27 registration', due: 'by 30 November' },
      { id: 'G1', title: 'Password expires in 7 days', due: 'change any time' }
    ],
    mailbox: '3.8 GB of 50 GB used',
    security: 'No unusual sign-ins in the last 30 days'
  };

  return { UNIVERSITY, EMAILS, EXPLANATIONS, GENERIC_WARNING, PORTAL };
});
