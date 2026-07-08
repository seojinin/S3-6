package pj.notice.controller;

import java.util.Arrays;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import pj.notice.dto.NoticeEntityBulkRequest;
import pj.notice.dto.NoticeEntityDto;
import pj.notice.model.NoticeEntityModel;
import pj.notice.service.NoticeEntityServiceIF;

@RestController
@RequestMapping("/api/notices")
public class NoticeEntityController {

    @Autowired
    private NoticeEntityServiceIF service;

    // NER 결과 저장 (Python 호출)
    @PostMapping("/{noticeNumber}/entities")
    public String saveEntities(@PathVariable String noticeNumber, @RequestBody NoticeEntityBulkRequest request) {

	for (NoticeEntityDto dto : request.getEntities()) {
	    dto.setNoticeNumber(noticeNumber);
	}

	service.saveBulk(request);

	return "saved";
    }

    // 특정 공고의 엔티티 조회
    @GetMapping("/{noticeNumber}/entities")
    public List<NoticeEntityModel> getEntities(@PathVariable String noticeNumber) {

	return service.getEntitiesByNoticeNumber(noticeNumber);
    }

//	@GetMapping("/entities/search")
//	public List<NoticeEntityModel> search(@RequestParam String keyword) {
//		return service.searchByKeyword(keyword);
//	}

    @GetMapping("/entities/search")
    public List<NoticeEntityModel> search(@RequestParam String keyword) {

	List<String> keywords = Arrays
		.stream(keyword.split("/"))
		.map(String::trim)
		.filter(s -> !s.isEmpty())
		.toList();

	return service.searchByKeywords(keywords);
    }

}