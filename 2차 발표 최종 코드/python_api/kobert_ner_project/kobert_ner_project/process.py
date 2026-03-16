import os
import re
import pandas as pd
import pdfplumber
import requests
import tempfile

from tika import parser


########################################
# ===== 설정 =====
########################################

KEEP_TITLE_KEYWORDS = ["자재", "재료", "제품", "기구", "기기", "부속품"]
KEYWORD_MATCH_MODE = "OR"


########################################
# ===== 챕터 제목 패턴 =====
########################################

CHAPTER_PATTERNS = [
    r"^\s*(제\s*)?\d+\s*장\b",
    r"^\s*[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+\.?",
    r"^\s*\d+\.\d+(\.\d+)?\s+",
    r"^\s*[●■◆▶]\s*",
]


########################################
# ===== 공통 유틸 =====
########################################

def is_chapter_title(line: str) -> bool:
    return any(re.match(p, line) for p in CHAPTER_PATTERNS)


def match_chapter_title(title: str) -> bool:
    if KEYWORD_MATCH_MODE.upper() == "AND":
        return all(k in title for k in KEEP_TITLE_KEYWORDS)
    return any(k in title for k in KEEP_TITLE_KEYWORDS)


def extract_by_chapter(text: str):
    collecting = False
    buffer = []

    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue

        if is_chapter_title(line):
            collecting = match_chapter_title(line)

        if collecting:
            buffer.append(line)

    return buffer


########################################
# ===== PDF =====
########################################

def extract_pdf(file_path):

    full_text = []

    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                full_text.append(text)

    combined_text = "\n".join(full_text)

    return extract_by_chapter(combined_text)


########################################
# ===== Excel =====
########################################

def extract_excel(file_path):
    
    output = []

    with pd.ExcelFile(file_path) as xls:

        for sheet in xls.sheet_names:

            if match_chapter_title(sheet):

                df = pd.read_excel(xls, sheet_name=sheet)

                output.append(df.to_csv(sep="\t", index=False))

    return output


########################################
# ===== HWP/HWPX =====
########################################

def extract_hwp_like(file_path):
    try:
        parsed = parser.from_file(file_path)
        text = parsed.get("content", "") or ""

        if not text.strip():
            return []

        return extract_by_chapter(text)

    except Exception as e:
        print(f"HWP/HWPX 파싱 오류: {e}")
        return []


########################################
# ===== 문장 분리 =====
########################################

def split_sentences(lines):

    sentences = []
    num = 1

    for line in lines:

        parts = re.split(r"[.!?]\s+|\n", line)

        for p in parts:
            p = p.strip()

            if not p:
                continue

            sentences.append({
                "sentenceId": num,
                "sentence": p
            })

            num += 1

    return sentences


########################################
# ===== 메인 처리 함수 =====
########################################

def process_file(data):
    
    results = []

    files = data.get("files", [])

    for file in files:

        bid_id = file.get("bidNtceNo")
        file_name = file.get("fileName")
        file_url = file.get("fileUrl")

        if not file_name or not file_url:
            continue

        ext = os.path.splitext(file_name)[1].lower()
        tmp_path = None

        try:

            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                tmp_path = tmp.name

            r = requests.get(file_url, timeout=30)
            r.raise_for_status()

            with open(tmp_path, "wb") as f:
                f.write(r.content)

            if ext == ".pdf":
                lines = extract_pdf(tmp_path)

            elif ext in [".xls", ".xlsx"]:
                lines = extract_excel(tmp_path)

            elif ext in [".hwp", ".hwpx"]:
                lines = extract_hwp_like(tmp_path)

            else:
                lines = []

            sentences = split_sentences(lines)

            results.append({
                "bidNtceNo": bid_id,
                "ntceSpecFileNm": file_name,
                "sentences": sentences
            })

        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except PermissionError:
                    pass

    return results