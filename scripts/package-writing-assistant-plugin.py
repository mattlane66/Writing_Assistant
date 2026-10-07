#!/usr/bin/env python3
import argparse
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlparse
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "products" / "writing-assistant-plugin"
DIST = SOURCE / "dist"

REFERENCE_SOURCES = [
    ("Canonical system contract", ROOT / "knowledge" / "SYSTEM_PROMPT.md"),
    ("Semantic composition", ROOT / "knowledge" / "SEMANTIC_COMPOSITION.md"),
    ("Example-derived sentence and paragraph repertoire", ROOT / "knowledge" / "EXAMPLE_DERIVED_PATTERNS.md"),
    ("Editorial playbook", ROOT / "knowledge" / "EDITORIAL_PLAYBOOK.md"),
    ("Text-world coherence", ROOT / "knowledge" / "COHERENCE_PLAYBOOK.md"),
    (
        "Argument reconstruction",
        ROOT / "knowledge" / "argument-reconstruction" / "SKILL.md",
    ),
    (
        "Argument mapping and tests",
        ROOT
        / "knowledge"
        / "argument-reconstruction"
        / "references"
        / "mapping-and-tests.md",
    ),
    (
        "Argument evaluation standards",
        ROOT
        / "knowledge"
        / "argument-reconstruction"
        / "references"
        / "evaluation-standards.md",
    ),
]


def parse_args():
    parser = argparse.ArgumentParser(
        description="Build the portable Writing Assistant skills + MCP plugin ZIP."
    )
    parser.add_argument(
        "--mcp-url",
        default=os.environ.get("WRITING_ASSISTANT_MCP_URL", ""),
        help="Public HTTPS MCP endpoint, normally ending in /mcp.",
    )
    parser.add_argument(
        "--allow-example-url",
        action="store_true",
        help="Allow https://example.com/mcp for structural CI packaging only.",
    )
    return parser.parse_args()


def validate_url(value: str, allow_example: bool) -> str:
    value = value.strip()
    if not value:
        raise SystemExit(
            "WRITING_ASSISTANT_MCP_URL is required. "
            "Example: https://writing.example.com/mcp"
        )
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.netloc:
        raise SystemExit("The MCP URL must be a public HTTPS URL.")
    if parsed.username or parsed.password:
        raise SystemExit("The MCP URL must not contain credentials.")
    if not parsed.path.endswith("/mcp"):
        raise SystemExit("The MCP URL must end in /mcp.")
    if parsed.hostname == "example.com" and not allow_example:
        raise SystemExit("example.com is allowed only with --allow-example-url for CI.")
    return value


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def build_reference() -> str:
    parts = [
        "# WRITING EDITORIAL REFERENCE",
        "",
        "This file is generated from the canonical Writing Assistant repository knowledge.",
        "Do not edit this generated copy. Update the source files in knowledge/ instead.",
        "",
        "The current ChatGPT or Codex host model is the execution path for writing.",
        "The read-only MCP retrieves current canonical repository guidance when needed.",
        "This packaged reference is a fallback snapshot of the same editorial, semantic,",
        "syntactic, coherence, source-discipline, and argument methods.",
        "",
    ]
    for title, path in REFERENCE_SOURCES:
        text = path.read_text(encoding="utf-8").strip()
        if not text:
            raise SystemExit(f"Reference source is empty: {path.relative_to(ROOT)}")
        parts.extend(
            [
                "---",
                "",
                f"# {title.upper()}",
                "",
                f"Source: {path.relative_to(ROOT).as_posix()}",
                "",
                text,
                "",
            ]
        )
    return "\n".join(parts).strip() + "\n"


def copy_source_tree(target: Path):
    skill_source = SOURCE / "skills" / "writing-assistant" / "SKILL.md"
    icon_source = SOURCE / "assets" / "icon.svg"
    for required in [
        SOURCE / "plugin.json",
        SOURCE / "mcp.template.json",
        skill_source,
        icon_source,
    ]:
        if not required.exists():
            raise SystemExit(f"Missing plugin source file: {required.relative_to(ROOT)}")

    shutil.copy2(SOURCE / "plugin.json", target / "plugin.json")
    (target / "skills" / "writing-assistant").mkdir(parents=True, exist_ok=True)
    shutil.copy2(
        skill_source,
        target / "skills" / "writing-assistant" / "SKILL.md",
    )
    (target / "assets").mkdir(parents=True, exist_ok=True)
    shutil.copy2(icon_source, target / "assets" / "icon.svg")


def build_package(mcp_url: str):
    manifest = read_json(SOURCE / "plugin.json")
    version = manifest.get("version")
    name = manifest.get("name")
    if not isinstance(version, str) or not version:
        raise SystemExit("plugin.json is missing a version.")
    if not isinstance(name, str) or not name:
        raise SystemExit("plugin.json is missing a name.")

    template = read_json(SOURCE / "mcp.template.json")
    server = template["mcpServers"]["writing-assistant"]
    if server.get("url") != "__WRITING_ASSISTANT_MCP_URL__":
        raise SystemExit("mcp.template.json does not contain the expected URL placeholder.")
    server["url"] = mcp_url

    DIST.mkdir(parents=True, exist_ok=True)
    for path in DIST.glob("*"):
        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink()

    with tempfile.TemporaryDirectory(prefix="writing-assistant-plugin-") as temp:
        package_root = Path(temp) / "writing-assistant"
        package_root.mkdir()
        copy_source_tree(package_root)

        write_json(package_root / "mcp.json", template)
        write_json(
            package_root / ".mcp.json",
            {
                "mcpServers": {
                    "writing-assistant": {
                        "url": mcp_url,
                    }
                }
            },
        )
        write_json(
            package_root / ".codex-plugin" / "plugin.json",
            {
                "name": name,
                "version": version,
                "description": manifest["description"],
                "skills": "./skills/",
                "mcpServers": "./.mcp.json",
            },
        )

        reference_path = (
            package_root
            / "skills"
            / "writing-assistant"
            / "references"
            / "WRITING_EDITORIAL_REFERENCE.md"
        )
        reference_path.parent.mkdir(parents=True, exist_ok=True)
        reference = build_reference()
        for required in [
            "Authority and source boundary",
            "Semantic failure classes",
            "Generic content is a failure class",
            "Preservation and over-correction",
            "Example-derived sentence and paragraph repertoire",
            "Text-world coherence playbook",
            "Argument reconstruction",
        ]:
            if required.lower() not in reference.lower():
                raise SystemExit(
                    f"Generated editorial reference is missing required material: {required}"
                )
        reference_path.write_text(reference, encoding="utf-8")

        archive_path = DIST / f"Writing-Assistant-{version}-MCP.zip"
        with ZipFile(archive_path, "w", compression=ZIP_DEFLATED) as archive:
            for path in sorted(package_root.rglob("*")):
                if path.is_file():
                    archive.write(path, path.relative_to(package_root))

        with ZipFile(archive_path) as archive:
            if archive.testzip() is not None:
                raise SystemExit("Generated plugin ZIP failed integrity testing.")
            names = set(archive.namelist())
            required_files = {
                "plugin.json",
                "mcp.json",
                ".mcp.json",
                ".codex-plugin/plugin.json",
                "assets/icon.svg",
                "skills/writing-assistant/SKILL.md",
                "skills/writing-assistant/references/WRITING_EDITORIAL_REFERENCE.md",
            }
            missing = required_files - names
            if missing:
                raise SystemExit(
                    "Generated plugin ZIP is missing: " + ", ".join(sorted(missing))
                )

    print(archive_path.relative_to(ROOT))


def main():
    args = parse_args()
    mcp_url = validate_url(args.mcp_url, args.allow_example_url)
    build_package(mcp_url)


if __name__ == "__main__":
    main()
