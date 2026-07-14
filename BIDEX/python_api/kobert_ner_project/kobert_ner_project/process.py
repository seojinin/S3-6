import os
import re
import pandas as pd
import pdfplumber
import requests
import tempfile
import zipfile
import opendataloader_pdf
import fitz
import json
import shutil
from pathlib import Path
import win32com.client
from lxml import etree

########################################
# ===== 설정 =====
########################################

hwp = win32com.client.gencache.EnsureDispatch("HWPFrame.HwpObject")

os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["HF_HUB_DISABLE_SYMLINKS"] = "1"

ATTACHMENT_NAME_PATTERNS = [
    r"시\s*방\s*서",
    r"제\s*안\s*요\s*청\s*서",
    r"과\s*업\s*지\s*시\s*서",
]

KEEP_TITLE_KEYWORDS = ["자재", "재료", "제품", "기구", "기기", "부속품"]
KEYWORD_MATCH_MODE = "OR"


########################################
# ===== 첨부파일 필터 =====
########################################

def is_target_doc(file_name):
    return any(
        re.search(pattern, file_name)
        for pattern in ATTACHMENT_NAME_PATTERNS
    )


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

        new_text = re.sub(r'^\d+([.\-]\d+)*[.\-]?\s*', '', new_text)    # 숫자 계층
        new_text = re.sub(r'^\(?\d+\)\s*', '', new_text)    # 숫자 괄호
        new_text = re.sub(r'^\[\d+\]\s*', '', new_text)    # 대괄호 숫자
        new_text = re.sub(r'^[①②③④⑤⑥⑦⑧⑨⑩]+\s*', '', new_text)    # 원형 숫자
        new_text = re.sub(r'^[가-힣][\.\)]\s*', '', new_text)    # 한글 항목
        new_text = re.sub(r'^[A-Za-z][\.\)]\s*', '', new_text)    # 영문 항목
        new_text = re.sub(r'^[\-\*\•\●\■\※\▶\▷\◆\◇]+\s*', '', new_text)    # 특수기호
        if new_text == text:
            break

        text = new_text.strip()

    # 마지막 찌꺼기 기호 제거
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

        # 숫자 또는 특수문자로 시작하면 새로운 문장
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

def split_sentences(lines, start_id):
    sentences = []

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
                "sentenceId": start_id,
                "sentence": p
            })

            start_id += 1

    return sentences


# ========================================
# ===== 표 병합 셀 처리 =====
# ========================================

def fill_merged_cells(table):
    if not table:
        return table

    max_cols = max(len(row) for row in table)

    normalized = []

    for row in table:

        row = list(row)

        while len(row) < max_cols:
            row.append(None)

        normalized.append(row)

    for r in range(len(normalized)):

        for c in range(max_cols):

            val = normalized[r][c]

            if val is None or str(val).strip() == "":

                if r > 0:

                    upper = normalized[r - 1][c]

                    if upper not in [None, ""]:
                        normalized[r][c] = upper

    for r in range(len(normalized)):

        for c in range(max_cols):

            val = normalized[r][c]

            if val is None or str(val).strip() == "":

                if c > 0:

                    left = normalized[r][c - 1]

                    if left not in [None, ""]:
                        normalized[r][c] = left

    return normalized


# ========================================
# ===== pdf 표 추출 =====
# ========================================
def extract_pdf_tables(page, start_id):
    lines = []
    num = start_id

    try:

        tables = page.extract_tables()

        for table in tables:

            if not table:
                continue

            table = fill_merged_cells(table)

            for row in table:

                cells = []

                for cell in row:

                    # 공백 셀
                    if cell is None:
                        cell = "-"

                    cell = str(cell).strip()

                    if not cell:
                        cell = "-"

                    # 줄바꿈 제거
                    cell = re.sub(r"\s+", " ", cell)

                    cells.append(cell)

                row_text = " | ".join(cells)

                lines.append({"sentenceId": num, "sentence": row_text})
                num += 1

    except Exception as e:

        print(f"[WARN] table extraction failed: {e}")

    return lines, num


# ========================================
# ===== Excel =====
# ========================================

def extract_excel(file_path):
    output = []
    num = 1

    try:

        ext = os.path.splitext(file_path)[1].lower()

        # 확장자별 엔진 선택
        if ext == ".xls":
            engine = "xlrd"
        else:
            engine = "openpyxl"

        xls = pd.ExcelFile(file_path, engine=engine)

        for sheet in xls.sheet_names:

            df = pd.read_excel(xls, sheet_name=sheet, header=None, dtype=str)

            df = df.fillna("")

            for row in df.values:

                cells = []

                for cell in row:

                    cell = str(cell).strip()

                    if not cell or cell == "nan":
                        cell = "-"

                    cells.append(cell)

                row_text = " | ".join(cells)

                if row_text:
                    output.append({"sentenceId": num, "sentence": row_text})
                    num += 1

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
    table_lines = []

    try:

        with pdfplumber.open(file_path) as pdf:

            next_id = 1

            for page in pdf.pages:

                # 1차: 표 영역 제외 후 텍스트 추출
                text_page = page

                try:
                    tables = page.find_tables()

                    for table in tables:
                        bbox = table.bbox

                        text_page = text_page.outside_bbox(bbox)        # 표 영역 제거

                except Exception as e:

                    print(f"[WARN] table bbox remove failed: {e}")

                text = text_page.extract_text()

                if text:
                    full_text.append(text)

                # 2차: 표만 별도 추출
                tables,next_id = extract_pdf_tables(page,next_id)

                if tables:
                    table_lines.extend(tables)

    except Exception as e:

        print(f"[ERROR] PDF extraction failed: {file_path} / {e}")

    combined_text = "\n".join(full_text)

    text_length = len(combined_text.strip())

    print(f"[PDF TEXT LENGTH] {text_length}")

    # 3차: 텍스트형 PDF
    if text_length > 100:
        normal_lines = extract_by_chapter(combined_text)

        return normal_lines, table_lines

    # 4차: 이미지형 PDF → OCR
    print("[INFO] OCR fallback")

    ocr_lines, ocr_tables = extract_pdf_ocr(file_path)

    return ocr_lines, ocr_tables

# ========================================
# ===== OCR =====
# ========================================

def extract_pdf_ocr(file_path):
    normal_lines = []
    table_lines = []

    try:

        pdf = fitz.open(file_path)

        total_pages = len(pdf)

        chunk_size = 15

        print(f"[OCR] total pages = {total_pages}")

        for start_page in range(0, total_pages, chunk_size):

            end_page = min(start_page + chunk_size, total_pages)

            print(f"[OCR CHUNK] {start_page + 1} ~ {end_page}")

            with tempfile.TemporaryDirectory() as temp_dir:

                chunk_pdf = fitz.open()

                for page_num in range(start_page, end_page):
                    chunk_pdf.insert_pdf(
                        pdf,
                        from_page=page_num,
                        to_page=page_num
                    )

                chunk_path = os.path.join(
                    temp_dir,
                    f"chunk_{start_page}.pdf"
                )

                chunk_pdf.save(chunk_path)
                chunk_pdf.close()

                # OCR 실행
                opendataloader_pdf.convert(
                    input_path=[chunk_path],
                    output_dir=temp_dir,
                    format=["json"],                  # ② markdown 제거
                    hybrid="docling-fast",
                    hybrid_url="http://127.0.0.1:5002",
                    hybrid_mode="full"
                )

                json_files = [
                    f for f in os.listdir(temp_dir)
                    if f.endswith(".json")
                ]

                if not json_files:
                    continue

                json_path = os.path.join(temp_dir, json_files[0])

                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)

                # ======================================
                # 재귀 탐색
                # ======================================

                def walk(node):

                    if isinstance(node, list):
                        for child in node:
                            walk(child)
                        return

                    if not isinstance(node, dict):
                        return

                    node_type = node.get("type")

                    # 제목 / 문단
                    if node_type in ("heading", "paragraph"):

                        text = node.get("content", "").strip()

                        if text:
                            normal_lines.append(text)

                    # 리스트
                    elif node_type == "list":

                        for item in node.get("list items", []):

                            text = item.get("content", "").strip()

                            if text:
                                normal_lines.append(text)

                    # 표
                    elif node_type == "table":

                        content = node.get("content", "")

                        if content:

                            for row in content.split("\n"):

                                row = row.strip()

                                if row:
                                    table_lines.append(row)

                    # 하위 kids 재귀 탐색
                    if "kids" in node:
                        walk(node["kids"])

                    # list item 내부 kids
                    if "list items" in node:
                        for item in node["list items"]:
                            if "kids" in item:
                                walk(item["kids"])

                walk(data)

        pdf.close()

        # ======================================
        # 후처리
        # ======================================

        temp_text = "\n".join(normal_lines)

        normal_lines = extract_by_chapter(temp_text)

        print("[NORMAL LINES]", len(normal_lines))
        print(normal_lines[:20])

        return normal_lines, table_lines

    except Exception as e:

        print(f"[OCR ERROR] {file_path} / {e}")

        return [], []


# ========================================
# ===== HWP =====
# ========================================

def extract_hwp(file_path):

    sentences = []
    try:
        # 임시 PDF 경로 생성
        hwp_path = Path(file_path)
        pdf_path = hwp_path.with_suffix(".pdf")

        # --------------------------
        # HWP -> PDF
        # --------------------------
        hwp.Open(os.path.abspath(str(hwp_path)), "", "")
        hwp.SaveAs(str(pdf_path), "PDF")
        hwp.Clear(3)

        # --------------------------
        # PDF -> TXT
        # --------------------------
        normal_lines, table_lines = extract_pdf(str(pdf_path))

        start_id = len(table_lines) + 1
        normal_lines = split_sentences(normal_lines, start_id)
        sentences = table_lines.copy()
        sentences.extend(normal_lines)

        # 내용이 하나도 없는 경우(HWP 기준으로 경고 출력)
        if not sentences:
            print(f"[WARN] No content extracted from HWP: {file_path}")


    except Exception as e:
        print(f"[ERROR] HWP extraction failed: {file_path} / {e}")

    finally:
        # 임시 PDF 삭제
        if pdf_path.exists():
            try:
                pdf_path.unlink()
            except Exception:
                pass

    return sentences


# ========================================
# ===== HWPX =====
# ========================================

def extract_hwpx(file_path):

    normal_lines = []
    table_lines = []
    num = 1
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

                                table_lines.append({"sentenceId": num, "sentence": row_sentence})
                                num += 1

    except Exception as e:

        print(f"[ERROR] HWPX extraction failed: {file_path} / {e}")

    combined_text = "\n".join(normal_lines)

    filtered_lines = extract_by_chapter(
        combined_text
    )

    return filtered_lines, table_lines


# ========================================
# ===== ZIP처리 함수 =====
# ========================================

def extract_zip_recursive(zip_path):

    extracted_files = []

    temp_dir = tempfile.mkdtemp()

    try:

        with zipfile.ZipFile(zip_path) as z:

            z.extractall(temp_dir)

        for root, _, files in os.walk(temp_dir):

            for file in files:

                path = os.path.join(root, file)

                # ZIP이면 재귀
                if file.lower().endswith(".zip"):

                    if is_password_zip(path):
                        print("[SKIP PASSWORD ZIP]", path)
                        continue

                    inner_files, _ = extract_zip_recursive(path)

                    extracted_files.extend(inner_files)

                else:

                    extracted_files.append(path)

        return extracted_files, temp_dir

    except Exception as e:

        print(f"[ZIP ERROR] {zip_path} / {e}")

        return [], temp_dir

# ========================================
# ===== ZIP 내부 파일명 처리 =====
# ========================================

def make_zip_output_filename(zip_name, inner_path, extract_root):

    # ZIP 내부 상대경로
    rel_path = os.path.relpath(inner_path, extract_root)

    # 확장자 제거
    rel_path = os.path.splitext(rel_path)[0]

    # 폴더 구분자를 _
    rel_path = rel_path.replace("\\", "_")
    rel_path = rel_path.replace("/", "_")

    # ZIP 이름
    zip_base = os.path.splitext(zip_name)[0]

    return f"{zip_base}_{rel_path}.txt"


# ========================================
# ===== 암호 ZIP 제외 =====
# ========================================

def is_password_zip(path):

    try:

        with zipfile.ZipFile(path) as z:

            for info in z.infolist():

                if info.flag_bits & 0x1:
                    return True

        return False

    except Exception:

        return True


########################################
# ===== 메인 처리 함수 =====
########################################

def process_file(data):
    results = []
    skipped_files = []

    files = data.get("files", [])

    try:
        hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModule")
    except Exception as e:
        print("RegisterModule 실패 :", e)

    for file in files:

        bid_id = file.get("bidNtceNo")
        file_name = file.get("fileName")
        file_url = file.get("fileUrl")

        if not file_name or not file_url:
            skipped_files.append({
                "bidNtceNo": bid_id,
                "fileName": file_name or "(이름없음)",
                "fileUrl": file_url,
                "reason": "fileName 또는 fileUrl 누락"
            })
            continue

        ext = os.path.splitext(file_name)[1].lower()
        tmp_path = None
        sentences = []

        try:

            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                tmp_path = tmp.name

            r = requests.get(file_url, timeout=120)
            r.raise_for_status()

            with open(tmp_path, "wb") as f:
                f.write(r.content)

            if ext in [".pdf", ".hwp", ".hwpx"]:

                if not is_target_doc(file_name):
                    print(f"[SKIP] Not target document : {file_name}")
                    skipped_files.append({
                        "bidNtceNo": bid_id,
                        "fileName": file_name,
                        "fileUrl": file_url,
                        "reason": "대상 문서명 아님(시방서/제안요청서/과업지시서 아님)"
                    })
                    continue

            if ext == ".pdf":
                normal_lines, table_lines = extract_pdf(tmp_path)

                start_id = len(table_lines) +1
                normal_lines = split_sentences(normal_lines,start_id)
                sentences = table_lines.copy()
                sentences.extend(normal_lines)

            elif ext in [".xls", ".xlsx"]:
                sentences = extract_excel(tmp_path)

            elif ext == ".hwp":
                sentences = extract_hwp(tmp_path)

            elif ext == ".hwpx":
                normal_lines, table_lines = extract_hwpx(tmp_path)
                
                start_id = len(table_lines) +1
                normal_lines = split_sentences(normal_lines,start_id)
                sentences = table_lines.copy()
                sentences.extend(normal_lines)

            elif ext == ".zip":

                if is_password_zip(tmp_path):
                    skipped_files.append({
                        "bidNtceNo": bid_id,
                        "fileName": file_name,
                        "fileUrl": file_url,
                        "reason": "비밀번호 걸린 ZIP"})
                    continue

                inner_files, extract_root = extract_zip_recursive(tmp_path)

                try:
                    for inner_path in inner_files:

                        inner_sentences = []

                        inner_name = os.path.basename(inner_path)
                        inner_ext = os.path.splitext(inner_name)[1].lower()

                        if inner_ext in [".pdf", ".hwp", ".hwpx"]:

                            if not is_target_doc(inner_name):
                                print(f"[ZIP SKIP] {inner_name}")
                                skipped_files.append({
                                    "bidNtceNo": bid_id,
                                    "fileName": inner_name,
                                    "fileUrl": file_url,
                                    "reason": "대상 문서명 아님(시방서/제안요청서/과업지시서 아님)"
                                })
                                continue

                        if inner_ext == ".pdf":
                            normal_lines, table_lines = extract_pdf(inner_path)
                            start_id = len(table_lines) + 1
                            normal_lines = split_sentences(normal_lines, start_id)
                            inner_sentences = table_lines.copy()
                            inner_sentences.extend(normal_lines)

                        elif inner_ext == ".hwp":
                            inner_sentences = extract_hwp(inner_path)

                        elif inner_ext == ".hwpx":
                            normal_lines, table_lines = extract_hwpx(inner_path)
                            start_id = len(table_lines) + 1
                            normal_lines = split_sentences(normal_lines, start_id)
                            inner_sentences = table_lines.copy()
                            inner_sentences.extend(normal_lines)

                        elif inner_ext in [".xls", ".xlsx"]:
                            inner_sentences = extract_excel(inner_path)

                        else:
                            skipped_files.append({
                                "bidNtceNo": bid_id,
                                "fileName": inner_name,
                                "fileUrl": file_url,
                                "reason": f"ZIP 내부 미지원 확장자({inner_ext})"})
                            continue

                        results.append({
                            "bidNtceNo": bid_id,
                            "ntceSpecFileNm": inner_name,      # ZIP 내부 파일명
                            "ntceSpecDocUrl": file_url,        # 원본 ZIP URL
                            "sentences": inner_sentences
                        })

                finally:
                    shutil.rmtree(extract_root, ignore_errors=True)

                continue

            else:
                skipped_files.append({
                    "bidNtceNo": bid_id,
                    "fileName": file_name,
                    "fileUrl": file_url,
                    "reason": f"지원하지 않는 확장자({ext})"})
                continue


            results.append({
                "bidNtceNo": bid_id,
                "ntceSpecFileNm": file_name,
                "ntceSpecDocUrl": file_url,
                "sentences": sentences
            })

        except Exception as e:
            print(f"[ERROR] 파일 처리 실패: {file_name} / {e}")
            skipped_files.append({
                "bidNtceNo": bid_id,
                "fileName": file_name,
                "fileUrl": file_url,
                "reason": f"처리 중 오류: {e}"})

        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except PermissionError:
                    pass

    return results, skipped_files
