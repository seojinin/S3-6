package pj.notice.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
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
    
//    // 공공 API 호출
//    @PostMapping("/fetch")
//    public String fetchApi() {
//
//        service.fetchNoticeFromApi();
//
//        return "api data saved";
//    }
}