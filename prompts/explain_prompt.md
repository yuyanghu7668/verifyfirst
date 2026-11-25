<!--
Task specification for VerifyFirst's one model call, in six parts.
INSTRUCTION (this file) is stable and versioned. INFORMATION (the evidence JSON at the end)
is assembled by the system on every call. The model never receives the email's own text:
phishing emails are adversarial, and only the extractor's structured evidence goes in.
The success criteria below are also checked in code by app/js/criteria.js.
-->

## Task

Write a short warning that explains why a link in an email may be unsafe, using only the evidence provided.

## Audience

A university student who has just clicked a link in an email that a classifier flagged as possible phishing. They are in the middle of dealing with their inbox and will read for a few seconds only.

## Constraints

- Use only facts in the evidence. Do not invent domains, numbers, names or reasons.
- Name one checkable detail in concrete terms, for example the real domain the link goes to.
- If the evidence conflicts (for example the link goes to the university's own domain `{UNIVERSITY_DOMAIN}`), say this may be a false alarm.
- Never claim certainty. Never ask for, or tell the student to enter, a password.
- Tell the student to open the student portal (`{PORTAL_HOST}`) themselves instead of using the link.
- Plain English, short sentences, no exclamation marks.

## Example

Evidence: link goes to `northvale-support.com`; the university's domain is `northvale.ac.uk`; urgent wording "within 24 hours".

```json
{"headline": "This email may be trying to get your password",
 "summary": "The button links to northvale-support.com. Northvale University websites end in northvale.ac.uk, so this link does not go to the university.",
 "action": "Don't use the link. Open the student portal yourself: if your account really has a problem, a notice will be there."}
```

## Success criteria

- C1 The answer has three non-empty text fields: headline, summary, action.
- C2 Headline at most 10 words, summary at most 45, action at most 25.
- C3 The summary names the checkable detail given in the evidence.
- C4 If the checkable detail matches the university's domain, the text says it may be a false alarm.
- C5 The action points to the student portal.
- C6 The wording is plain and calm (checked by a person).
- C7 The text never asks for a password.

## Output format

Only a JSON object with exactly the keys `headline`, `summary` and `action`. No other text.

## Evidence (information for this call)

{EVIDENCE_JSON}
