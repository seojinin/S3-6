package pj.notice.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import pj.notice.model.MemberModel;
import pj.notice.service.MemberServiceIF;
import pj.security.CustomUserDetails;

@RestController
@RequestMapping("/api/member")
public class MemberController {

    @Autowired
    private MemberServiceIF memberService;

    // 회원가입
    @PostMapping("/signup")
    public ResponseEntity<String> signup(@RequestBody MemberModel member) {
        try {
            memberService.signup(member);
            return ResponseEntity.ok("회원가입 성공");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("이미 존재하는 아이디입니다.");	
        }
    }

    // 마이페이지 조회
    @GetMapping("/mypage")
    public ResponseEntity<MemberModel> mypage(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated())
            return ResponseEntity.status(401).build();

        CustomUserDetails user = (CustomUserDetails) authentication.getPrincipal();
        MemberModel member = memberService.getMember(user.getMemberId());
        return ResponseEntity.ok(member);
    }

    // 회원정보 수정
    @PutMapping("/mypage")
    public ResponseEntity<String> updateMember(
            Authentication authentication,
            @RequestBody MemberModel member) {
        if (authentication == null || !authentication.isAuthenticated())
            return ResponseEntity.status(401).build();

        CustomUserDetails user = (CustomUserDetails) authentication.getPrincipal();
        member.setMemberId(user.getMemberId());
        memberService.updateMember(member);
        return ResponseEntity.ok("회원정보 수정 완료");
    }
}