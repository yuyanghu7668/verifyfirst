# Test results

Recorded from real runs on 25 November 2026 (UTC). Regenerate with `scripts/record_test_results.sh`.

## JavaScript unit tests (`node --test`)

```text
ok 1 - registrable domain handles .ac.uk and look-alike prefixes
ok 2 - P1: link to northvale-support.com is a mismatch and a look-alike
ok 3 - P2: address that starts with the university domain is caught
ok 4 - G2 (false alarm): link matches, so the counter-evidence is the checkable detail
ok 5 - P3 (missed by the classifier) still has mismatch evidence available
ok 6 - scenario set: 3 phishing + 3 genuine targets, one false alarm and one miss
ok 7 - metrics: unsafe link, verification, rejection and decision time
ok 8 - AI-error measures are empty when those emails were never opened
ok 9 - CSV has a header and one row per target email
ok 10 - every cached explanation passes the program-checked success criteria
ok 11 - criteria catch an explanation that copies the wrong domain (C3)
ok 12 - criteria catch a false alarm explained as certain phishing (C4)
ok 13 - criteria catch a password request, a missing portal step and overlong text
# tests 13
# pass 13
# fail 0
```

## Python unit tests (`python3 -m unittest discover tests -v`)

```text
test_call_llm_with_fake_api (test_server.CallTests.test_call_llm_with_fake_api) ... ok
test_missing_key_is_rejected (test_server.ParseTests.test_missing_key_is_rejected) ... ok
test_password_request_is_rejected (test_server.ParseTests.test_password_request_is_rejected) ... ok
test_valid_json_is_accepted (test_server.ParseTests.test_valid_json_is_accepted) ... ok
test_prompt_contains_evidence_and_domains (test_server.PromptTests.test_prompt_contains_evidence_and_domains) ... ok
Ran 5 tests in 0.001s
OK
```

## End-to-end walkthrough (`npm run walkthrough`)

```text
Walkthrough passed. Screenshots in docs/screens
```
