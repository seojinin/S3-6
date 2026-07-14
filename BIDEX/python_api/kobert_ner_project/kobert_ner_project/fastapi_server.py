from fastapi import FastAPI
import os
import requests
import tempfile
import time
import multiprocessing

multiprocessing.freeze_support()

from process import process_file
from ner_inference import NERInferencer

app = FastAPI()
SPRING_URL = "http://localhost:8080/api/files/ner-result"

# 모델 로드
MODEL_PATH = "./kobert_ner_model"
ner_model = NERInferencer(MODEL_PATH)

@app.post("/process")
def process_bid(data: dict):

    total_start = time.time()

    print("JSON 수신: ", data)

    # 1. 파일 처리 / 전처리
    t1 = time.time()
    processed_result, skipped_files = process_file(data)
    t2 = time.time()

    print(f"[시간] process_file: {t2 - t1:.4f}초")
    print(f"[정보] 처리 대상 파일 수: {len(processed_result)}")
    print(f"[정보] 스킵 파일 수: {len(skipped_files)}")

    # 스킵된 파일 목록 출력
    if skipped_files:
        print("[스킵 목록]")
        for sf in skipped_files:
            print(f" - {sf['fileName']} ({sf['reason']})")

    # ==== 스킵된 파일 재시도 대상 필터링 ====
    # 재시도 적합성 검사
    retryable = [
        sf for sf in skipped_files
        if sf.get("fileUrl") and "누락" not in sf["reason"] and "지원하지 않는" not in sf["reason"]
    ]

    if retryable:
        print(f"[재시도] {len(retryable)}개 파일 재처리 시도")

        retry_data = {
            "files": [
                {
                    "bidNtceNo": sf["bidNtceNo"],
                    "fileName": sf["fileName"],
                    "fileUrl": sf["fileUrl"]
                }
                for sf in retryable
            ]
        }

        t_retry_1 = time.time()
        retry_result, retry_skipped = process_file(retry_data)
        t_retry_2 = time.time()

        print(f"[재시도] 시간: {t_retry_2 - t_retry_1:.4f}초")
        print(f"[재시도] 성공: {len(retry_result)} / 재실패: {len(retry_skipped)}")

        # 재시도 성공분 processed_result에 추가
        processed_result.extend(retry_result)

        # 최종 스킵 목록 = (재시도 대상 아닌 것) + (재실패)
        non_retryable = [sf for sf in skipped_files if sf not in retryable]
        skipped_files = non_retryable + retry_skipped

        print(f"[정보] 재시도 후 최종 스킵 파일 수: {len(skipped_files)}")

    # 재시도 이후 최종 스킵된 파일 목록 출력
    if skipped_files:
        print("[재시도 후 최종 스킵 목록]")
        for sf in skipped_files:
            print(f" - {sf['fileName']} ({sf['reason']})")

    ner_results = []

    for idx, file_result in enumerate(processed_result, start=1):
        print("=" * 60)
        print(f"[파일 {idx}] 처리 시작")

        # NER 입력 문장 확인
        print(file_result["sentences"][:10])

        # 2. NER 추론
        t3 = time.time()
        ner_result = ner_model.predict_json(file_result)
        t4 = time.time()

        bid_no = ner_result["bidNtceNo"]
        file_name = ner_result["ntceSpecFileNm"]
        file_url = ner_result["ntceSpecDocUrl"]

        # 3. 후처리 (entities 생성)
        t5 = time.time()
        entities = []

        for s in ner_result["sentences"]:
            for kw in s["keywords"]:
                entities.append({
                    "text": kw["text"],
                    "type": kw["type"],
                    "file_name": file_name,
                    "notice_number": bid_no,
                    "file_url": file_url

                })
        t6 = time.time()

        payload = {
            "entities": entities
        }

        print("결과 생성:", payload)
        
        # 4. Spring 전송
        print("Spring 전송:", payload)

        t7 = time.time()
        requests.post(
            SPRING_URL,
            json=payload,
            timeout=30
        )
        t8 = time.time()

        print(f"[파일 {idx}] NER 추론 시간     : {t4 - t3:.4f}초")
        print(f"[파일 {idx}] 후처리 시간       : {t6 - t5:.4f}초")
        print(f"[파일 {idx}] Spring 전송 시간 : {t8 - t7:.4f}초")
        print(f"[파일 {idx}] 엔티티 수        : {len(entities)}")

        ner_results.append(payload)
    
    total_end = time.time()

    print("=" * 60)
    print(f"[전체] 총 처리 시간: {total_end - total_start:.4f}초")
    print("=" * 60)

    return {
    "status": "done",
    "fileCount": len(processed_result),
    "results": ner_results,
    "totalTime": round(total_end - total_start, 4)
    }
