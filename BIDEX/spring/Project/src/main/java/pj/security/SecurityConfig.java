package pj.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

import jakarta.servlet.http.HttpServletResponse;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    PasswordEncoder passwordEncoder() {
	return new BCryptPasswordEncoder();
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {

	http

		.csrf(csrf -> csrf.disable())

		.authorizeHttpRequests(auth -> auth
			// SPA 페이지/정적 리소스/회원가입/공개 조회 API는 로그인 없이 접근 가능
			.requestMatchers("/", "/sec_fin", "/css/**", "/js/**", "/img/**", "/api/member/signup", "/api/notices/**", "/api/files/**")
			.permitAll()
			// 그 외(마이페이지 조회/수정 등)는 로그인 필요
			.anyRequest().authenticated())

		// SPA에서 fetch()로 직접 호출하는 로그인이므로,
		// 별도 로그인 페이지로 리다이렉트하지 않고 상태코드/메시지만 응답
		.formLogin(login -> login.loginProcessingUrl("/processLogin").usernameParameter("loginId")
			.passwordParameter("password").successHandler((request, response, authentication) -> {
			    response.setStatus(HttpServletResponse.SC_OK);
			    response.setContentType(MediaType.TEXT_PLAIN_VALUE + "; charset=UTF-8");
			    response.getWriter().write("로그인 성공");
			}).failureHandler((request, response, exception) -> {
			    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
			    response.setContentType(MediaType.TEXT_PLAIN_VALUE + "; charset=UTF-8");
			    response.getWriter().write("로그인 실패");
			}).permitAll())

		.logout(logout -> logout.logoutUrl("/logout")
			.logoutSuccessHandler((request, response, authentication) -> {
			    response.setStatus(HttpServletResponse.SC_OK);
			    response.setContentType(MediaType.TEXT_PLAIN_VALUE + "; charset=UTF-8");
			    response.getWriter().write("로그아웃 성공");
			}));

	return http.build();

    }

}