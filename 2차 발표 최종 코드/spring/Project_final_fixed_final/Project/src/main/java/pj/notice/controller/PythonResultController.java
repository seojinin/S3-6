package pj.notice.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import pj.notice.dto.NoticeEntityBulkRequest;
import pj.notice.service.NoticeEntityServiceIF;

@RestController
@RequestMapping("/api/files")
public class PythonResultController {

    @Autowired
    private NoticeEntityServiceIF entityService;

    @PostMapping("/ner-result")
    public String receiveNerResult(@RequestBody NoticeEntityBulkRequest request) {
        entityService.saveBulk(request);
        return "NER result saved";
    }
}