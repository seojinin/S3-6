package pj.notice.startup;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import pj.notice.service.NoticeApiServiceIF;

@Component
public class StartupRunner implements CommandLineRunner {

    @Autowired
    private NoticeApiServiceIF service;

    @Override
    public void run(String... args) throws Exception {

        System.out.println("Spring started → Fetch API 실행");

        service.fetchNoticeFromApi();

    }
}