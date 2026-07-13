create database notice_db;

use notice_db;

-- 공고 정보 저장
CREATE TABLE tb_notice (
    notice_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    notice_number VARCHAR(100) NOT NULL,   -- 조달청 공고번호 (식별자)
    notice_title VARCHAR(1000),            -- 공고명
    contract_method VARCHAR(100),          -- 계약 방법
    amount BIGINT,                         -- 예정 가격 또는 추정 가격
    region VARCHAR(100),                   -- 지역
    agency VARCHAR(255),                   -- 공고 기관
    demand_agency VARCHAR(255),            -- 수요 기관

    notice_date DATETIME,                  -- 입찰공고일
    opening_date DATETIME,                 -- 개찰일시
    biz_type VARCHAR(255),                 -- 업무구분

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- (수정): notice_number로 다른 테이블들이 참조하므로 인덱스 및 유니크 설정 필수
    UNIQUE (notice_number)
) CHARACTER SET utf8mb4;

CREATE TABLE tb_notice_file (
    file_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    notice_number VARCHAR(100) NOT NULL,
    file_name VARCHAR(255),
    file_url VARCHAR(255),

    FOREIGN KEY (notice_number) REFERENCES tb_notice(notice_number) ON DELETE CASCADE
) CHARACTER SET utf8mb4;

-- NER 결과 저장
CREATE TABLE tb_notice_entity (
    entity_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    notice_number VARCHAR(100) NOT NULL,   -- 부모 공고 참조
    entity_type VARCHAR(50),               -- 분석된 타입 (예: BRAND, ORG 등)
    entity_value VARCHAR(255),             -- 추출된 단어 (예: 삼성전자)
    file_name VARCHAR(255),                -- 추출 대상이 된 첨부파일명
    file_url VARCHAR(255),                 -- (수정) 첨부파일 다운로드 경로 (필요 시 API 응답값 저장)

    -- 외래키 설정
    FOREIGN KEY (notice_number) REFERENCES tb_notice(notice_number) ON DELETE CASCADE,

    -- (notice_number, entity_value, entity_type, file_name) 조합 중복 방지
    UNIQUE KEY uniq_entity (notice_number, entity_value, entity_type, file_name)
) CHARACTER SET utf8mb4;

-- 회원 정보 저장(폼 로그인)
CREATE TABLE tb_member (
    member_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    login_id VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    role VARCHAR(20) DEFAULT 'ROLE_USER',  -- 스프링 시큐리티 권한 관리용
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4;

-- 키워드 사전(대표어 관리)
CREATE TABLE tb_keyword (
    keyword_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    standard_word VARCHAR(100) UNIQUE NOT NULL, -- 대표 키워드 (예: 삼성전자)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4;

-- 키워드 동의어(유사어 관리)
CREATE TABLE tb_keyword_synonym (
    synonym_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    keyword_id BIGINT NOT NULL,                 -- 대표 키워드 ID 참조
    synonym_word VARCHAR(100) UNIQUE NOT NULL,  -- 유사어 (예: 삼성, Samsung)
    
    FOREIGN KEY (keyword_id) REFERENCES tb_keyword(keyword_id) ON DELETE CASCADE
) CHARACTER SET utf8mb4;

-- 회원별 관심 키워드 설정
CREATE TABLE tb_member_keyword (
    member_id BIGINT NOT NULL,
    keyword_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (member_id, keyword_id),
    FOREIGN KEY (member_id) REFERENCES tb_member(member_id) ON DELETE CASCADE,
    FOREIGN KEY (keyword_id) REFERENCES tb_keyword(keyword_id) ON DELETE CASCADE
) CHARACTER SET utf8mb4;

-- 공고-키워드 매핑 테이블(자동 매칭 결과 저장)
CREATE TABLE tb_notice_keyword_map (
    notice_number VARCHAR(100) NOT NULL,
    keyword_id BIGINT NOT NULL,
    entity_type VARCHAR(50),                -- NER이 판별한 타입
    file_name VARCHAR(255),
    
    PRIMARY KEY (notice_number, keyword_id, file_name),
    FOREIGN KEY (notice_number) REFERENCES tb_notice(notice_number) ON DELETE CASCADE,
    FOREIGN KEY (keyword_id) REFERENCES tb_keyword(keyword_id)
) CHARACTER SET utf8mb4;

-- 알림 발송 내역
CREATE TABLE tb_notification (
    notification_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT NOT NULL,
    notice_number VARCHAR(100) NOT NULL,    -- 알림 대상 공고 번호 (수정: 연동성 강화)
    message VARCHAR(255) NOT NULL,          -- 알림 메시지
    is_read BOOLEAN DEFAULT FALSE,          -- 읽음 확인 여부
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- (수정): 알림 목록에서 공고로 바로 연결하기 위해 notice_number 외래키 추가 권장
    FOREIGN KEY (member_id) REFERENCES tb_member(member_id) ON DELETE CASCADE,
    FOREIGN KEY (notice_number) REFERENCES tb_notice(notice_number) ON DELETE CASCADE
) CHARACTER SET utf8mb4;