package pj.notice.controller;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import pj.notice.model.NoticeModel;
import pj.notice.service.NoticeApiServiceIF;

@RestController
@RequestMapping("/api/notices")
public class NoticeApiController {

    @Autowired
    private NoticeApiServiceIF service;

    @GetMapping
    public List<NoticeModel> getNotices() {
	return service.getAllNotices();
    }

    @GetMapping("/fetch")
    public String fetchApi() {

	service.fetchNoticeFromApi();

	return "api data saved";
    }

    @GetMapping("/{noticeNumber}/detail")
    public Map<String, Object> getNoticeDetail(@PathVariable String noticeNumber) {
	return service.getNoticeDetailLive(noticeNumber);
    }

//    // 공공 API 호출
//    @PostMapping("/fetch")
//    public String fetchApi() {
//
//        service.fetchNoticeFromApi();
//
//        return "api data saved";
//    }
}