package pj.notice.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import pj.notice.model.NoticeEntityModel;
import pj.notice.model.NoticeKeywordMapModel;

@Mapper
public interface NoticeEntityMapper {

	void insertEntities(@Param("list") List<NoticeEntityModel> list);

	List<NoticeEntityModel> searchByKeyword(String keyword);

	List<NoticeEntityModel> selectByNoticeNumber(String noticeNumber);

	// 키워드 없으면 저장
	void insertKeyword(@Param("word") String word);

	// 정규화된 단어로 키워드 ID 조회
	Long selectKeywordIdByWord(@Param("word") String word);

	// 공고-키워드 매핑 저장
	void insertNoticeKeywordMap(NoticeKeywordMapModel model);
}