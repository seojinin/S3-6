package pj.notice.model;

import lombok.Data;

@Data
public class NoticeKeywordMapModel {

	private String notice_number;
	private Long keyword_id;
	private String entity_type;
	private String file_name;

}
