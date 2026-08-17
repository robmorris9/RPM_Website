#!/usr/bin/env python3
"""Generate a two-page narrative resume from the canonical career profile."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Iterable

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parent.parent
PROFILE_PATH = ROOT / "content" / "profile.json"
FONT_DIR = ROOT / "scripts" / "fonts"
DEFAULT_OUTPUT = ROOT / "Robert Perry Morris _ Resume.pdf"
PAGE_WIDTH, PAGE_HEIGHT = letter

NAVY = HexColor("#181D34")
TEAL = HexColor("#50A0A0")
TEAL_INK = HexColor("#337C7F")
CORAL = HexColor("#CC6050")
GOLD = HexColor("#C09838")
INK_MEDIUM = HexColor("#555B69")
INK_LIGHT = HexColor("#727784")
PAPER = HexColor("#FFFFFF")
RULE = HexColor("#DADCE2")

FONT_FILES = {
    "PlexSans-Light": "IBMPlexSans-Light.ttf",
    "PlexSans": "IBMPlexSans-Regular.ttf",
    "PlexSans-Medium": "IBMPlexSans-Medium.ttf",
    "PlexSans-SemiBold": "IBMPlexSans-SemiBold.ttf",
    "PlexMono": "IBMPlexMono-Regular.ttf",
    "PlexMono-Medium": "IBMPlexMono-Medium.ttf",
    "PlexMono-SemiBold": "IBMPlexMono-SemiBold.ttf",
}


def register_fonts() -> None:
    for family, filename in FONT_FILES.items():
        path = FONT_DIR / filename
        if not path.exists():
            raise FileNotFoundError(f"Missing resume font: {path}")
        pdfmetrics.registerFont(TTFont(family, str(path)))


def resume_positioning(profile: dict) -> tuple[str, str]:
    """Resolve the targeted title and technical subtitle with legacy fallbacks."""
    letter_copy = profile["careerLetter"]
    person = profile["person"]
    positioning = letter_copy.get("positioning") or {}

    if isinstance(positioning, str):
        title = ""
        subtitle = positioning.strip()
    else:
        title = str(
            positioning.get("title")
            or positioning.get("targetTitle")
            or positioning.get("heading")
            or ""
        ).strip()
        subtitle = str(
            positioning.get("subtitle")
            or positioning.get("technicalSubtitle")
            or positioning.get("eyebrow")
            or ""
        ).strip()

    title = title or str(
        letter_copy.get("resumeTitle")
        or person.get("currentTitle")
        or letter_copy.get("page2Heading")
        or ""
    ).strip()
    subtitle = subtitle or str(
        letter_copy.get("technicalSubtitle") or person.get("eyebrow") or ""
    ).strip()
    return title, subtitle


def paragraph_list(value: object) -> list[str]:
    """Normalize optional profile fields into clean paragraph strings."""
    if isinstance(value, str):
        text = value.strip()
        return [text] if text else []
    if isinstance(value, (list, tuple)):
        return [str(item).strip() for item in value if str(item).strip()]
    return []


def career_note_paragraphs(letter_copy: dict) -> list[str]:
    """Resolve a complete, plain-reading career note across content revisions."""
    for key in ("careerNoteParagraphs", "profileParagraphs", "bodyParagraphs"):
        complete = paragraph_list(letter_copy.get(key))
        if complete:
            return complete

    opening = paragraph_list(
        letter_copy.get("openingParagraphs")
        or letter_copy.get("introductionParagraphs")
    )
    profile_statement = paragraph_list(
        letter_copy.get("profileStatement") or letter_copy.get("operatingThesis")
    )
    closing = paragraph_list(
        letter_copy.get("closingParagraphs") or letter_copy.get("outlookParagraphs")
    )
    return opening + profile_statement + closing


def role_resume_bullets(role: dict) -> list[str]:
    """Return explicit technical bullets, deriving a conservative legacy fallback."""
    explicit = role.get("resumeBullets") or role.get("technicalBullets") or []
    if isinstance(explicit, list):
        bullets = [str(item).strip() for item in explicit if str(item).strip()]
        if bullets:
            return bullets

    candidates: list[str] = []
    for value in paragraph_list(role.get("description")):
        candidates.extend(
            sentence.strip()
            for sentence in re.split(r"(?<=[.!?])\s+", str(value).strip())
            if sentence.strip()
        )
    if len(candidates) < 3 and role.get("resumeDescription"):
        candidates.extend(
            sentence.strip()
            for sentence in re.split(
                r"(?<=[.!?])\s+", str(role["resumeDescription"]).strip()
            )
            if sentence.strip()
        )

    unique: list[str] = []
    for candidate in candidates:
        if candidate not in unique:
            unique.append(candidate)
    return unique[:3]


def wrap_lines(text: str, font: str, size: float, max_width: float) -> list[str]:
    lines: list[str] = []
    for paragraph in text.split("\n"):
        words = paragraph.split()
        if not words:
            lines.append("")
            continue
        current = words[0]
        for word in words[1:]:
            candidate = f"{current} {word}"
            if pdfmetrics.stringWidth(candidate, font, size) <= max_width:
                current = candidate
            else:
                lines.append(current)
                current = word
        lines.append(current)
    return lines


def draw_wrapped(
    pdf: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    max_width: float,
    *,
    font: str = "PlexSans",
    size: float = 9,
    leading: float = 13,
    color=INK_MEDIUM,
) -> float:
    pdf.setFillColor(color)
    pdf.setFont(font, size)
    for line in wrap_lines(text, font, size, max_width):
        pdf.drawString(x, y, line)
        y -= leading
    return y


def draw_paragraphs(
    pdf: canvas.Canvas,
    paragraphs: Iterable[str],
    x: float,
    y: float,
    width: float,
    *,
    size: float = 9.3,
    leading: float = 14.1,
    gap: float = 11,
) -> float:
    for paragraph in paragraphs:
        y = draw_wrapped(
            pdf,
            paragraph,
            x,
            y,
            width,
            font="PlexSans-Light",
            size=size,
            leading=leading,
            color=INK_MEDIUM,
        ) - gap
    return y


def draw_stripe(pdf: canvas.Canvas, y: float) -> None:
    x = 42
    width = PAGE_WIDTH - 84
    for color, ratio in ((TEAL, 0.40), (CORAL, 0.30), (GOLD, 0.30)):
        segment = width * ratio
        pdf.setFillColor(color)
        pdf.rect(x, y, segment, 3.5, fill=1, stroke=0)
        x += segment


def draw_wordmark(pdf: canvas.Canvas, x: float, y: float, *, size: float = 18) -> None:
    pdf.setFillColor(NAVY)
    pdf.setFont("PlexMono-SemiBold", size)
    pdf.drawString(x, y, "RPM")


def draw_small_label(pdf: canvas.Canvas, label: str, x: float, y: float) -> None:
    pdf.setFillColor(TEAL_INK)
    pdf.setFont("PlexMono-SemiBold", 6.7)
    pdf.drawString(x, y, label.upper())


def draw_link_right(pdf: canvas.Canvas, text: str, url: str, right: float, y: float) -> None:
    size = 6.2
    width = pdfmetrics.stringWidth(text, "PlexMono", size)
    left = right - width
    pdf.setFillColor(INK_LIGHT)
    pdf.setFont("PlexMono", size)
    pdf.drawString(left, y, text)
    pdf.linkURL(url, (left, y - 2, right, y + size + 2), relative=0, thickness=0)


def draw_header(pdf: canvas.Canvas, person: dict, label: str) -> None:
    draw_stripe(pdf, 752)
    draw_wordmark(pdf, 54, 706, size=17)
    pdf.setFillColor(NAVY)
    pdf.setFont("PlexSans-SemiBold", 9.2)
    pdf.drawString(111, 710, person["name"])
    pdf.setFillColor(INK_LIGHT)
    pdf.setFont("PlexMono-Medium", 5.8)
    pdf.drawString(111, 697, label.upper())
    right = PAGE_WIDTH - 54
    draw_link_right(pdf, person["email"], f"mailto:{person['email']}", right, 711)
    draw_link_right(pdf, person["linkedinDisplay"], person["linkedinUrl"], right, 698)


def draw_footer(pdf: canvas.Canvas, person: dict, page: int) -> None:
    pdf.setStrokeColor(RULE)
    pdf.setLineWidth(0.6)
    pdf.line(54, 56, PAGE_WIDTH - 54, 56)
    pdf.setFillColor(INK_LIGHT)
    pdf.setFont("PlexMono", 6.1)
    pdf.drawString(54, 39, f"{person['name'].upper()}  ·  {page:02d}")
    pdf.drawRightString(PAGE_WIDTH - 54, 39, "KENMORE, NEW YORK")


def draw_page_one(pdf: canvas.Canvas, profile: dict) -> None:
    person = profile["person"]
    letter_copy = profile["careerLetter"]
    _, technical_subtitle = resume_positioning(profile)
    pdf.setFillColor(PAPER)
    pdf.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)
    draw_header(pdf, person, letter_copy.get("label") or "Professional profile")

    headline = str(
        letter_copy.get("headline") or person.get("heroStatement") or "Career profile"
    ).strip()
    deck = str(
        letter_copy.get("deck") or person.get("resumeSummary") or ""
    ).strip()
    paragraphs = career_note_paragraphs(letter_copy)
    if not paragraphs:
        raise RuntimeError("Resume cover page requires career-note paragraphs.")

    draw_small_label(pdf, technical_subtitle, 54, 646)
    headline_y = draw_wrapped(
        pdf,
        headline,
        54,
        611,
        450,
        font="PlexSans-SemiBold",
        size=28,
        leading=32,
        color=NAVY,
    )
    deck_y = draw_wrapped(
        pdf,
        deck,
        54,
        headline_y - 8,
        480,
        font="PlexSans-Light",
        size=10.2,
        leading=15,
        color=INK_MEDIUM,
    )
    body_y = draw_paragraphs(
        pdf,
        paragraphs,
        54,
        deck_y - 27,
        500,
        size=8.65,
        leading=12.8,
        gap=8.5,
    )
    if body_y < 105:
        raise RuntimeError(f"Resume cover page is too long (lowest y={body_y:.1f}).")

    signoff = letter_copy.get("signoff") or {}
    signoff_name = str(signoff.get("name") or person["name"])
    signoff_title = str(signoff.get("title") or person.get("currentTitle") or "")
    signoff_function = str(
        signoff.get("function") or person.get("currentFunction") or ""
    )
    signoff_y = max(85, body_y - 2)
    pdf.setFillColor(NAVY)
    pdf.setFont("PlexSans-SemiBold", 9)
    pdf.drawString(54, signoff_y, signoff_name)
    pdf.setFillColor(INK_LIGHT)
    pdf.setFont("PlexSans-Light", 6.8)
    pdf.drawString(54, signoff_y - 12, f"{signoff_title}  ·  {signoff_function}")
    draw_footer(pdf, person, 1)


def draw_timeline_role(
    pdf: canvas.Canvas,
    role: dict,
    y: float,
    *,
    date_right: float,
    axis_x: float,
    content_x: float,
    content_width: float,
) -> tuple[float, float]:
    """Draw one full-width timeline role and return its next y and node y."""
    node_y = y + 1
    pdf.setFillColor(INK_LIGHT)
    pdf.setFont("PlexMono", 6.1)
    pdf.drawRightString(date_right, y + 1, role["dates"])

    title_lines = wrap_lines(
        role["title"], "PlexSans-SemiBold", 9.5, content_width
    )
    pdf.setFillColor(NAVY)
    pdf.setFont("PlexSans-SemiBold", 9.5)
    cursor_y = y
    for line in title_lines:
        pdf.drawString(content_x, cursor_y, line)
        cursor_y -= 11.3

    if role.get("functionalTitle"):
        cursor_y = draw_wrapped(
            pdf,
            role["functionalTitle"],
            content_x,
            cursor_y - 1,
            content_width,
            font="PlexSans-Medium",
            size=6.8,
            leading=8.7,
            color=INK_MEDIUM,
        )

    pdf.setFillColor(TEAL_INK)
    pdf.setFont("PlexSans-Medium", 6.9)
    pdf.drawString(content_x, cursor_y - 1, role["company"])
    cursor_y -= 14

    bullets = role_resume_bullets(role) if role.get("id") == "keybank" else []
    if bullets:
        if len(bullets) != 3:
            raise RuntimeError(
                f"KeyBank requires exactly three resume bullets; found {len(bullets)}."
            )
        for bullet in bullets:
            pdf.setStrokeColor(TEAL)
            pdf.setLineWidth(0.8)
            pdf.line(content_x, cursor_y + 2, content_x + 4.5, cursor_y + 2)
            cursor_y = draw_wrapped(
                pdf,
                bullet,
                content_x + 10,
                cursor_y,
                content_width - 10,
                font="PlexSans-Light",
                size=6.45,
                leading=8.5,
                color=INK_MEDIUM,
            ) - 2.5
    else:
        summary = role.get("careerLetterSummary") or role.get("resumeDescription") or ""
        cursor_y = draw_wrapped(
            pdf,
            summary,
            content_x,
            cursor_y,
            content_width,
            font="PlexSans-Light",
            size=6.8,
            leading=9.5,
            color=INK_MEDIUM,
        )

    return cursor_y - 7, node_y


def draw_compact_capability(
    pdf: canvas.Canvas, group: dict, x: float, y: float, width: float
) -> float:
    y = draw_wrapped(
        pdf,
        group["name"],
        x,
        y,
        width,
        font="PlexSans-Medium",
        size=7.1,
        leading=8.8,
        color=NAVY,
    ) - 2
    return draw_wrapped(
        pdf,
        ", ".join(group["items"]),
        x,
        y,
        width,
        font="PlexSans-Light",
        size=6.15,
        leading=8,
        color=INK_MEDIUM,
    )


def draw_compact_leadership(
    pdf: canvas.Canvas, item: dict, x: float, y: float, width: float
) -> float:
    y = draw_wrapped(
        pdf,
        item["title"],
        x,
        y,
        width,
        font="PlexSans-Medium",
        size=7,
        leading=8.7,
        color=NAVY,
    ) - 2
    return draw_wrapped(
        pdf,
        item["description"],
        x,
        y,
        width,
        font="PlexSans-Light",
        size=6.05,
        leading=7.9,
        color=INK_MEDIUM,
    )


def draw_page_two(pdf: canvas.Canvas, profile: dict) -> None:
    person = profile["person"]
    positioning_title, _ = resume_positioning(profile)
    letter_copy = profile["careerLetter"]
    pdf.setFillColor(PAPER)
    pdf.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)
    draw_header(pdf, person, "Resume")

    title_bottom = draw_wrapped(
        pdf,
        positioning_title,
        54,
        651,
        500,
        font="PlexSans-SemiBold",
        size=19.5,
        leading=22.5,
        color=NAVY,
    )
    deck_bottom = draw_wrapped(
        pdf,
        letter_copy.get("page2Deck") or person.get("resumeSummary") or "",
        54,
        title_bottom - 5,
        500,
        font="PlexSans-Light",
        size=8.3,
        leading=11.5,
        color=INK_MEDIUM,
    )

    # Put the compact foundation first so Analytics & Technology is part of the
    # initial scan, then let experience carry the page's primary narrative.
    capabilities_label_y = deck_bottom - 18
    draw_small_label(pdf, "Capabilities", 54, capabilities_label_y)

    requested_order = letter_copy.get("capabilityOrder") or ["Analytics & Technology"]
    capability_order = {
        name: index for index, name in enumerate(requested_order)
    }
    capabilities = sorted(
        profile.get("capabilities") or [],
        key=lambda group: capability_order.get(group["name"], len(capability_order)),
    )
    if not capabilities:
        raise RuntimeError("Resume page 2 requires at least one capability group.")
    if len(capabilities) > 4:
        raise RuntimeError(
            f"Resume supports at most four capability columns; found {len(capabilities)}."
        )
    content_width_total = PAGE_WIDTH - 108
    capability_gap = 13
    capability_width = (
        content_width_total - capability_gap * (len(capabilities) - 1)
    ) / len(capabilities)
    capability_y = capabilities_label_y - 23
    capability_bottoms: list[float] = []
    for index, group in enumerate(capabilities):
        x = 54 + index * (capability_width + capability_gap)
        capability_bottoms.append(
            draw_compact_capability(pdf, group, x, capability_y, capability_width)
        )

    experience_label_y = min(capability_bottoms) - 14
    draw_small_label(pdf, "Experience", 54, experience_label_y)

    date_right = 124
    axis_x = 143
    content_x = 163
    content_width = PAGE_WIDTH - 54 - content_x
    timeline_y = experience_label_y - 25
    node_positions: list[float] = []
    experience = profile.get("experience") or []
    for role in experience:
        timeline_y, node_y = draw_timeline_role(
            pdf,
            role,
            timeline_y,
            date_right=date_right,
            axis_x=axis_x,
            content_x=content_x,
            content_width=content_width,
        )
        node_positions.append(node_y)

    if not node_positions:
        raise RuntimeError("Resume page 2 requires at least one experience role.")

    # One continuous, quiet axis with hollow nodes keeps chronology explicit.
    pdf.setStrokeColor(RULE)
    pdf.setLineWidth(0.75)
    pdf.line(axis_x, node_positions[0], axis_x, node_positions[-1])
    for node_y in node_positions:
        pdf.setStrokeColor(TEAL_INK)
        pdf.setFillColor(PAPER)
        pdf.setLineWidth(1)
        pdf.circle(axis_x, node_y, 3.1, stroke=1, fill=1)

    leadership_label_y = timeline_y - 1
    draw_small_label(pdf, "Leadership", 54, leadership_label_y)
    leadership = profile.get("leadership") or []
    if len(leadership) != 3:
        raise RuntimeError(
            f"Resume requires three leadership columns; found {len(leadership)}."
        )
    leadership_gap = 16
    leadership_width = (
        content_width_total - leadership_gap * (len(leadership) - 1)
    ) / len(leadership)
    leadership_y = leadership_label_y - 22
    leadership_bottoms: list[float] = []
    for index, item in enumerate(leadership):
        x = 54 + index * (leadership_width + leadership_gap)
        leadership_bottoms.append(
            draw_compact_leadership(pdf, item, x, leadership_y, leadership_width)
        )

    if min(leadership_bottoms) < 66:
        raise RuntimeError(
            "Resume page 2 leadership section is too long "
            f"(lowest y={min(leadership_bottoms):.1f})."
        )
    draw_footer(pdf, person, 2)


def build(output: Path) -> None:
    register_fonts()
    profile = json.loads(PROFILE_PATH.read_text(encoding="utf-8"))
    output.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(output), pagesize=letter, pageCompression=1, invariant=1)
    person = profile["person"]
    pdf.setTitle(f"{person['name']} - Resume")
    pdf.setAuthor(person["name"])
    pdf.setSubject("Cloud automation, data infrastructure, technical management, and banking analytics resume")
    pdf.setKeywords(
        "cloud automation, data infrastructure, technical management, Python, BigQuery, "
        "SQL, portfolio analytics, risk, treasury, markets, governance"
    )
    pdf.setCreator("RPM Website resume generator")

    draw_page_one(pdf, profile)
    pdf.showPage()
    draw_page_two(pdf, profile)
    pdf.showPage()
    pdf.save()
    print(f"Built {output}")


if __name__ == "__main__":
    destination = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_OUTPUT
    build(destination)
