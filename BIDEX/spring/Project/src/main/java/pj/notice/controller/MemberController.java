package pj.notice.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
	public String signup(@RequestBody MemberModel member) {

		memberService.signup(member);
		return "회원가입 성공";

	}

	// 내 정보 조회
	@GetMapping("/mypage")
	public MemberModel mypage(Authentication authentication) {

		CustomUserDetails user = (CustomUserDetails) authentication.getPrincipal();
		return memberService.getMember(user.getMemberId());

	}

	// 내 정보 수정
	@PutMapping("/mypage")
	public String updateMember(Authentication authentication, @RequestBody MemberModel member) {

		CustomUserDetails user = (CustomUserDetails) authentication.getPrincipal();

		member.setMemberId(user.getMemberId());
		memberService.updateMember(member);

		return "회원정보 수정 완료";

	}

}