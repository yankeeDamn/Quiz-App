#!/usr/bin/env python3
"""Validate the IT certification question CSV before human review/import.

Usage: python scripts/validate_it_questions.py content/it-certifications/starter-questions.csv
"""
import csv
import sys
from pathlib import Path

COLUMNS = (
    "id", "exam_code", "subject", "topic", "difficulty", "question_type",
    "question", "option_a", "option_b", "option_c", "option_d",
    "correct_option", "explanation", "language", "source_type", "review_status"
)
CHOICES = {"A", "B", "C", "D"}
DIFFICULTIES = {"Easy", "Medium", "Hard"}
SOURCES = {"original", "licensed", "institute_owned"}
STATUSES = {"needs_review", "approved", "rejected"}


def validate(path: Path) -> list[str]:
    errors: list[str] = []
    ids: set[str] = set()
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle, strict=True)
        if reader.fieldnames != list(COLUMNS):
            return ["CSV header does not match the required schema/order"]
        for line, row in enumerate(reader, start=2):
            if None in row or any(value is None for value in row.values()):
                errors.append(f"Line {line}: incorrect column count")
                continue
            row = {key: value.strip() for key, value in row.items()}
            for key in COLUMNS:
                if not row[key]:
                    errors.append(f"Line {line}: missing {key}")
            if not row["id"]:
                continue
            if row["id"] in ids:
                errors.append(f"Line {line}: duplicate id {row['id']}")
            ids.add(row["id"])
            if row["correct_option"] not in CHOICES:
                errors.append(f"Line {line}: correct_option must be A-D")
            if row["difficulty"] not in DIFFICULTIES:
                errors.append(f"Line {line}: invalid difficulty")
            if row["question_type"] != "single":
                errors.append(f"Line {line}: only single-select supported in v1")
            if row["source_type"] not in SOURCES:
                errors.append(f"Line {line}: invalid source_type")
            if row["review_status"] not in STATUSES:
                errors.append(f"Line {line}: invalid review_status")
            if len(set(row[f"option_{key.lower()}"].casefold() for key in CHOICES)) != 4:
                errors.append(f"Line {line}: answer options must be distinct")
    if not ids:
        errors.append("No questions found")
    if not errors:
        print(f"PASS: {len(ids)} structurally valid questions; human accuracy review still required")
    return errors


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python scripts/validate_it_questions.py path/to/questions.csv", file=sys.stderr)
        return 2
    try:
        errors = validate(Path(sys.argv[1]))
    except (OSError, UnicodeError, csv.Error) as exc:
        print(f"Cannot validate CSV: {exc}", file=sys.stderr)
        return 2
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
