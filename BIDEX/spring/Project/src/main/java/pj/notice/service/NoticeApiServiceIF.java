package pj.notice.service;

import java.util.List;
import java.util.Map;

import pj.notice.model.NoticeModel;

public interface NoticeApiServiceIF {

	void fetchNoticeFromApi();

	List<NoticeModel> getAllNotices();

	Map<String, Object> getNoticeDetailLive(String noticeNumber);
	
}