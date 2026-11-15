"""Strip # comments from .py files under workers/ (and e2e/ mobile/ if present)."""
from __future__ import annotations

import io
import tokenize
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCAN = [ROOT / "workers", ROOT / "e2e", ROOT / "mobile"]
SKIP_DIR = {
    "node_modules",
    ".next",
    "dist",
    "__pycache__",
    ".git",
    ".venv",
    "venv",
    "site-packages",
}


def strip_file(path: Path) -> bool:
    raw = path.read_bytes()
    out_tokens: list[tokenize.TokenInfo] = []
    try:
        for tok in tokenize.tokenize(io.BytesIO(raw).readline):
            if tok.type == tokenize.COMMENT:
                continue
            if tok.type == tokenize.ENCODING:
                continue
            out_tokens.append(tok)
    except tokenize.TokenError:
        return False
    result = tokenize.untokenize(out_tokens)
    if isinstance(result, bytes):
        text = result.decode("utf-8")
    else:
        text = result
    if text != raw.decode("utf-8"):
        path.write_text(text, encoding="utf-8", newline="\n")
        return True
    return False


def walk(base: Path, changed: list[str]) -> None:
    if not base.is_dir():
        return
    for child in base.iterdir():
        if child.is_dir():
            if child.name in SKIP_DIR:
                continue
            walk(child, changed)
        elif child.suffix == ".py":
            if strip_file(child):
                changed.append(str(child.relative_to(ROOT)).replace("\\", "/"))


def main() -> None:
    changed: list[str] = []
    for root in SCAN:
        if root.exists():
            walk(root, changed)
    print(f"python_files_changed={len(changed)}")
    for p in changed:
        print(p)


if __name__ == "__main__":
    main()