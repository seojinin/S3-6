package pj.notice.service;

import java.util.List;

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

    // 회원 관심 키워드 저장
    void saveKeywords(Long memberId, List<String> keywords);

    // 회원이 등록한 키워드 조회
    List<String> getKeywords(Long memberId);

}