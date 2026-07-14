package pj.notice.service;

import java.util.List;

import pj.notice.dto.NoticeEntityBulkRequest;
import pj.notice.model.NoticeEntityModel;

public interface NoticeEntityServiceIF {

    void saveBulk(NoticeEntityBulkRequest request);

    List<NoticeEntityModel> searchByKeyword(String keyword);

    // List<NoticeEntityModel> getEntitiesByNoticeNumber(String noticeNumber);
    List<NoticeEntityModel> getEntitiesByNoticeNumber(String noticeNumber, Long memberId);

    List<NoticeEntityModel> searchByKeywords(List<String> keywords);

}