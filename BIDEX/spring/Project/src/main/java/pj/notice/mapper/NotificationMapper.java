package pj.notice.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import pj.notice.model.NotificationModel;

@Mapper
public interface NotificationMapper {

	void insertNotification(NotificationModel notification);

	List<NotificationModel> selectByMemberId(@Param("memberId") Long memberId);

	void updateReadStatus(@Param("notificationId") Long notificationId);

}
