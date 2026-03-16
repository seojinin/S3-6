package pj.notice.model;

import lombok.Data;

@Data
public class NoticeEntityModel {

    private Long entity_id;

    private String notice_number;
    private String notice_title;

    private String entity_type;
    private String entity_value;

    private String file_name;
}