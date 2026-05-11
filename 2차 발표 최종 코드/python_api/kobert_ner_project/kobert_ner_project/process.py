import os
import re
import pandas as pd
import pdfplumber
import requests
import tempfile
import zipfile

from tika import parser
from lxml import etree


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
    r"^\s*제\s*\d+\s*장",
]


########################################
# ===== 챕터 제목 정리 =====
########################################

def clean_start(text):
    text = text.strip()

    while True:
        new_text = text

        # 숫자 계층 (1. / 1-1 / 1.1 등)
        new_text = re.sub(r'^\d+([.\-]\d+)*[.\-]?\s*', '', new_text)

        #숫자 괄호 (1) / 2) / (1)
        new_text = re.sub(r'^\(?\d+\)\s*', '', new_text)

        # 대괄호 숫자 [1]
        new_text = re.sub(r'^\[\d+\]\s*', '', new_text)

        #원형 숫자 (① ② ③ …)
        new_text = re.sub(r'^[①②③④⑤⑥⑦⑧⑨⑩]+\s*', '', new_text)

        #한글 항목 (가. 나. / 가) 등)
        new_text = re.sub(r'^[가-힣][\.\)]\s*', '', new_text)

        # 영문 항목 (A. a) 등)
        new_text = re.sub(r'^[A-Za-z][\.\)]\s*', '', new_text)

        #(※, ●, ■, -, ▶ 등)
        new_text = re.sub(r'^[\-\*\•\●\■\※\▶\▷\◆\◇]+\s*', '', new_text)

        # 반복 종료 조건
        if new_text == text:
            break

        text = new_text.strip()

    #마지막 찌꺼기 기호 제거
    text = re.sub(r'^[^\w가-힣]+', '', text)

    return text.strip()

########################################
# ===== 라인 정리 =====
########################################

def merge_lines(lines):
    merged = []
    buffer = ""

    for line in lines:
        line = line.strip()

        if not line:
            continue

        #숫자 또는 특수문자로 시작하면 새로운 문장
        if re.match(r'^[^가-힣A-Za-z]', line):
            if buffer:
                merged.append(buffer.strip())
            buffer = line
        else:
            # 이전 문장에 이어붙이기
            buffer += " " + line

    # 마지막 처리
    if buffer:
        merged.append(buffer.strip())

    return merged


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
# ===== 문장 분리 =====
########################################

def split_sentences(lines):
    sentences = []
    num = 1

    lines = merge_lines(lines)

    for line in lines:

        line = line.strip()

        if not line:
            continue

        parts = re.split(r"[.!?]\s+|\n", line)

        for p in parts:
            p = clean_start(p)

            if not p:
                continue

            if len(p) <= 6:
                continue

            sentences.append({
                "sentenceId": num,
                "sentence": p
            })

            num += 1

    return sentences


# ========================================
# ===== Excel =====
# ========================================

def extract_excel(file_path):

    output = []

    try:

        ext = os.path.splitext(file_path)[1].lower()

        # 확장자별 엔진 선택
        if ext == ".xls":
            engine = "xlrd"
        else:
            engine = "openpyxl"

        xls = pd.ExcelFile(
            file_path,
            engine=engine
        )

        for sheet in xls.sheet_names:

            df = pd.read_excel(
                xls,
                sheet_name=sheet,
                header=None,
                dtype=str
            )

            df = df.fillna("")

            for row in df.values:

                row_text = " | ".join(
                    str(cell).strip()
                    for cell in row
                    if str(cell).strip()
                )

                if row_text:
                    output.append(row_text)

        print(f"[EXCEL] extracted rows: {len(output)}")

    except Exception as e:

        print(f"[ERROR] Excel extraction failed: {file_path}")
        print(e)

    return output

    
########################################
# ===== PDF =====
########################################

def extract_pdf(file_path):
    full_text = []

    try:

        with pdfplumber.open(file_path) as pdf:

            for page in pdf.pages:

                text = page.extract_text()

                if text:
                    full_text.append(text)

    except Exception as e:

        print(f"[ERROR] PDF extraction failed: {file_path} / {e}")

    combined_text = "\n".join(full_text)

    return extract_by_chapter(combined_text)



# ========================================
# ===== HWP =====
# ========================================

def extract_hwp(file_path):

    try:

        parsed = parser.from_file(file_path)

        text = parsed.get("content", "") or ""

        if not text.strip():

            print(f"[WARN] No content extracted: {file_path}")

            return []

        return extract_by_chapter(text)

    except Exception as e:

        print(f"[ERROR] HWP extraction failed: {file_path} / {e}")

        return []


# ========================================
# ===== HWPX =====
# ========================================

def extract_hwpx(file_path):

    normal_lines = []
    table_lines = []

    try:

        with zipfile.ZipFile(file_path, 'r') as z:

            xml_files = [
                f for f in z.namelist()
                if f.endswith(".xml")
            ]

            for xml_file in xml_files:

                with z.open(xml_file) as f:

                    tree = etree.parse(f)

                    root = tree.getroot()

                    # 일반 텍스트
                    # 일반 문단 처리
                    paragraphs = root.xpath(
                        "//*[local-name()='p']"
                    )

                    for para in paragraphs:

                        texts = para.xpath(
                            ".//*[local-name()='t']/text()"
                        )

                        merged = "".join(
                            t
                            for t in texts
                            if t.strip()
                        ).strip()

                        if merged:
                            normal_lines.append(merged)

                    # 표 처리
                    tables = root.xpath(
                        "//*[local-name()='tbl']"
                    )

                    for table in tables:

                        rows = table.xpath(
                            ".//*[local-name()='tr']"
                        )

                        for row in rows:

                            cells = row.xpath(
                                ".//*[local-name()='tc']"
                            )

                            cell_texts = []

                            for cell in cells:

                                texts = cell.xpath(
                                    ".//*[local-name()='t']/text()"
                                )

                                merged = " ".join(
                                    t.strip()
                                    for t in texts
                                    if t.strip()
                                )

                                if merged:
                                    cell_texts.append(merged)

                            if cell_texts:

                                # 표는 그대로 유지
                                row_sentence = " | ".join(cell_texts)

                                table_lines.append(row_sentence)

    except Exception as e:

        print(f"[ERROR] HWPX extraction failed: {file_path} / {e}")

    combined_text = "\n".join(normal_lines)

    filtered_lines = extract_by_chapter(
        combined_text
    )

    return filtered_lines, table_lines


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

                        elif ext == ".hwp":
                lines = extract_hwp(path)
                sentences = split_sentences(lines)

            elif ext == ".hwpx":
                normal_lines, table_lines = extract_hwpx(path)
                sentences = split_sentences(normal_lines)

                sentences.extend(table_lines)

            else:
                sentences = []

            results.append({
                "bidNtceNo": bid_id,
                "ntceSpecFileNm": file_name,
                "ntceSpecDocUrl": file_url,
                "sentences": sentences
            })

        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except PermissionError:
                    pass

    return results
