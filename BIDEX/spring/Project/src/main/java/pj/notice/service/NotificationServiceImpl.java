package pj.notice.service;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import pj.notice.mapper.NoticeEntityMapper;
import pj.notice.mapper.NotificationMapper;
import pj.notice.model.NotificationModel;

@Service
public class NotificationServiceImpl implements NotificationIF {

    @Autowired
    private NoticeEntityMapper entityMapper;

    @Autowired
    private NotificationMapper notificationMapper;

    @Override
    public void createKeywordNotifications(Long keywordId, String keyword, String noticeNumber) {

	List<Long> memberIds = entityMapper.selectMembersByKeywordId(keywordId);

	for (Long memberId : memberIds) {

	    NotificationModel alert = new NotificationModel();
	    alert.setMemberId(memberId);
	    alert.setNoticeNumber(noticeNumber);
	    alert.setMessage("[" + keyword + "] 관련 키워드가 포함된 신규 공고가 등록되었습니다.");

	    notificationMapper.insertNotification(alert);

	    System.out.println("   -> 알림 생성: 회원ID(" + memberId + "), 키워드(" + keyword + ")");
	}
    }
}