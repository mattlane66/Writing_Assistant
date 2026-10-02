#!/usr/bin/env python3
"""Build a standalone source ZIP for this product using only the standard library."""
import json
import os
from pathlib import Path
import stat
import sys
import tempfile
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED_DIRS = {".git", ".vercel", "node_modules", "dist", "coverage", "__pycache__", ".pytest_cache"}
REQUIRED = {
    "plugin.json", "package.json", "mcp.json", ".mcp.json",
    ".codex-plugin/plugin.json", "assets/icon.svg",
    "server/core.js", "server/stdio.js", "server/http.js",
    "public/diagnostic-widget.html", "skills/writing-diagnostic/SKILL.md",
}


def build(destination=None):
    manifest = json.loads((ROOT / "plugin.json").read_text(encoding="utf-8"))
    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    compatibility = json.loads((ROOT / ".codex-plugin/plugin.json").read_text(encoding="utf-8"))
    if manifest["name"] != "writing-diagnostic":
        raise ValueError("The product name must be writing-diagnostic.")
    version = manifest["version"]
    if package["version"] != version or compatibility["version"] != version:
        raise ValueError("The product versions disagree.")
    output = Path(destination).resolve() if destination else ROOT / "dist" / f"writing-diagnostic-plugin-v{version}.zip"
    files = []
    for file in sorted(ROOT.rglob("*")):
        relative = file.relative_to(ROOT)
        if any(part in EXCLUDED_DIRS or part.startswith(".env") for part in relative.parts):
            continue
        if file.name == ".DS_Store" or file.suffix in {".zip", ".pyc", ".log"}:
            continue
        if file.is_symlink():
            raise ValueError(f"Refusing to package a symlink: {relative}")
        if file.is_file():
            files.append((relative.as_posix(), file))
    names = {name for name, _ in files}
    missing = REQUIRED - names
    if missing:
        raise ValueError("Required product files are missing: " + ", ".join(sorted(missing)))
    output.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=".writing-diagnostic-", suffix=".zip", dir=output.parent)
    os.close(descriptor)
    temporary = Path(temporary_name)
    try:
        with ZipFile(temporary, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
            for name, file in files:
                entry = ZipInfo("writing-diagnostic/" + name, date_time=(1980, 1, 1, 0, 0, 0))
                entry.compress_type = ZIP_DEFLATED
                entry.create_system = 3
                mode = 0o755 if file.stat().st_mode & 0o111 else 0o644
                entry.external_attr = (stat.S_IFREG | mode) << 16
                archive.writestr(entry, file.read_bytes(), compresslevel=9)
        with ZipFile(temporary) as archive:
            if archive.testzip() is not None:
                raise ValueError("The generated ZIP failed its integrity check.")
        os.replace(temporary, output)
    finally:
        temporary.unlink(missing_ok=True)
    print(output)
    return output


if __name__ == "__main__":
    try:
        if len(sys.argv) > 2:
            raise ValueError("Usage: python3 scripts/package-plugin.py [output.zip]")
        build(sys.argv[1] if len(sys.argv) == 2 else None)
    except (OSError, ValueError, KeyError) as error:
        print(f"Packaging failed: {error}", file=sys.stderr)
        sys.exit(1)
