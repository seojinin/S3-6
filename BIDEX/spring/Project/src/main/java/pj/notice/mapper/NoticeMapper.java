package pj.notice.mapper;

import java.util.List;
import java.util.Map;

import org.apache.ibatis.annotations.Mapper;

import pj.notice.model.NoticeModel;

@Mapper
public interface NoticeMapper {

    int insertNotice(NoticeModel notice);

    NoticeModel selectNoticeById(Long notice_id);

    List<NoticeModel> selectAllNotices();

    NoticeModel selectByNoticeNumber(String noticeNumber);

    Map<String, Object> selectNoticeDetail(String noticeNumber);

    void insertNoticeFile(NoticeModel notice);

    List<Map<String, Object>> selectNoticeFiles(String noticeNumber);

}