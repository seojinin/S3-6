package pj.notice.mapper;

import java.util.List;
import java.util.Map;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import pj.notice.model.NoticeEntityModel;
import pj.notice.model.NoticeKeywordMapModel;

@Mapper
public interface NoticeEntityMapper {

    void insertEntities(@Param("list") List<NoticeEntityModel> list);

    List<NoticeEntityModel> searchByKeyword(String keyword);

    // 다중 키워드 검색
    List<NoticeEntityModel> searchByKeywords(@Param("keywords") List<String> keywords);

    List<NoticeEntityModel> selectByNoticeNumber(
            @Param("noticeNumber") String noticeNumber,
            @Param("memberId") Long memberId);
    //List<NoticeEntityModel> selectByNoticeNumber(String noticeNumber);

    // 키워드 없으면 저장
    void insertKeyword(@Param("word") String word);

    // 정규화된 단어로 키워드 ID 조회
    Long selectKeywordIdByWord(@Param("word") String word);

    // 공고-키워드 매핑 저장
    void insertNoticeKeywordMap(NoticeKeywordMapModel model);

    // 특정 키워드를 관심 키워드로 등록한 회원 ID 리스트 조회 (알림 발송용)
    List<Long> selectMembersByKeywordId(@Param("keywordId") Long keywordId);

    // 신규 공고 제목과 실시간으로 매칭할 전체 등록 키워드 목록 (keyword_id, standard_word)
    List<Map<String, Object>> selectAllKeywords();

}