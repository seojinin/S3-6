package pj.security;

import java.util.Collection;
import java.util.List;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import pj.notice.model.MemberModel;

public class CustomUserDetails implements UserDetails {

    private final MemberModel member;

    public CustomUserDetails(MemberModel member) {
	this.member = member;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
	return List.of(new SimpleGrantedAuthority(member.getRole()));
    }

    @Override
    public String getPassword() {
	return member.getPassword();
    }

    @Override
    public String getUsername() {
	// Spring Security가 로그인 ID로 사용하는 값
	return member.getLoginId();
    }

    public Long getMemberId() {
	return member.getMemberId();
    }

    public String getLoginId() {
	return member.getLoginId();
    }

    public MemberModel getMember() {
	return member;
    }

    @Override
    public boolean isAccountNonExpired() {
	return true;
    }

    @Override
    public boolean isAccountNonLocked() {
	return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
	return true;
    }

    @Override
    public boolean isEnabled() {
	return true;
    }

}