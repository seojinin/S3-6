package pj.notice.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import pj.notice.mapper.NotificationMapper;
import pj.notice.model.NotificationModel;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

	@Autowired
	private NotificationMapper notificationMapper;

	@GetMapping("/{memberId}")
	public List<NotificationModel> getNotifications(@PathVariable Long memberId) {
		return notificationMapper.selectByMemberId(memberId);
	}

}