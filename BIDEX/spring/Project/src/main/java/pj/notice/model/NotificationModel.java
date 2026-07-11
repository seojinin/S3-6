package pj.notice.model;

import java.time.LocalDateTime;

import lombok.Data;

@Data
public class NotificationModel {

    private Long notificationId;
    private Long memberId;
    private String noticeNumber;
    private String message;

    // boolean(기본형)으로 두면 Lombok이 isRead() getter를 만들고, Jackson이 이를 "read"로 직렬화해서
    // 프론트엔드가 기대하는 "is_read" 키와 어긋나는 문제가 있었음. Boolean(래퍼)으로 바꾸면
    // getIsRead()가 생성되어 Jackson SNAKE_CASE 전략에서 정확히 "is_read"로 직렬화됨.
    private Boolean isRead;

    private LocalDateTime createdAt;

    private String keyword;
    private String noticeTitle;

}