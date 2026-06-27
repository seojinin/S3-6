package pj.notice.mapper;

import org.apache.ibatis.annotations.Mapper;

import pj.notice.model.MemberModel;

@Mapper
public interface MemberMapper {

	void insertMember(MemberModel member);

	MemberModel selectByLoginId(String loginId);

	MemberModel selectByMemberId(Long memberId);

	void updateMember(MemberModel member);

}