import re
import torch
from typing import List, Dict, Any
from transformers import AutoTokenizer, AutoModelForTokenClassification

JOSA_LIST = [
    "으로", "에서", "에게", "까지", "부터", "처럼", "보다",
    "은", "는", "이", "가", "을", "를", "에", "의",
    "와", "과", "도", "로", "만", "나", "랑", "밖에"
]

EXCLUDE_WORDS = {
    "본", "공사", "제품", "사용", "공급", "설치", "적용",
    "시행", "수립", "규격", "표준", "인증", "한국산업규격"
}

EXCLUDE_CONTAINS = {
    "공급", "설치", "사용", "적용", "시행", "수립"
}


def coarse_tokenize(text: str):
    pattern = re.compile(r"[()\[\]{}:,;.]|[^\s()\[\]{}:,;.]+")
    return [(m.group(0), m.start(), m.end()) for m in pattern.finditer(text)]


def split_korean_josa(token: str):
    if re.fullmatch(r"[()\[\]{}:,;.]", token):
        return [token]

    for josa in sorted(JOSA_LIST, key=len, reverse=True):
        if token.endswith(josa) and len(token) > len(josa):
            stem = token[:-len(josa)]
            if len(stem) >= 2:
                return [stem, josa]

    return [token]


def tokenize_for_inference(text: str):
    coarse = coarse_tokenize(text)
    final_tokens = []

    for tok, _, _ in coarse:
        final_tokens.extend(split_korean_josa(tok))

    return final_tokens


class NERInferencer:
    def __init__(self, model_path: str):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        self.tokenizer = AutoTokenizer.from_pretrained(model_path, use_fast=False)
        self.model = AutoModelForTokenClassification.from_pretrained(model_path)
        self.model.to(self.device)
        self.model.eval()

        self.id2label = {int(k): v for k, v in self.model.config.id2label.items()}

    def predict_sentence(self, text: str) -> List[Dict[str, str]]:
        words = tokenize_for_inference(text)
        if not words:
            return []

        tokens = []
        word_id_map = []

        for word_idx, word in enumerate(words):
            sub_tokens = self.tokenizer.tokenize(word)
            if not sub_tokens:
                sub_tokens = [self.tokenizer.unk_token]
            tokens.extend(sub_tokens)
            word_id_map.extend([word_idx] * len(sub_tokens))

        # [CLS], [SEP] 추가
        cls_token = self.tokenizer.cls_token or "[CLS]"
        sep_token = self.tokenizer.sep_token or "[SEP]"

        tokens = [cls_token] + tokens + [sep_token]

        word_id_map = [None] + word_id_map + [None]

        input_ids = self.tokenizer.convert_tokens_to_ids(tokens)
        attention_mask = [1] * len(input_ids)

        # max_length 자르기
        max_length = 256
        if len(input_ids) > max_length:
            input_ids = input_ids[:max_length - 1] + [input_ids[-1]]
            attention_mask = attention_mask[:max_length]
            word_id_map = word_id_map[:max_length]

        inputs = {
            "input_ids": torch.tensor([input_ids]).to(self.device),
            "attention_mask": torch.tensor([attention_mask]).to(self.device),
        }

        with torch.no_grad():
            outputs = self.model(**inputs)

        predictions = torch.argmax(outputs.logits, dim=2)[0].cpu().tolist()

        word_labels = []
        prev_word_idx = None

        for pred_id, word_idx in zip(predictions, word_id_map):
            if word_idx is None:
                continue
            if word_idx != prev_word_idx:
                word_labels.append(self.id2label[int(pred_id)])
            prev_word_idx = word_idx

        entities = []
        current_tokens = []
        current_type = None

        for word, label in zip(words, word_labels):
            if label == "O":
                if current_tokens:
                    entities.append({
                        "text": " ".join(current_tokens),
                        "type": current_type
                    })
                    current_tokens = []
                    current_type = None
                continue

            if label.startswith("B-"):
                if current_tokens:
                    entities.append({
                        "text": " ".join(current_tokens),
                        "type": current_type
                    })
                current_tokens = [word]
                current_type = label[2:]

            elif label.startswith("I-"):
                entity_type = label[2:]
                if current_tokens and current_type == entity_type:
                    current_tokens.append(word)
                else:
                    if current_tokens:
                        entities.append({
                            "text": " ".join(current_tokens),
                            "type": current_type
                        })
                    current_tokens = [word]
                    current_type = entity_type

        if current_tokens:
            entities.append({
                "text": " ".join(current_tokens),
                "type": current_type
            })

        # 후처리
        filtered_entities = []

        for ent in entities:
            ent_tokens = ent["text"].split()
            ent_tokens = [t for t in ent_tokens if t not in JOSA_LIST]
            ent_text = " ".join(ent_tokens).strip()

            if not ent_text:
                continue
            if ent_text in EXCLUDE_WORDS:
                continue
            if any(bad in ent_text for bad in EXCLUDE_CONTAINS):
                continue

            filtered_entities.append({
                "text": ent_text,
                "type": ent["type"]
            })

        final_entities = []
        seen = set()

        for ent in filtered_entities:
            key = (ent["text"], ent["type"])
            if key in seen:
                continue
            seen.add(key)
            final_entities.append(ent)

        return final_entities

    def predict_json(self, input_json: Dict[str, Any]) -> Dict[str, Any]:

        result_sentences = []

        for item in input_json.get("sentences", []):
            sentence_id = item.get("sentenceId")
            sentence = item.get("sentence", "")

            keywords = self.predict_sentence(sentence)

            result_sentences.append({
                "sentenceId": sentence_id,
                "sentence": sentence,
                "keywords": keywords
            })

        return {
            "bidNtceNo": input_json.get("bidNtceNo"),
            "ntceSpecFileNm": input_json.get("ntceSpecFileNm"),
            "sentences": result_sentences
        }
