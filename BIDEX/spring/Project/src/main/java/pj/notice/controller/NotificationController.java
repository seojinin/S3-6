package pj.notice.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import pj.notice.mapper.NotificationMapper;
import pj.notice.model.NotificationModel;
import pj.security.CustomUserDetails;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    @Autowired
    private NotificationMapper notificationMapper;

    @GetMapping
    public ResponseEntity<List<NotificationModel>> getNotifications(Authentication authentication) {

	if (authentication == null || !authentication.isAuthenticated()) {
	    return ResponseEntity.status(401).build();
	}

	CustomUserDetails user = (CustomUserDetails) authentication.getPrincipal();

	return ResponseEntity.ok(notificationMapper.selectByMemberId(user.getMemberId()));
    }

    @PutMapping("/{notificationId}/read")
    public ResponseEntity<String> markAsRead(@PathVariable Long notificationId, Authentication authentication) {

	if (authentication == null || !authentication.isAuthenticated()) {
	    return ResponseEntity.status(401).build();
	}

	CustomUserDetails user = (CustomUserDetails) authentication.getPrincipal();

	notificationMapper.updateReadStatus(notificationId, user.getMemberId());

	return ResponseEntity.ok("읽음 처리 완료");
    }

    @PutMapping("/read-all")
    public ResponseEntity<String> markAllAsRead(Authentication authentication) {

	if (authentication == null || !authentication.isAuthenticated()) {
	    return ResponseEntity.status(401).build();
	}

	CustomUserDetails user = (CustomUserDetails) authentication.getPrincipal();

	notificationMapper.updateAllReadStatus(user.getMemberId());

	return ResponseEntity.ok("전체 읽음 처리 완료");
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Integer> getUnreadCount(Authentication authentication) {

	if (authentication == null || !authentication.isAuthenticated()) {
	    return ResponseEntity.status(401).build();
	}

	CustomUserDetails user = (CustomUserDetails) authentication.getPrincipal();

	return ResponseEntity.ok(notificationMapper.countUnread(user.getMemberId()));
    }

}