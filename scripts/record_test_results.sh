#!/usr/bin/env sh
# Runs every test and writes the results to docs/test-results.md.
# Needs Node 18+, Python 3 and Playwright (npm install && npx playwright install chromium).
set -e
cd "$(dirname "$0")/.."
OUT=docs/test-results.md
{
  echo "# Test results"
  echo
  echo "Recorded from real runs on $(date -u +'%d %B %Y') (UTC). Regenerate with \`scripts/record_test_results.sh\`."
  echo
  echo "## JavaScript unit tests (\`node --test\`)"
  echo
  echo '```text'
  node --test 2>&1 | grep -E "^(ok|not ok|# (tests|pass|fail))"
  echo '```'
  echo
  echo "## Python unit tests (\`python3 -m unittest discover tests -v\`)"
  echo
  echo '```text'
  python3 -m unittest discover tests -v 2>&1 | grep -E "\.\.\. |^Ran|^OK|FAILED"
  echo '```'
  echo
  echo "## End-to-end walkthrough (\`npm run walkthrough\`)"
  echo
  echo '```text'
  node scripts/capture_screenshots.cjs 2>&1 | tail -1
  echo '```'
} > "$OUT"
echo "Wrote $OUT"
