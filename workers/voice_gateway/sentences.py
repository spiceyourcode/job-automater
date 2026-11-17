"""Split streaming LLM tokens into speakable sentences."""

from __future__ import annotations

import re

_SENTENCE_END = re.compile(r'(?<=[.!?])\s+')


def flush_sentences(buffer: str, *, max_chars: int = 160) -> tuple[list[str], str]:
    """Return complete sentences extracted from buffer; remainder stays in buffer."""
    if not buffer:
        return [], ""
    out: list[str] = []
    rest = buffer
    while True:
        m = _SENTENCE_END.search(rest)
        if m:
            head = rest[: m.start() + 1].strip()
            rest = rest[m.end() :].lstrip()
            if head:
                out.append(head)
            continue
        if len(rest) >= max_chars:
            cut = rest.rfind(" ", 0, max_chars)
            if cut < 24:
                cut = max_chars
            chunk = rest[:cut].strip()
            rest = rest[cut:].lstrip()
            if chunk:
                out.append(chunk)
            continue
        break
    return out, rest


def finalize_sentence_tail(tail: str) -> list[str]:
    t = tail.strip()
    return [t] if t else []