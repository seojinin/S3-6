package pj.notice.model;

import lombok.Data;

@Data
public class NoticeKeywordMapModel {

    private String noticeNumber;
    private Long keywordId;
    private String entityType;
    private String fileName;

}