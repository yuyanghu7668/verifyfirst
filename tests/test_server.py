"""Tests for the optional live-explanation server. Run: python -m unittest discover tests"""
import io
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "server"))
import server  # noqa: E402

EVIDENCE = {
    "emailId": "P1",
    "confidence": "high",
    "evidence": {
        "evidence": [{"type": "link_domain", "status": "mismatch", "host": "northvale-support.com"}],
        "checkable": {"type": "link_domain", "status": "mismatch", "host": "northvale-support.com"},
    },
}


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def fake_opener(text):
    def opener(request, timeout):
        body = json.loads(request.data)
        assert request.get_header("X-api-key") == "test-key"
        assert body["messages"][0]["role"] == "user"
        reply = {"content": [{"type": "text", "text": text}]}
        return FakeResponse(json.dumps(reply).encode())
    return opener


class PromptTests(unittest.TestCase):
    def test_prompt_contains_evidence_and_domains(self):
        prompt = server.build_prompt(EVIDENCE)
        self.assertIn("northvale-support.com", prompt)
        self.assertIn("portal.northvale.ac.uk", prompt)
        self.assertNotIn("{EVIDENCE_JSON}", prompt)
        self.assertNotIn("<!--", prompt)
        for heading in ("## Task", "## Audience", "## Constraints", "## Example", "## Success criteria", "## Output format"):
            self.assertIn(heading, prompt)


class ParseTests(unittest.TestCase):
    def test_valid_json_is_accepted(self):
        out = server.parse_explanation('Here: {"headline": "H", "summary": "S", "action": "A"}')
        self.assertEqual(out, {"headline": "H", "summary": "S", "action": "A"})

    def test_missing_key_is_rejected(self):
        with self.assertRaises(ValueError):
            server.parse_explanation('{"headline": "H", "summary": "S"}')

    def test_password_request_is_rejected(self):
        with self.assertRaises(ValueError):
            server.parse_explanation('{"headline": "H", "summary": "Please enter your password", "action": "A"}')


class CallTests(unittest.TestCase):
    def test_call_llm_with_fake_api(self):
        text = '{"headline": "Check the link", "summary": "It goes to northvale-support.com.", "action": "Open the portal yourself."}'
        out = server.call_llm(server.build_prompt(EVIDENCE), "test-key", "test-model", opener=fake_opener(text))
        self.assertEqual(out["headline"], "Check the link")


if __name__ == "__main__":
    unittest.main()
