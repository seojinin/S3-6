package pj.notice.model;

import lombok.Data;

@Data
public class NoticeEntityModel {

    private Long entityId;
    private String noticeNumber;
    private String noticeTitle;
    private String entityType;
    private String entityValue;
    private String fileName;
    private String fileUrl;
    private boolean matched;
    
    public boolean isMatched() {
        return matched;
    }

    public void setMatched(boolean matched) {
        this.matched = matched;
    }

}
