package pj.notice.service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

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

    @Autowired
    private NotificationIF notificationIF;

    @Override
    @Transactional
    public void saveBulk(NoticeEntityBulkRequest request) {

	System.out.println("=== [NER 분석 결과 저장 프로세스 시작] ===");

	// 1. 엔티티 리스트 자체가 비어있는 경우
	if (request.getEntities() == null || request.getEntities().isEmpty()) {
	    System.out.println(">>> 추출된 키워드가 없습니다. 프로세스를 종료합니다.");
	    return;
	}

	List<NoticeEntityModel> entityLogList = new ArrayList<>();
	int notificationCount = 0; // 생성된 알림 개수를 체크하기 위한 변수

	// 중복 알림 방지를 위해 이미 알림을 보낸 키워드 ID를 저장할 Set 생성
	Set<Long> processedKeywordIds = new HashSet<>();

	for (NoticeEntityDto dto : request.getEntities()) {

	    // [1] 키워드 정규화
	    String rawText = dto.getText();
	    if (rawText == null || rawText.trim().isEmpty())
		continue;

	    String normalized = rawText.replaceAll("\\s+", "").toLowerCase();

	    // [2] 키워드 사전 관리
	    entityMapper.insertKeyword(normalized);
	    Long keywordId = entityMapper.selectKeywordIdByWord(normalized);

	    if (keywordId != null) {
		// [3] 공고-키워드 매핑 정보 저장 (분석 근거이므로 중복되어도 모두 저장)
		NoticeKeywordMapModel mapModel = new NoticeKeywordMapModel();
		mapModel.setNoticeNumber(dto.getNoticeNumber());
		mapModel.setKeywordId(keywordId);
		mapModel.setEntityType(dto.getType());
		mapModel.setFileName(dto.getFileName());

		entityMapper.insertNoticeKeywordMap(mapModel);

		// [4] 사용자 맞춤형 알림 생성 (중복 체크 로직 추가)
		if (!processedKeywordIds.contains(keywordId)) {

		    notificationIF.createKeywordNotifications(keywordId, normalized, dto.getNoticeNumber());

		    notificationCount++; // 알림 생성 시 카운트 증가

		    // 해당 키워드는 이 공고에서 알림 처리가 끝났음을 기록
		    processedKeywordIds.add(keywordId);
		} else {
		    System.out.println("   -> [중복 방지] 키워드(" + normalized + ")는 이미 이 공고에서 알림이 생성되었습니다.");
		}
	    }

	    // [5] 상세 분석 결과 리스트 구성
	    NoticeEntityModel entity = new NoticeEntityModel();
	    entity.setNoticeNumber(dto.getNoticeNumber());
	    entity.setEntityValue(rawText);
	    entity.setEntityType(dto.getType());
	    entity.setFileName(dto.getFileName());
	    entity.setFileUrl(dto.getFileUrl());

	    entityLogList.add(entity);
	}

	// [6] 상세 분석 결과 벌크 인서트
	if (!entityLogList.isEmpty()) {
	    entityMapper.insertEntities(entityLogList);
	    System.out.println(">>> 총 " + entityLogList.size() + "개의 키워드 데이터가 저장되었습니다.");
	}

	// 최종 로그: 알림 생성 여부에 따라 메시지 차별화
	if (notificationCount > 0) {
	    System.out.println("=== [프로세스 완료: 총 " + notificationCount + "건의 맞춤 알림 발송 완료] ===");
	} else {
	    System.out.println("=== [프로세스 완료: 매칭되는 관심 키워드 회원이 없어 알림을 생성하지 않았습니다] ===");
	}
    }

    @Override
    public List<NoticeEntityModel> getEntitiesByNoticeNumber(String noticeNumber) {
	return entityMapper.selectByNoticeNumber(noticeNumber);
    }

    @Override
    public List<NoticeEntityModel> searchByKeyword(String keyword) {
	return entityMapper.searchByKeyword(keyword);
    }

    @Override
    public List<NoticeEntityModel> searchByKeywords(List<String> keywords) {
	return entityMapper.searchByKeywords(keywords);
    }
}