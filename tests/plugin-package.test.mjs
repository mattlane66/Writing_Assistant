import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("structural package checks cannot replace release archives with example URLs", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const temp = mkdtempSync(path.join(tmpdir(), "writing-assistant-release-test-"));
  const script = path.join(root, "scripts/package-writing-assistant-plugin.py");
  const hash = bytes => createHash("sha256").update(bytes).digest("hex");
  try {
    const built = spawnSync("python3", [script,"--mcp-url","https://writing-assistant-mcp.up.railway.app/mcp","--output-dir",temp], {encoding:"utf8"});
    expect(built.status, built.stderr).toBe(0);
    const file = path.join(temp,readdirSync(temp)[0]);const before = hash(readFileSync(file));
    const dist = path.join(root,"products/writing-assistant-plugin/dist");
    const existing = (existsSync(dist)?readdirSync(dist):[]).filter(n=>n.endsWith(".zip")).map(name=>({name,hash:hash(readFileSync(path.join(dist,name)))}));
    const checked = spawnSync("python3", [script,"--mcp-url","https://example.com/mcp","--allow-example-url","--check-only"], {encoding:"utf8"});
    expect(checked.status, checked.stderr).toBe(0);expect(checked.stdout).toContain("deployable archives were not changed");expect(hash(readFileSync(file))).toBe(before);
    for (const archive of existing) expect(hash(readFileSync(path.join(dist,archive.name)))).toBe(archive.hash);
  } finally {rmSync(temp,{recursive:true});}
});
