package pj.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import pj.notice.mapper.MemberMapper;
import pj.notice.model.MemberModel;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    @Autowired
    private MemberMapper memberMapper;

    @Override
    public UserDetails loadUserByUsername(String loginId) throws UsernameNotFoundException {

	MemberModel member = memberMapper.selectByLoginId(loginId);

	if (member == null) {
	    throw new UsernameNotFoundException(loginId);
	}

	return new CustomUserDetails(member);
    }

}