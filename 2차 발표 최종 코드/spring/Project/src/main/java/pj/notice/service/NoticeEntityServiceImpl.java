package pj.notice.service;

import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import pj.notice.dto.NoticeEntityBulkRequest;
import pj.notice.dto.NoticeEntityDto;
import pj.notice.mapper.NoticeEntityMapper;
import pj.notice.model.NoticeEntityModel;
import pj.notice.model.NoticeKeywordMapModel;

@Service
public class NoticeEntityServiceImpl implements NoticeEntityServiceIF {

	@Autowired
	private NoticeEntityMapper entityMapper;

	@Override
	@Transactional
	public void saveBulk(NoticeEntityBulkRequest request) {

		System.out.println("=== Service saveBulk 진입 ===");

		if (request.getEntities() == null) {
			System.out.println("entities가 null입니다.");
			return;
		}

		System.out.println("entities size = " + request.getEntities().size());

		List<NoticeEntityModel> entityLogList = new ArrayList<>();

		for (NoticeEntityDto dto : request.getEntities()) {

			System.out.println("--- 개별 엔티티 처리 시작 ---");
			System.out.println("entity text = " + dto.getText());
			System.out.println("entity type = " + dto.getType());
			System.out.println("file name = " + dto.getFileName());

			// [1] 키워드 정규화 (공백 제거, 소문자 변환)
			String rawText = dto.getText();
			if (rawText == null || rawText.trim().isEmpty()) {
				System.out.println("텍스트가 비어있어 스킵합니다.");
				continue;
			}

			String normalized = rawText.replaceAll("\\s+", "").toLowerCase();
			System.out.println("정규화된 텍스트: " + normalized);

			// [2] 키워드 사전 처리 (tb_keyword)
			System.out.println("DB 사전 체크 및 등록 중...");
			entityMapper.insertKeyword(normalized); // 없으면 저장 (IGNORE)
			Long keywordId = entityMapper.selectKeywordIdByWord(normalized);
			System.out.println("획득한 Keyword ID: " + keywordId);

			if (keywordId != null) {
				// [3] 공고-키워드 매핑 저장 (tb_notice_keyword_map)
				NoticeKeywordMapModel mapModel = new NoticeKeywordMapModel();
				mapModel.setNotice_number(dto.getNoticeNumber());
				mapModel.setKeyword_id(keywordId);
				mapModel.setEntity_type(dto.getType());
				mapModel.setFile_name(dto.getFileName());

				entityMapper.insertNoticeKeywordMap(mapModel);
				System.out.println("공고-키워드 매핑 완료 (Notice: " + dto.getNoticeNumber() + ")");
			}

			// [4] 기존 상세 정보 모델 생성 (tb_notice_entity 로그용)
			NoticeEntityModel entity = new NoticeEntityModel();
			entity.setNotice_number(dto.getNoticeNumber());
			entity.setEntity_value(rawText); // 원본 유지
			entity.setEntity_type(dto.getType());
			entity.setFile_name(dto.getFileName());
			entity.setFile_url(dto.getFileUrl());

			entityLogList.add(entity);
		}

		// [5] 상세 정보 벌크 인서트
		if (!entityLogList.isEmpty()) {
			System.out.println("DB insert 시작 (tb_notice_entity), count = " + entityLogList.size());
			entityMapper.insertEntities(entityLogList);
			System.out.println("DB insert 완료");
		}

		System.out.println("=== Service saveBulk 처리 종료 ===");
	}

	@Override
	public List<NoticeEntityModel> getEntitiesByNoticeNumber(String noticeNumber) {
		System.out.println("공고번호 조회: " + noticeNumber);
		return entityMapper.selectByNoticeNumber(noticeNumber);
	}

	@Override
	public List<NoticeEntityModel> searchByKeyword(String keyword) {
		System.out.println("키워드 검색: " + keyword);
		return entityMapper.searchByKeyword(keyword);
	}
}