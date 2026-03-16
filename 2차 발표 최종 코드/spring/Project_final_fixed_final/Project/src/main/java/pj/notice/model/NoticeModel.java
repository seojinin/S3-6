package pj.notice.model;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class NoticeModel {

	private Long notice_id;
	private String notice_number;
	private String notice_title;
	private String contract_method;
	private Long amount;
	private String region;
	private String agency;
	private String demand_agency;

	private LocalDateTime bid_start;
	private LocalDateTime bid_end;

	private String raw_data;
	private LocalDateTime created_at;
}