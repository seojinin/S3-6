package pj.notice.service;

public interface NotificationIF {

    void createKeywordNotifications(Long keywordId, String keyword, String noticeNumber);

}