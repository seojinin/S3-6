from fastapi import FastAPI
import os
import requests
import tempfile

from process import process_file
from ner_inference import NERInferencer

app = FastAPI()
SPRING_URL = "http://localhost:8080/api/files/ner-result"

# 모델 로드
MODEL_PATH = "./kobert_ner_model"
ner_model = NERInferencer(MODEL_PATH)

@app.post("/process")
def process_bid(data: dict):

    print("JSON 수신: ", data)

    processed_result = process_file(data)

    ner_results = []

    for file_result in processed_result:

        ner_result = ner_model.predict_json(file_result)

        bid_no = ner_result["bidNtceNo"]
        file_name = ner_result["ntceSpecFileNm"]
        file_url = ner_result["ntceSpecDocUrl"]
        
        entities = []

        for s in ner_result["sentences"]:
            for kw in s["keywords"]:
                entities.append({
                    "text": kw["text"],
                    "type": kw["type"],
                    "fileName": file_name,
                    "noticeNumber": bid_no,
                    "ntceSpecDocUrl": file_url
                })

        payload = {
            "entities": entities
        }

        print("Spring 전송:", payload)

        requests.post(
            SPRING_URL,
            json=payload,
            timeout=30
        )

        ner_results.append(payload)

    return {"status": "done"}
