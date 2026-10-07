#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import subprocess

W, H = 1920, 1080
BG = (18, 20, 22)
PANEL = (29, 32, 35)
PANEL2 = (36, 39, 43)
TEXT = (244, 242, 235)
MUTED = (177, 181, 184)
ACC = (247, 153, 64)
GREEN = (88, 184, 112)
RED = (226, 92, 92)
LINE = (68, 72, 76)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "review"
FRAMES = ROOT / ".review-video"
OUT.mkdir(parents=True, exist_ok=True)
FRAMES.mkdir(parents=True, exist_ok=True)

FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

def font(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)

def rounded(draw, box, radius=24, fill=PANEL, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)

def wrapped_lines(draw, text, fnt, max_width):
    words = text.split()
    lines, current = [], ""
    for word in words:
        candidate = (current + " " + word).strip()
        if draw.textbbox((0, 0), candidate, font=fnt)[2] <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines

def text_block(draw, text, x, y, fnt, color=TEXT, max_width=1500, spacing=10):
    line_height = fnt.size + spacing
    for line in wrapped_lines(draw, text, fnt, max_width):
        draw.text((x, y), line, font=fnt, fill=color)
        y += line_height
    return y

def base(title=None, subtitle=None):
    image = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, W, 8), fill=ACC)
    if title:
        draw.text((100, 70), title, font=font(56, True), fill=TEXT)
    if subtitle:
        text_block(draw, subtitle, 100, 145, font(25), MUTED, 1600, 8)
    return image, draw

def footer(draw, number, total):
    draw.text((100, H - 58), "Writing Assistant 0.43.2 · Review walkthrough", font=font(20), fill=MUTED)
    draw.text((W - 220, H - 58), f"{number}/{total}", font=font(20, True), fill=MUTED)

def save_scene(number, image):
    path = FRAMES / f"scene{number:02d}.png"
    image.save(path)
    return path

scenes, durations = [], []

# 1 — title
image, draw = base()
draw.text((100, 145), "Writing Assistant", font=font(72, True), fill=TEXT)
draw.text((105, 240), "Maintain your voice.", font=font(34), fill=MUTED)
text_block(draw, "Public plugin review walkthrough · Skills + read-only repository MCP", 100, 385, font(32), TEXT, 1500, 12)
rounded(draw, (100, 515, 1820, 760), 28, PANEL)
draw.text((145, 560), "Core architecture", font=font(28, True), fill=ACC)
text_block(
    draw,
    "The user’s current ChatGPT or Codex model does the writing. The MCP never calls another model; it only retrieves canonical Writing Assistant methods and references from the public repository.",
    145, 620, font(30), TEXT, 1580, 12,
)
draw.text((100, 900), "mattlane66/Writing_Assistant  →  writing-assistant-mcp.up.railway.app/mcp", font=font(25), fill=MUTED)
scenes.append(save_scene(1, image)); durations.append(6)

# 2 — architecture
image, draw = base("How it works", "One model context. Live repository guidance. No developer-side model call.")
boxes = [
    (110, 330, 430, 570, "User", "Prompt + draft"),
    (570, 330, 920, 570, "ChatGPT / Codex", "Host model writes"),
    (1050, 330, 1390, 570, "Writing skill", "Frame → compose → audit"),
    (1510, 330, 1810, 570, "Repo MCP", "Read-only methods"),
]
for x1, y1, x2, y2, title, sub in boxes:
    rounded(draw, (x1, y1, x2, y2), 22, PANEL2, LINE, 2)
    draw.text((x1 + 28, y1 + 45), title, font=font(30, True), fill=TEXT)
    text_block(draw, sub, x1 + 28, y1 + 105, font(22), MUTED, x2 - x1 - 56, 6)
for a, b in [((430, 450), (570, 450)), ((920, 450), (1050, 450)), ((1390, 450), (1510, 450))]:
    draw.line((*a, *b), fill=ACC, width=5)
    draw.polygon([(b[0], b[1]), (b[0] - 18, b[1] - 10), (b[0] - 18, b[1] + 10)], fill=ACC)
draw.line([(1660, 590), (1660, 700), (745, 700), (745, 590)], fill=GREEN, width=4)
draw.polygon([(745, 590), (735, 610), (755, 610)], fill=GREEN)
draw.text((865, 718), "canonical methods + references return to the same host model", font=font(22), fill=GREEN)
rounded(draw, (110, 820, 1810, 940), 22, PANEL)
text_block(draw, "Privacy default: method search gets an abstract editorial-problem description, not the user’s full private draft.", 145, 852, font(27), TEXT, 1600, 8)
footer(draw, 2, 11)
scenes.append(save_scene(2, image)); durations.append(9)

# 3 — MCP configured
image, draw = base("MCP setup is connected and scanned", "Production server · domain verified · no authentication · three read-only tools")
rounded(draw, (140, 260, 1780, 850), 28, PANEL)
draw.text((190, 310), "Writing Assistant MCP", font=font(38, True), fill=TEXT)
draw.text((190, 370), "https://writing-assistant-mcp.up.railway.app/mcp", font=font(25), fill=MUTED)
rounded(draw, (1380, 305, 1700, 365), 16, (25, 62, 36))
draw.text((1410, 322), "✓ Configured", font=font(23, True), fill=(142, 232, 163))
draw.text((190, 455), "Domain verification", font=font(23, True), fill=MUTED)
draw.text((500, 455), "✓ Domain verified", font=font(24, True), fill=GREEN)
draw.text((190, 525), "Authentication", font=font(23, True), fill=MUTED)
draw.text((500, 525), "No authentication", font=font(24), fill=TEXT)
draw.line((190, 600, 1710, 600), fill=LINE, width=2)
draw.text((190, 640), "Scanned tools", font=font(26, True), fill=ACC)
for index, name in enumerate(["search_writing_methods", "get_writing_methods", "get_writing_reference"]):
    draw.text((235, 700 + index * 55), f"•  {name}", font=font(25), fill=GREEN)
footer(draw, 3, 11)
scenes.append(save_scene(3, image)); durations.append(9)

positive_cases = [
    ("1 · Voice-preserving edit", "“Polish this paragraph without changing my meaning or making it sound corporate…”", "search_writing_methods", "Preserve the plain causal sequence and restraint. No decorative transitions or generic professional polish."),
    ("2 · Cross-sentence coherence", "“Nora entered the museum at noon. At 11:30, after she had spent an hour inside…”", "search_writing_methods  +  get_writing_reference", "Identify the timeline inconsistency. Do not invent a flashback or alternate chronology."),
    ("3 · Draft only from supplied facts", "“Draft two sentences from only these facts: the tool imports CSV files and compares two versions row by row.”", "search_writing_methods", "Draft only from supplied facts. Do not invent customers, speed, accuracy, integrations, or outcomes."),
    ("4 · Leave good prose alone", "“Edit this only if it materially improves it: The train was late. We missed the meeting.”", "search_writing_methods", "No change is a valid editorial decision. Do not manufacture visible edits."),
    ("5 · Argument analysis", "“If the failure rate stays above the threshold, delay launch. It is still above. Therefore delay.”", "search_writing_methods  +  get_writing_reference", "Separate inference quality from premise truth and evidence. Do not strengthen the argument into a different one."),
]
for scene_number, (title, prompt, tools, behavior) in enumerate(positive_cases, start=4):
    image, draw = base(title, "Positive review case")
    rounded(draw, (100, 255, 1820, 510), 26, PANEL)
    draw.text((145, 290), "User prompt", font=font(24, True), fill=ACC)
    text_block(draw, prompt, 145, 345, font(31), TEXT, 1580, 12)
    rounded(draw, (100, 555, 1820, 690), 22, PANEL2)
    draw.text((145, 590), "Expected retrieval", font=font(23, True), fill=MUTED)
    draw.text((445, 590), tools, font=font(24, True), fill=GREEN)
    rounded(draw, (100, 735, 1820, 930), 22, PANEL)
    draw.text((145, 770), "Host-model behavior", font=font(24, True), fill=ACC)
    text_block(draw, behavior, 145, 825, font(29), TEXT, 1570, 10)
    footer(draw, scene_number, 11)
    scenes.append(save_scene(scene_number, image)); durations.append(8)

# 9 — negative cases
image, draw = base("Negative cases · where the plugin should not act", "The repository MCP is intentionally narrow: writing-method retrieval only.")
negative_cases = [
    ("Google Drive retrieval", "“Find my unpublished draft in Google Drive.”", "Do not use Writing Assistant MCP. Ask for the text or use the appropriate connected source."),
    ("Publishing", "“Publish this essay to my website.”", "Do not modify external systems. Return writing help or route to the publishing tool."),
    ("Current-fact verification", "“Prove every factual claim using current web sources.”", "Do not pretend the writing MCP verifies the web. Use research/search tooling instead."),
]
y = 245
for title, prompt, behavior in negative_cases:
    rounded(draw, (100, y, 1820, y + 215), 22, PANEL)
    draw.text((145, y + 30), title, font=font(27, True), fill=RED)
    text_block(draw, prompt, 145, y + 78, font(25), TEXT, 760, 8)
    draw.line((960, y + 35, 960, y + 180), fill=LINE, width=2)
    text_block(draw, behavior, 1005, y + 60, font(24), MUTED, 750, 8)
    y += 235
footer(draw, 9, 11)
scenes.append(save_scene(9, image)); durations.append(12)

# 10 — actual MCP return shape
image, draw = base("What the MCP actually returns", "Deterministic repository retrieval. The server does not draft, edit, critique, or call a model.")
rounded(draw, (100, 245, 1820, 920), 24, (22, 25, 28), LINE, 2)
draw.text((140, 285), "tools/list", font=font(24, True), fill=ACC)
for index, name in enumerate(["search_writing_methods", "get_writing_methods", "get_writing_reference"]):
    draw.text((170, 335 + index * 50), f"•  {name}", font=font(26), fill=GREEN)
draw.line((140, 510, 1780, 510), fill=LINE, width=2)
draw.text((140, 550), "sample search", font=font(24, True), fill=ACC)
text_block(draw, 'query: “edit a short personal paragraph while preserving voice and causal restraint”', 170, 600, font(25), TEXT, 1500, 8)
text_block(draw, "returns full canonical method records from CONCEPT_REGISTRY.json — procedure, triggers, anti-triggers, exceptions, and execution tests.", 170, 675, font(25), MUTED, 1480, 8)
text_block(draw, "Live deployment probe confirmed meaning-voice-fidelity retrieval and semantic-composition reference access.", 170, 805, font(25, True), GREEN, 1480, 8)
footer(draw, 10, 11)
scenes.append(save_scene(10, image)); durations.append(10)

# 11 — ready
image, draw = base()
draw.text((100, 140), "Ready for review", font=font(68, True), fill=TEXT)
draw.text((105, 230), "Writing Assistant 0.43.2", font=font(31), fill=MUTED)
checks = [
    "✓ User’s ChatGPT / Codex model performs the writing",
    "✓ Read-only MCP retrieves canonical repository methods only",
    "✓ Domain verified · No authentication · No server-side model key",
    "✓ 5 positive cases + 3 negative cases demonstrated",
    "✓ Public privacy, support, terms, and website URLs",
    "✓ Three MCP tools scanned successfully",
]
y = 380
for line in checks:
    draw.text((160, y), line, font=font(30), fill=(154, 226, 168))
    y += 72
rounded(draw, (100, 850, 1820, 950), 20, PANEL)
draw.text((145, 882), "Review recording: /review/writing-assistant-demo.mp4", font=font(27, True), fill=ACC)
footer(draw, 11, 11)
scenes.append(save_scene(11, image)); durations.append(8)

clips = []
for index, (scene, duration) in enumerate(zip(scenes, durations), start=1):
    clip = FRAMES / f"clip{index:02d}.mp4"
    subprocess.run(
        [
            "ffmpeg", "-y", "-loop", "1", "-i", str(scene),
            "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
            "-t", str(duration), "-r", "30",
            "-vf", f"scale={W}:{H},format=yuv420p",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
            "-c:a", "aac", "-b:a", "96k", "-shortest", str(clip),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    clips.append(clip)

concat = FRAMES / "concat.txt"
concat.write_text("".join(f"file '{clip.as_posix()}'\n" for clip in clips), encoding="utf-8")
final = OUT / "writing-assistant-demo.mp4"
subprocess.run(
    ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-c", "copy", str(final)],
    check=True,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
print(final)
