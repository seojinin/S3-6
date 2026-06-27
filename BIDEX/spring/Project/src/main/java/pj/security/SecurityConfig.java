package pj.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

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
						.requestMatchers("/", "/login", "/signup", "/api/member/signup", "/css/**", "/js/**", "/images/**")
						.permitAll()
						.anyRequest().authenticated()
				)

				.formLogin(login -> login
						.loginPage("/login")
						.loginProcessingUrl("/processLogin")
						.usernameParameter("loginId")
						.passwordParameter("password")
						.defaultSuccessUrl("/main", true)
						.failureUrl("/login?error")
						.permitAll()
				)

				.logout(logout -> logout
						.logoutUrl("/logout")
						.logoutSuccessUrl("/")
				);

		return http.build();

	}

}