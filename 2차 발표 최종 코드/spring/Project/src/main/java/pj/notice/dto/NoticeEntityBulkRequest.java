package pj.notice.dto;

import lombok.Data;
import java.util.List;

@Data
public class NoticeEntityBulkRequest {

	private Long noticeId;

	private List<NoticeEntityDto> entities;
}
