package pj.notice.model;

import lombok.Data;

@Data
public class MemberModel {

    private Long memberId;

    private String loginId;
    private String password;

    private String username;
    private String email;
    private String phone;

    private String role;

}