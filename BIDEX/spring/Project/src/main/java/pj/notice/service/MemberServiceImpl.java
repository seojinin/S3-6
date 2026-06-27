package pj.notice.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import pj.notice.mapper.MemberMapper;
import pj.notice.model.MemberModel;

@Service
public class MemberServiceImpl implements MemberServiceIF {

	@Autowired
	private MemberMapper memberMapper;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Override
	public void signup(MemberModel member) {

		if (memberMapper.selectByLoginId(member.getLoginId()) != null) {
			throw new RuntimeException("이미 존재하는 아이디입니다.");
		}

		member.setPassword(passwordEncoder.encode(member.getPassword()));

		memberMapper.insertMember(member);

	}

	@Override
	public MemberModel findByLoginId(String loginId) {
		return memberMapper.selectByLoginId(loginId);
	}

	@Override
	public MemberModel getMember(Long memberId) {
		return memberMapper.selectByMemberId(memberId);
	}

	@Override
	public void updateMember(MemberModel member) {
		memberMapper.updateMember(member);
	}

}