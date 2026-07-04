package pj.notice.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import pj.notice.model.MemberKeywordModel;
import pj.notice.model.MemberModel;

@Mapper
public interface MemberMapper {

    void insertMember(MemberModel member);

    MemberModel selectByLoginId(String loginId);

    MemberModel selectByMemberId(Long memberId);

    void updateMember(MemberModel member);

    void deleteMemberKeywords(@Param("memberId") Long memberId);

    void insertMemberKeyword(MemberKeywordModel model);

    List<String> selectMemberKeywords(@Param("memberId") Long memberId);

}