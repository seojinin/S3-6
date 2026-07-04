package pj.notice.service;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import pj.notice.dto.NoticeEntityBulkRequest;
import pj.notice.dto.NoticeEntityDto;
import pj.notice.model.NoticeEntityModel;

@SpringBootTest
public class NoticeEntityServiceTest {

    @Autowired
    private NoticeEntityServiceIF entityService;

    @Test
    void testSaveAndRetrieveEntities() {
	// 1. 테스트용 데이터 준비
	Long testNoticeId = 1L; // DB에 존재하는 공고 ID 사용
	NoticeEntityBulkRequest request = new NoticeEntityBulkRequest();
	request.setNoticeId(testNoticeId);

	NoticeEntityDto entity1 = new NoticeEntityDto();
	entity1.setText("삼성전자");
	entity1.setType("COMPANY");
	entity1.setFileName("12345_test.pdf");

	NoticeEntityDto entity2 = new NoticeEntityDto();
	entity2.setText("노트북");
	entity2.setType("PRODUCT");
	entity2.setFileName("12345_test.pdf");

	request.setEntities(List.of(entity1, entity2));

	// 2. 엔티티 저장
	entityService.saveBulk(request);

	// 3. 저장 확인
//        List<NoticeEntityModel> savedEntities = entityService.getEntitiesByNoticeId(testNoticeId);
//        assertNotNull(savedEntities, "저장된 엔티티가 null이면 안됩니다");
//        assertTrue(savedEntities.size() >= 2, "저장된 엔티티 개수가 2개 이상이어야 합니다");

	// 4. 로그 출력
//        savedEntities.forEach(e -> 
//            System.out.println(
//                "Entity ID: " + e.getEntity_id() + 
//                ", Value: " + e.getEntity_value() + 
//                ", Type: " + e.getEntity_type() + 
//                ", File: " + e.getFile_name()
//            )
//        );
    }

    @Test
    void testSearchByKeyword() {
	String keyword = "삼성";
	List<NoticeEntityModel> result = entityService.searchByKeyword(keyword);

	assertNotNull(result, "검색 결과가 null이면 안됩니다");
	assertTrue(result.size() > 0, "검색 결과가 비어있으면 안됩니다");

	result.forEach(e -> System.out.println(
		"Entity Value: " + e.getEntityValue() + ", Type: " + e.getEntityType() + ", File: " + e.getFileName()));
    }
}