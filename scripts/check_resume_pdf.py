#!/usr/bin/env python3
"""Verify the two-page resume's format, canonical positioning, and timeline."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from pypdf import PdfReader
from pypdf.generic import ContentStream


ROOT = Path(__file__).resolve().parent.parent
PROFILE = json.loads((ROOT / "content" / "profile.json").read_text(encoding="utf-8"))
PDF_PATH = (
    Path(sys.argv[1]).resolve()
    if len(sys.argv) > 1
    else ROOT / "Robert Perry Morris _ Resume.pdf"
)

EXPECTED_TITLE = "Vice President, Business Banking Portfolio Analytics"
EXPECTED_SUBJECT = (
    "Business operations, decision systems, governance, and cross-functional "
    "execution resume"
)
EXPECTED_KEYWORDS = (
    "business operations, decision systems, operating model design, governance, "
    "process automation, portfolio management, strategy, cross-functional leadership"
)
OLD_PAGE_TWO_TITLE = "Experience, capabilities & leadership"


def fail(message: str) -> None:
    raise AssertionError(message)


def normalize(value: str) -> str:
    return " ".join(str(value).split()).lower()


def paragraph_list(value: object) -> list[str]:
    if isinstance(value, str):
        text = value.strip()
        return [text] if text else []
    if isinstance(value, (list, tuple)):
        return [str(item).strip() for item in value if str(item).strip()]
    return []


def career_note_paragraphs() -> list[str]:
    letter_copy = PROFILE["careerLetter"]
    for key in ("careerNoteParagraphs", "profileParagraphs", "bodyParagraphs"):
        complete = paragraph_list(letter_copy.get(key))
        if complete:
            return complete
    return (
        paragraph_list(
            letter_copy.get("openingParagraphs")
            or letter_copy.get("introductionParagraphs")
        )
        + paragraph_list(
            letter_copy.get("profileStatement")
            or letter_copy.get("operatingThesis")
        )
        + paragraph_list(
            letter_copy.get("closingParagraphs")
            or letter_copy.get("outlookParagraphs")
        )
    )


def positioning_values() -> tuple[str, str]:
    positioning = PROFILE.get("positioning")
    if not isinstance(positioning, dict):
        fail("Profile requires a top-level positioning object.")
    label = str(positioning.get("label") or "").strip()
    statement = str(positioning.get("statement") or "").strip()
    if not label or not statement:
        fail("Profile positioning requires non-empty label and statement values.")
    return label, statement


def require_terms(value: str, terms: tuple[str, ...], context: str) -> None:
    normalized = normalize(value)
    for term in terms:
        if normalize(term) not in normalized:
            fail(f"{context} is missing required language: {term!r}.")


positioning_label, positioning_statement = positioning_values()
if PROFILE["person"].get("currentTitle") != EXPECTED_TITLE:
    fail(
        "Profile current title is missing or stale: "
        f"expected {EXPECTED_TITLE!r}, found {PROFILE['person'].get('currentTitle')!r}."
    )

capability_names = [group["name"] for group in PROFILE.get("capabilities") or []]
capability_order = PROFILE["careerLetter"].get("capabilityOrder")
if (
    not isinstance(capability_order, list)
    or len(capability_order) != len(set(capability_order))
    or set(capability_order) != set(capability_names)
):
    fail("careerLetter.capabilityOrder must list every capability group exactly once.")

keybank = next(
    (role for role in PROFILE["experience"] if role.get("id") == "keybank"), None
)
if not keybank:
    fail("Profile is missing the KeyBank experience record.")
resume_bullets = keybank.get("resumeBullets")
if not isinstance(resume_bullets, list) or len(resume_bullets) != 3:
    fail("KeyBank must define exactly three resumeBullets.")
if len(set(resume_bullets)) != 3:
    fail("KeyBank resumeBullets must be distinct.")

profile_text = json.dumps(PROFILE, ensure_ascii=False)
keybank_text = json.dumps(keybank, ensure_ascii=False)
require_terms(
    keybank_text,
    (
        "risk-scoring dashboard",
        "UAT",
        "relationship-manager compensation decisions",
        "freezing or downgrading risk ratings",
        "manual",
        "Excel-based",
        "Regulation B",
        "hundreds of applications a day",
        "fully automated",
        "risk partners",
        "operate an existing exposure model",
        "$55M",
        "$3M",
        "recovered",
    ),
    "Canonical KeyBank record",
)
reader = PdfReader(PDF_PATH)
if len(reader.pages) != 2:
    fail(f"Resume must be exactly two pages; found {len(reader.pages)}.")

for number, page in enumerate(reader.pages, 1):
    width = float(page.mediabox.width)
    height = float(page.mediabox.height)
    if abs(width - 612) > 0.1 or abs(height - 792) > 0.1:
        fail(f"Resume page {number} is not US Letter ({width:g} x {height:g} pt).")

page_text = [page.extract_text() or "" for page in reader.pages]
normalized_pages = [normalize(value) for value in page_text]
normalized = " ".join(normalized_pages)
page_one, page_two = normalized_pages

if normalize(positioning_label) not in page_one:
    fail("Page 1 is missing the canonical short positioning label.")
if normalize(positioning_statement) not in page_one:
    fail("Page 1 is missing the canonical positioning statement.")
for paragraph in career_note_paragraphs():
    if normalize(paragraph) not in page_one:
        fail(f"Page 1 is missing career-note content: {paragraph}")
if "where this work travels" in page_one:
    fail("Page 1 retains the staged 'Where this work travels' treatment.")
if normalize(EXPECTED_TITLE) not in page_two:
    fail("Page 2 is missing the official current title.")
if normalize(OLD_PAGE_TWO_TITLE) in normalized:
    fail(f"Resume retains the old page 2 title: {OLD_PAGE_TWO_TITLE!r}.")

for fact in resume_bullets:
    if normalize(fact) not in page_two:
        fail(f"Page 2 is missing a canonical KeyBank resume bullet: {fact}")

required_global = [
    PROFILE["person"]["name"],
    PROFILE["person"]["currentTitle"],
    PROFILE["person"]["currentFunction"],
    PROFILE["person"]["email"],
    positioning_statement,
]
for value in required_global:
    if normalize(value) not in normalized:
        fail(f"Resume is missing canonical content: {value}")

for role in PROFILE["experience"]:
    for value in (role["dates"], role["title"], role["company"]):
        if normalize(value) not in page_two:
            fail(f"Timeline is missing canonical role content: {value}")
    if role.get("id") != "keybank":
        summary = role.get("careerLetterSummary") or role.get("resumeDescription")
        if summary and normalize(summary) not in page_two:
            fail(f"Timeline is missing the summary for {role['title']}.")

for group in PROFILE["capabilities"]:
    if normalize(group["name"]) not in page_two:
        fail(f"Page 2 is missing capability group: {group['name']}")
for item in PROFILE["leadership"]:
    if normalize(item["title"]) not in page_two:
        fail(f"Page 2 is missing leadership item: {item['title']}")
if len(PROFILE["leadership"]) != 3:
    fail("Page 2 requires exactly three leadership items for its three-column close.")

page_two_lines = [normalize(line) for line in page_text[1].splitlines()]
section_positions = {}
for section in ("capabilities", "experience", "leadership"):
    try:
        section_positions[section] = page_two_lines.index(section)
    except ValueError:
        section_positions[section] = -1
if any(position < 0 for position in section_positions.values()):
    fail("Page 2 is missing an Experience, Capabilities, or Leadership label.")
if not (
    section_positions["capabilities"]
    < section_positions["experience"]
    < section_positions["leadership"]
):
    fail("Page 2 sections are not ordered Capabilities, Experience, Leadership.")

capability_positions = {}
for group in PROFILE["capabilities"]:
    try:
        capability_positions[group["name"]] = page_two_lines.index(
            normalize(group["name"])
        )
    except ValueError:
        capability_positions[group["name"]] = -1
ordered_capability_positions = [
    capability_positions.get(name, -1) for name in capability_order
]
if any(position < 0 for position in ordered_capability_positions):
    fail("Page 2 is missing one or more ordered capability groups.")
if ordered_capability_positions != sorted(ordered_capability_positions):
    fail("Page 2 capability groups do not follow careerLetter.capabilityOrder.")
if any(
    not section_positions["capabilities"] < position < section_positions["experience"]
    for position in capability_positions.values()
):
    fail("Every capability group must appear within the Capabilities section.")

for item in PROFILE["leadership"]:
    try:
        position = page_two_lines.index(normalize(item["title"]))
    except ValueError:
        position = -1
    if position <= section_positions["leadership"]:
        fail(f"Leadership item is outside the Leadership section: {item['title']}")

for number, text in enumerate(page_text, 1):
    if text.count("RPM") < 1:
        fail(f"Page {number} is missing the plain RPM wordmark.")

# ReportLab circles use four cubic curves and a fill/stroke operator. Requiring
# one complete set per role guards the hollow-node timeline treatment.
page_two_stream = ContentStream(reader.pages[1].get_contents(), reader)
operators = [operator for _, operator in page_two_stream.operations]
if operators.count(b"c") < len(PROFILE["experience"]) * 4:
    fail("Page 2 timeline is missing one or more circular nodes.")
if sum(operator in (b"B", b"B*") for operator in operators) < len(
    PROFILE["experience"]
):
    fail("Page 2 timeline nodes are not rendered as hollow stroked shapes.")
if operators.count(b"l") < 5:
    fail("Page 2 is missing the continuous timeline axis or bullet rules.")

page_one_stream = ContentStream(reader.pages[0].get_contents(), reader)
page_one_operators = [operator for _, operator in page_one_stream.operations]
if page_one_operators.count(b"l") > 1:
    fail("Page 1 retains a highlighted thesis rule instead of a plain reading flow.")

for number, page in enumerate(reader.pages, 1):
    resources = page.get("/Resources") or {}
    xobjects = resources.get("/XObject")
    if xobjects:
        for reference in xobjects.get_object().values():
            if reference.get_object().get("/Subtype") == "/Image":
                fail(
                    f"Page {number} must not contain raster or SVG-derived image assets."
                )

outdated = [
    "connective fiber",
    "my edge",
    "ai accelerator",
    "productivity workshops",
    "key player",
    "massive",
    "cementing",
    "13 years",
    "senior business analytics associate",
    "served as chief of staff",
    "banking strategy · portfolio management · risk analytics",
    "turning portfolio data, risk signals",
    "cloud automation · data infrastructure · technical management",
    "vertex notebooks",
    "bigquery",
    "402 gb",
    "data commentary pipeline",
    "$2.9m",
    "credit exposure mitigated",
    "built analytical frameworks",
    "backlog",
    "executed approximately $10b",
]
normalized_profile = normalize(profile_text)
for phrase in outdated:
    if phrase in normalized or phrase in normalized_profile:
        fail(f'Resume or canonical profile retains stale language: "{phrase}".')

metadata = reader.metadata or {}
expected_metadata_title = f"{PROFILE['person']['name']} - Resume"
if metadata.get("/Title") != expected_metadata_title:
    fail("Resume title metadata is missing or stale.")
if metadata.get("/Subject") != EXPECTED_SUBJECT:
    fail("Resume subject metadata is missing or stale.")
if metadata.get("/Keywords") != EXPECTED_KEYWORDS:
    fail("Resume keyword metadata is missing or stale.")

print("Resume PDF checks passed.")
