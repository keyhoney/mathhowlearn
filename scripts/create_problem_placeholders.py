"""
ID 목록으로 문제 MDX 플레이스홀더 파일을 생성한다.

기본 입력 파일 형식(예: ../개선.md):
- 파일 상단: 템플릿 본문
- 구분선: ---
- 이후 줄들: 파일명으로 사용할 ID 목록

사용 예시:
  python scripts/create_problem_placeholders.py
  python scripts/create_problem_placeholders.py --source "..\\개선.md"
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT.parent / "개선.md"
DEFAULT_OUT_DIR = ROOT / "src" / "content" / "problems"
DEFAULT_METADATA = ROOT / "src" / "content" / "problems" / "_metadata.json"
DEFAULT_TEMPLATE = "## 문제\n문제 PlaceHolder\n\n## 힌트\n힌트 PlaceHolder\n\n## 풀이\n풀이 PlaceHolder\n"


def parse_source(source_path: Path) -> tuple[str, list[str]]:
    text = source_path.read_text(encoding="utf-8")
    lines = text.splitlines()

    sep_index = -1
    for i, line in enumerate(lines):
        if line.strip() == "---":
            sep_index = i
            break

    start_index = -1
    if sep_index >= 0:
        start_index = sep_index + 1
        template_lines = lines[:sep_index]
    else:
        # 구분선이 없으면 첫 번째 8자리 숫자 라인부터 ID 목록으로 본다.
        for i, line in enumerate(lines):
            s = line.strip()
            if len(s) == 8 and s.isdigit():
                start_index = i
                break
        if start_index < 0:
            raise ValueError("입력 파일에서 ID 목록 시작 지점을 찾을 수 없습니다.")
        template_lines = lines[:start_index]

    template = "\n".join(template_lines).rstrip() + "\n"
    ids = [line.strip() for line in lines[start_index:] if line.strip()]
    return template, ids


def validate_ids(ids: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for raw in ids:
        if any(ch in raw for ch in ('\\', '/', ':', '*', '?', '"', "<", ">", "|")):
            raise ValueError(f"파일명으로 사용할 수 없는 ID: {raw}")
        if raw in seen:
            continue
        seen.add(raw)
        out.append(raw)
    return out


def load_ids_from_metadata(metadata_path: Path) -> list[str]:
    raw = metadata_path.read_text(encoding="utf-8-sig")
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        raise ValueError("메타데이터 JSON 루트가 object가 아닙니다.")
    return [str(k).strip() for k in payload.keys() if str(k).strip()]


def load_template_from_file(template_path: Path) -> str:
    text = template_path.read_text(encoding="utf-8")
    lines = text.splitlines()
    sep_index = -1
    for i, line in enumerate(lines):
        if line.strip() == "---":
            sep_index = i
            break
    body = lines if sep_index < 0 else lines[:sep_index]
    return "\n".join(body).rstrip() + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="문제 MDX 플레이스홀더 대량 생성")
    parser.add_argument(
        "--source",
        default=str(DEFAULT_SOURCE),
        help="ID 목록+템플릿 파일 경로 (선택)",
    )
    parser.add_argument(
        "--metadata",
        default=str(DEFAULT_METADATA),
        help="ID를 읽을 metadata JSON 경로 (기본: src/content/problems/_metadata.json)",
    )
    parser.add_argument(
        "--use-metadata",
        action="store_true",
        help="source 대신 metadata JSON 키를 ID 목록으로 사용한다",
    )
    parser.add_argument(
        "--template-file",
        default="",
        help="템플릿 본문을 읽을 파일 경로(있으면 이 값 우선)",
    )
    parser.add_argument(
        "--out-dir",
        default=str(DEFAULT_OUT_DIR),
        help="출력 디렉터리 (기본: src/content/problems)",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="이미 존재하는 파일도 덮어쓴다",
    )
    args = parser.parse_args()

    source_path = Path(args.source).expanduser().resolve()
    metadata_path = Path(args.metadata).expanduser().resolve()
    out_dir = Path(args.out_dir).expanduser().resolve()

    out_dir.mkdir(parents=True, exist_ok=True)

    if args.template_file:
        template = load_template_from_file(Path(args.template_file).expanduser().resolve())
    else:
        template = DEFAULT_TEMPLATE

    raw_ids: list[str]
    if args.use_metadata:
        if not metadata_path.is_file():
            raise FileNotFoundError(f"metadata JSON 파일을 찾을 수 없습니다: {metadata_path}")
        raw_ids = load_ids_from_metadata(metadata_path)
    else:
        if not source_path.is_file():
            raise FileNotFoundError(f"입력 파일을 찾을 수 없습니다: {source_path}")
        template, raw_ids = parse_source(source_path)

    ids = validate_ids(raw_ids)

    created = 0
    skipped = 0
    overwritten = 0

    for problem_id in ids:
        out_path = out_dir / f"{problem_id}.mdx"
        if out_path.exists() and not args.overwrite:
            skipped += 1
            continue
        if out_path.exists() and args.overwrite:
            overwritten += 1
        else:
            created += 1
        out_path.write_text(template, encoding="utf-8")

    print(f"source: {source_path if not args.use_metadata else '(metadata mode)'}")
    if args.use_metadata:
        print(f"metadata: {metadata_path}")
    print(f"out_dir: {out_dir}")
    print(f"total_ids: {len(ids)}")
    print(f"created: {created}")
    print(f"overwritten: {overwritten}")
    print(f"skipped: {skipped}")


if __name__ == "__main__":
    main()
