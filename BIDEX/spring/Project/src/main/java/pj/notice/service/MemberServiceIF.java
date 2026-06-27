package pj.notice.service;

import pj.notice.model.MemberModel;

public interface MemberServiceIF {

	// 회원가입
	void signup(MemberModel member);

	// 로그인용 회원 조회 (Spring Security에서 사용)
	MemberModel findByLoginId(String loginId);

	// 회원번호로 조회 (마이페이지)
	MemberModel getMember(Long memberId);

	// 회원정보 수정
	void updateMember(MemberModel member);

}