package pj.notice.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;

import pj.notice.model.NoticeModel;

@Mapper
public interface NoticeMapper {

    void insertNotice(NoticeModel notice);

    NoticeModel selectNoticeById(Long notice_id);

    List<NoticeModel> selectAllNotices();
}