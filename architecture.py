#!/usr/bin/env python3
"""Architecture diagram — AI Webpage PDF Assistant — 1920×1080 px, pastel palette"""

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Rectangle

DPI = 100
fig, ax = plt.subplots(figsize=(19.2, 10.8), dpi=DPI)
BG = "#F8F9FB"
fig.patch.set_facecolor(BG)
ax.set_facecolor(BG)
ax.set_xlim(0, 192)
ax.set_ylim(0, 108)
ax.axis("off")
plt.subplots_adjust(left=0, right=1, top=1, bottom=0)

# ── Pastel palette ─────────────────────────────────────────────────────────────
T_BG  = "#1E293B"
EX_F  = "#F0ECFB"; EX_E  = "#7C3AED"   # lavender chrome shell
L1_F  = "#DBEAFE"; L1_E  = "#1D4ED8"   # sky blue popup
L2_F  = "#EDE9FE"; L2_E  = "#5B21B6"   # violet agent loop
LLM_F = "#FEF3C7"; LLM_E = "#B45309"   # amber LLM
TL_F  = "#D1FAE5"; TL_E  = "#065F46"   # sage green tool calls
L3A_F = "#FFE4E6"; L3A_E = "#BE123C"   # rose external APIs
L3B_F = "#E0F2FE"; L3B_E = "#0369A1"   # sky teal page/PDF
DARK  = "#1E293B"
MUTED = "#64748B"
MED   = "#334155"

# ── Primitives ─────────────────────────────────────────────────────────────────

def box(x, y, w, h, fc, ec, lw=1.5, r=0.8, z=2):
    ax.add_patch(FancyBboxPatch((x, y), w, h,
        boxstyle=f"round,pad=0,rounding_size={r}",
        fc=fc, ec=ec, lw=lw, zorder=z, clip_on=False))

def hbox(x, y, w, h, fc, ec, lw=2.0, r=1.0, z=2, hh=5.2):
    """Rounded box with solid coloured header band at the top."""
    box(x, y, w, h, fc, ec, lw=lw, r=r, z=z)
    ax.add_patch(Rectangle(
        (x + 0.3, y + h - hh), w - 0.6, hh,
        fc=ec, ec="none", lw=0, zorder=z + 1, clip_on=False))

def t(x, y, s, sz=9, c=DARK, w="normal", ha="center", va="center", z=10, it=False):
    ax.text(x, y, s, fontsize=sz, color=c, fontweight=w,
            ha=ha, va=va, zorder=z,
            fontstyle="italic" if it else "normal", clip_on=False)

def pill(cx, cy, label, fc, ec, sz=8.5, z=6):
    pw = len(label) * 0.63 + 3.0
    ph = 3.4
    box(cx - pw/2, cy - ph/2, pw, ph, fc, ec, lw=1.3, r=0.5, z=z)
    t(cx, cy, label, sz, ec, "bold", z=z + 1)

def arr(x1, y1, x2, y2, c=MED, lw=2.0, z=8):
    dx, dy = x2 - x1, y2 - y1
    if abs(dx) < 0.3 or abs(dy) < 0.3:
        conn = "arc3,rad=0"
    else:
        aA = 270 if dy < 0 else 90
        aB = 0   if dx > 0 else 180
        conn = f"angle,angleA={aA},angleB={aB},rad=3"
    ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle="-|>", color=c, lw=lw,
                                mutation_scale=11, connectionstyle=conn),
                zorder=z)

# ══════════════════════════════════════════════════════════════════════════════
# TITLE BAR  y=103..108
# ══════════════════════════════════════════════════════════════════════════════
ax.fill_between([0, 192], [103, 103], [108, 108], color=T_BG, zorder=1)
t(96, 105.5,
  "AI WEBPAGE PDF ASSISTANT  —  Architecture  |  LLM · Agent Loop · Tool Calls",
  13.5, "white", "bold")

# ══════════════════════════════════════════════════════════════════════════════
# LEGEND  y=0..7
# ══════════════════════════════════════════════════════════════════════════════
ax.fill_between([0, 192], [0, 0], [7, 7], color="#F1F5F9", zorder=1)
ax.plot([0, 192], [7, 7], color="#CBD5E1", lw=0.8)
t(7, 3.5, "LEGEND:", 9, DARK, "bold", ha="left")
for i, (nm, fc, ec) in enumerate([
    ("Popup / Input",  L1_F,  L1_E),
    ("Agent Loop",     L2_F,  L2_E),
    ("LLM",            LLM_F, LLM_E),
    ("Tool Calls",     TL_F,  TL_E),
    ("External APIs",  L3A_F, L3A_E),
    ("Page & PDF Ops", L3B_F, L3B_E),
]):
    lx = 22 + i * 28
    box(lx, 1.2, 4.5, 4.5, fc, ec, lw=1.4, r=0.4, z=2)
    t(lx + 5.5, 3.5, nm, 8.5, DARK, ha="left", z=3)

# ══════════════════════════════════════════════════════════════════════════════
# CHROME EXTENSION SHELL  x=1..191  y=7.5..102
# ══════════════════════════════════════════════════════════════════════════════
box(1, 7.5, 190, 94.5, EX_F, EX_E, lw=2.5, r=1.8, z=1)
t(96, 100.3, "CHROME EXTENSION  (Manifest V3)", 11.5, "#6D28D9", "bold")

# ══════════════════════════════════════════════════════════════════════════════
# LAYER 1 — POPUP UI  x=3..189  y=87..100
# ══════════════════════════════════════════════════════════════════════════════
hbox(3, 87, 186, 12, L1_F, L1_E, lw=2, r=1.0, hh=5.2)
t(96, 97.5, "POPUP UI  —  popup.js  +  popup.html", 11.5, "white", "bold", z=4)

# 6 sub-boxes  bw=28  gap=2.4  starting x=5
bw, gap = 28.0, 2.4
popup_items = [
    ("User Trigger",  ["Opens popup,", "starts the flow"],     L1_E),
    ("Export PDF",    ["EXPORT_PDF"],                           "#1D4ED8"),
    ("Summarize",     ["SUMMARIZE_PAGE"],                       "#059669"),
    ("Chat / Ask",    ["CHAT_MESSAGE"],                         "#7C3AED"),
    ("Settings",      ["Options page"],                         "#D97706"),
    ("Agent Status",  ["Live progress", "AGENT_STATUS push"],   "#475569"),
]
for i, (nm, subs, c) in enumerate(popup_items):
    bx = 5 + i * (bw + gap)
    box(bx, 88, bw, 7.5, "white", c, lw=1.3, r=0.6, z=3)
    t(bx + bw/2, 93.5, nm, 9.5, c, "bold", z=4)
    if len(subs) == 1:
        t(bx + bw/2, 91.0, subs[0], 8, MUTED, z=4, it=True)
    else:
        t(bx + bw/2, 91.2, subs[0], 8, MUTED, z=4, it=True)
        t(bx + bw/2, 89.3, subs[1], 8, MUTED, z=4, it=True)

# Arrow L1 → L2
arr(96, 87, 96, 84.5, L2_E, lw=2.5, z=9)
t(98, 85.8, "request", 7.5, L2_E, ha="left", it=True, z=10)

# ══════════════════════════════════════════════════════════════════════════════
# LAYER 2 — AGENT LOOP  x=3..189  y=34..84
# ══════════════════════════════════════════════════════════════════════════════
hbox(3, 34, 186, 50, L2_F, L2_E, lw=2.5, r=1.2, hh=5.2)
t(96, 81.5, "AGENT LOOP  —  runAgentLoop()  —  up to 8 iterations",
  12.5, "white", "bold", z=5)
t(96, 78.5,
  "Call LLM  →  receive tool_call  →  execute tool  →  feed result back  →  repeat until answer",
  8.5, "#7C3AED", it=True, z=5)

# ── LLM BOX  x=5..88  y=36..77  (header band y=71.8..77) ────────────────────
hbox(5, 36, 83, 41, LLM_F, LLM_E, lw=2.0, r=1.0, hh=5.2)
t(46.5, 74.8, "LLM  ·  Language Model", 13.5, "white", "bold", z=6)

# Body — first text at least 1 unit below header bottom (71.8)
t(46.5, 70.5, "Receives messages[ ] and decides which tool to call next.", 9, LLM_E, z=5)
t(46.5, 68.0, "Provider is swappable — all normalised via shared/ai.js",   8.5, MUTED, it=True, z=5)

ax.plot([7, 87], [66.4, 66.4], color="#FCD34D", lw=0.8, ls="--", zorder=5)
t(46.5, 64.8, "Supported Providers  (choose one in Settings)", 8.5, MED, z=5)

# 2×2 provider pills — row spacing 5.5 units; pill height 3.4 → gap 2.1
for (lbl, pfc, pec), (px, py) in zip(
    [("Gemini 2.0 Flash",  "#FEF9C3", "#92400E"),
     ("Claude Sonnet 4.6", "#FDE68A", "#B45309"),
     ("GPT-4o",            "#FEF9C3", "#92400E"),
     ("Mistral Small",     "#FDE68A", "#B45309")],
    [(26.5, 60.5), (66.5, 60.5),
     (26.5, 55.0), (66.5, 55.0)]):
    pill(px, py, lbl, pfc, pec)

# Protocol text — 3 lines, 3 units apart; first at y=50 (4.3 below last pill bottom 54.3)
t(46.5, 50.0, "All 4 providers speak the same agent protocol:", 8.5, MUTED, it=True, z=5)
t(46.5, 47.0, "normalizeResponse()  ·  buildToolResultMessage()  ·  toProviderMessage()", 8, MUTED, z=5)
t(46.5, 44.0, "max_tokens: 2048  ·  generationConfig  ·  shared/ai.js", 8, MUTED, it=True, z=5)

# ── TOOL CALLS BOX  x=95..186  y=36..77  (header band y=71.8..77) ─────────────
hbox(95, 36, 91, 41, TL_F, TL_E, lw=2.0, r=1.0, hh=5.2)
t(140.5, 74.8, "TOOL CALLS  —  executeTool()", 13.5, "white", "bold", z=6)

t(140.5, 70.5, "Background executes the tool; result string returned to LLM.", 9, TL_E, z=5)
t(140.5, 68.0, "5 tools available to the LLM",                                  8.5, MUTED, it=True, z=5)

# 5 tool rows — cy spacing=6, box height=5 → gap=1 unit between boxes
# cy values: 65, 59, 53, 47, 41
# First box top: 65+2.5=67.5  gap from desc(68.0)=0.5 — fine as subtle adjacency
tools = [
    ("get_page_content",    "Read page text  (8 000 chars)",            "#BBF7D0", "#166534", False),
    ("get_page_metadata",   "Title · URL · headings · word count",      "#BBF7D0", "#166534", False),
    ("scroll_to_section",   "Scroll page to a pixel offset",            "#D1FAE5", "#065F46", False),
    ("export_pdf",          "Screenshots  →  stitch  →  download",      "#6EE7B7", "#064E3B", True),
    ("answer_from_content", "Terminal — delivers answer, stops loop",   "#A7F3D0", "#064E3B", True),
]
for i, (nm, desc, fc, ec, hi) in enumerate(tools):
    cy = 65 - i * 6            # 65, 59, 53, 47, 41
    box(97, cy - 2.5, 87, 5.0, fc, ec, lw=1.8 if hi else 1.2, r=0.5, z=5)
    t(140.5, cy + 0.8, nm,   9.5, ec,    "bold", z=6)
    t(140.5, cy - 0.8, desc, 7.5, MUTED,         z=6)

# "Repeats until" — below last tool (cy=41, bottom=38.5); agent loop box y=34 → gap=4.5
t(140.5, 37.2,
  "Repeats until  answer_from_content  called  or  8 steps reached",
  7.5, L2_E, "bold", it=True, z=5)

# ── Corridor arrows: LLM right-edge=88, Tools left-edge=95, corridor=88..95 ──
arr(88, 62, 95, 62, LLM_E, lw=3.0, z=7)   # tool_call →
t(91.5, 63.8, "tool_call", 7.5, LLM_E, ha="center", it=True, z=9)
arr(95, 57, 88, 57, TL_E, lw=3.0, z=7)    # ← tool_result
t(91.5, 55.2, "tool_result", 7.5, TL_E, ha="center", it=True, z=9)

# ── Arrows Layer 2 → Layer 3 ──────────────────────────────────────────────────
arr(46.5, 36, 46.5, 33, L3A_E, lw=2.5, z=9)
t(48.5, 34.6, "API calls", 7.5, L3A_E, ha="left", it=True, z=10)
arr(140.5, 36, 140.5, 33, L3B_E, lw=2.5, z=9)
t(142.5, 34.6, "page / PDF ops", 7.5, L3B_E, ha="left", it=True, z=10)

# ══════════════════════════════════════════════════════════════════════════════
# LAYER 3 — DEPENDENCIES  y=9..33
# ══════════════════════════════════════════════════════════════════════════════

# ── A: EXTERNAL APIS  x=5..89  y=9..33 ───────────────────────────────────────
hbox(5, 9, 84, 23, L3A_F, L3A_E, lw=2.0, r=1.0, hh=5.2)
t(47, 30.5, "EXTERNAL APIS  —  LLM Providers", 11, "white", "bold", z=5)
t(47, 27.5, "The LLM makes direct HTTPS calls to the chosen provider.", 8.5, MUTED, it=True, z=4)

# 2×2 API grid — cols: cx=24, 66 | rows: cy=22.5, 15.5
for idx, (nm, url) in enumerate([
    ("Gemini API",    "generativelanguage.googleapis.com"),
    ("Anthropic API", "api.anthropic.com"),
    ("OpenAI API",    "api.openai.com"),
    ("Mistral API",   "api.mistral.ai"),
]):
    cx = 24 if idx % 2 == 0 else 66
    cy = 22.5 if idx < 2 else 15.5
    box(cx - 18, cy - 3.2, 36, 6.5, "#FFF1F2", L3A_E, lw=1.4, r=0.5, z=4)
    t(cx, cy + 0.8, nm,  9.5, "#9F1239", "bold", z=5)
    t(cx, cy - 1.0, url, 7.5, MUTED, z=5, it=True)

t(47, 10.5, "Pluggable — switch provider in Settings without changing any other code.", 8, MUTED, it=True, z=4)

# ── B: PAGE & PDF SUPPORT  x=92..187  y=9..33 ────────────────────────────────
hbox(92, 9, 95, 23, L3B_F, L3B_E, lw=2.0, r=1.0, hh=5.2)
t(139.5, 30.5, "PAGE & PDF SUPPORT", 11, "white", "bold", z=5)

# Content Script sub-box  x=94..137  y=10..27.5 (height=17.5)
box(94, 10, 43, 17.5, "#BAE6FD", "#0284C7", lw=1.4, r=0.6, z=4)
t(115.5, 26.8, "CONTENT SCRIPT  (content.js)",         9.5, "#0C4A6E", "bold",   z=5)
t(115.5, 24.5, "Injected into the active page",         8.0, MUTED,              z=5, it=True)
t(115.5, 22.2, "extractPageContent()  ·  8 000 chars",  8.0, MUTED,              z=5)
t(115.5, 19.9, "findScrollContainer()  (SPA support)",  8.0, MUTED,              z=5)
t(115.5, 17.6, "prepareCapture()  ·  scrollToCapture()",8.0, MUTED,              z=5)
t(115.5, 15.3, "restoreAfterCapture()  ·  hide navbars",8.0, MUTED,              z=5)
t(115.5, 12.5, "PING · EXTRACT_CONTENT · SCROLL_TO",    7.5, MUTED,              z=5, it=True)

# Offscreen Document sub-box  x=139..184  y=10..27.5 (height=17.5)
box(139, 10, 45, 17.5, "#FEF3C7", "#D97706", lw=1.4, r=0.6, z=4)
t(161.5, 26.8, "OFFSCREEN DOCUMENT  (offscreen.js)",    9.5, "#78350F", "bold",   z=5)
t(161.5, 24.5, "Receives JPEG screenshots from SW",      8.0, MUTED,              z=5, it=True)
t(161.5, 22.2, "Assembles pages with jsPDF",             8.0, MUTED,              z=5)
t(161.5, 19.9, "Crops final partial slice via <canvas>", 8.0, MUTED,              z=5)
t(161.5, 17.6, "Returns base64 PDF → chrome.downloads",  8.0, MUTED,              z=5)
t(161.5, 15.3, "chrome.storage.sync  ·  API keys",       8.0, MUTED,              z=5)
t(161.5, 12.5, "chrome.storage.session  ·  Chat history",7.5, MUTED,              z=5, it=True)

# ══════════════════════════════════════════════════════════════════════════════
# SAVE
# ══════════════════════════════════════════════════════════════════════════════
plt.savefig("architecture.png", dpi=DPI, bbox_inches=None,
            facecolor=BG, pad_inches=0)
print(f"Saved architecture.png  ({int(fig.get_figwidth()*DPI)} x {int(fig.get_figheight()*DPI)} px)")
