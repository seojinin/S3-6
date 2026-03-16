package pj.notice.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import pj.notice.model.NoticeEntityModel;

@Mapper
public interface NoticeEntityMapper {

	void insertEntities(@Param("list") List<NoticeEntityModel> list);
	
	List<NoticeEntityModel> searchByKeyword(String keyword);

	List<NoticeEntityModel> selectByNoticeNumber(String noticeNumber);
}