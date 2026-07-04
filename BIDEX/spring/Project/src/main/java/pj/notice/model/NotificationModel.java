package pj.notice.model;

import java.time.LocalDateTime;

import lombok.Data;

@Data
public class NotificationModel {

    private Long notificationId;
    private Long memberId;
    private String noticeNumber;
    private String message;
    private boolean isRead;
    private LocalDateTime createdAt;

    private String keyword;
    private String noticeTitle;

}