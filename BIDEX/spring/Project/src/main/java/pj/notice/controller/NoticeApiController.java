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

import org.springframework.security.core.Authentication;
import pj.security.CustomUserDetails;

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
	return service.getNoticeDetail(noticeNumber);
    }

    @GetMapping("/stats")
    public Map<String, Object> getStats(Authentication authentication) {
        Long memberId = null;
        if (authentication != null && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof CustomUserDetails) {
            memberId = ((CustomUserDetails) authentication.getPrincipal()).getMemberId();
        }
        return service.getNoticeStats(memberId);
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