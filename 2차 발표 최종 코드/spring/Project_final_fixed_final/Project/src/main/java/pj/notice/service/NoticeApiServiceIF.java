package pj.notice.service;

import java.util.List;

import pj.notice.model.NoticeModel;

public interface NoticeApiServiceIF {

    void fetchNoticeFromApi();

    List<NoticeModel> getAllNotices();
}