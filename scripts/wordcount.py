"""Counts prose words in a Markdown file, skipping fenced code blocks and HTML comments."""
import re
import sys

def prose_words(text: str) -> int:
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    text = re.sub(r"<!--.*?-->", " ", text, flags=re.S)
    text = re.sub(r"`[^`]*`", "x", text)          # inline code counts as one word
    text = re.sub(r"\|\s*-+\s*(\|\s*-+\s*)*\|", " ", text)  # table separator rows
    text = re.sub(r"[#*|>\[\]()_]", " ", text)
    return len([w for w in text.split() if re.search(r"[A-Za-z0-9]", w)])

if __name__ == "__main__":
    print(prose_words(open(sys.argv[1], encoding="utf-8").read()))
