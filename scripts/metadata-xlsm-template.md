# XLSM 메타데이터 템플릿

`scripts/xlsm_to_metadata.py`는 `.xlsm`에서 아래 2개 시트를 읽어 `_metadata.json`을 생성합니다.

- `problems`
- `essay-problems`

## 1) problems 시트 컬럼

필수 컬럼:

- `id`
- `source`
- `year`
- `month`
- `examType` (`수능` / `모의평가` / `교육청` / `논술`)
- `subject`
- `chapter`
- `subChapter` (소단원)
- `concept`
- `difficulty`
- `answerType` (`mcq` / `short`)
- `answer`

## 2) essay-problems 시트 컬럼

필수 컬럼:

- `id`
- `source`
- `year`
- `examType` (비워두면 `논술` 자동 입력)
- `difficulty`
- `university`

선택 컬럼:

- `examYear`
- `tags` (쉼표 구분: `미분,접선`)
- `relatedProblemIds` (쉼표 구분: `2026-csat-02,2025-mock-08`)

## 실행

저장소 루트에서:

```bash
python -m pip install openpyxl
python scripts/xlsm_to_metadata.py --xlsm "C:\path\problem-metadata.xlsm"
```

기본 출력:

- `src/content/problems/_metadata.json`
- `src/content/essay-problems/_metadata.json`

시트명이 다르면:

```bash
python scripts/xlsm_to_metadata.py ^
  --xlsm "C:\path\problem-metadata.xlsm" ^
  --problems-sheet "수능메타" ^
  --essay-sheet "논술메타"
```
