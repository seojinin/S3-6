package pj.notice.service;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import pj.notice.model.NoticeModel;

@SpringBootTest
public class NoticeApiServiceTest {

    @Autowired
    private NoticeApiServiceIF service;

    @Test
    void testFetchNotice() {
        service.fetchNoticeFromApi();
        List<NoticeModel> notices = service.getAllNotices();
        assertFalse(notices.isEmpty(), "공고 목록이 비어있으면 안됩니다");
        System.out.println("Fetched notices count: " + notices.size());
    }
}