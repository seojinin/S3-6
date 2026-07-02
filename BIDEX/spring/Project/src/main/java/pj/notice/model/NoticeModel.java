package pj.notice.model;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class NoticeModel {

    private Long noticeId;
    private String noticeNumber;
    private String noticeTitle;
    private String contractMethod;
    private Long amount;
    private String region;
    private String agency;
    private String demandAgency;

    private LocalDateTime bidStart;
    private LocalDateTime bidEnd;

    private String rawData;
    private LocalDateTime createdAt;

    private String entityValue;
    private String fileName;
    private String fileUrl;

}