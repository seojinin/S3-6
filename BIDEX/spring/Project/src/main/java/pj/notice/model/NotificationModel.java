package pj.notice.model;

import lombok.Data;

@Data
public class NotificationModel {

	private Long notification_id;
	private Long member_id;
	private String notice_number;
	private String message;
	private boolean is_read;
	private String created_at;
	
	private String keyword;
    private String notice_title;

}
