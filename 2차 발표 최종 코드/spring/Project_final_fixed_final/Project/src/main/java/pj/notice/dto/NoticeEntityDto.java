package pj.notice.dto;

import lombok.Data;

@Data
public class NoticeEntityDto {
	private String text;
	private String type;
	private String fileName;
	private String noticeNumber;
}