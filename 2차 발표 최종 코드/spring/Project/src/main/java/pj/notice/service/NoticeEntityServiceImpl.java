package pj.notice.service;

import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import pj.notice.dto.NoticeEntityBulkRequest;
import pj.notice.dto.NoticeEntityDto;
import pj.notice.mapper.NoticeEntityMapper;
import pj.notice.model.NoticeEntityModel;

@Service
public class NoticeEntityServiceImpl implements NoticeEntityServiceIF {

	@Autowired
	private NoticeEntityMapper entityMapper;

	@Override
	public void saveBulk(NoticeEntityBulkRequest request) {

	    System.out.println("=== Service saveBulk 진입 ===");

	    if(request.getEntities() == null) {
	        System.out.println("entities가 null입니다.");
	        return;
	    }

	    System.out.println("entities size = " + request.getEntities().size());

	    List<NoticeEntityModel> list = new ArrayList<>();

	    for (NoticeEntityDto dto : request.getEntities()) {

	        System.out.println("entity text = " + dto.getText());
	        System.out.println("entity type = " + dto.getType());
	        System.out.println("file name = " + dto.getFileName());

	        NoticeEntityModel entity = new NoticeEntityModel();
	        entity.setNotice_number(dto.getNoticeNumber());
	        entity.setEntity_value(dto.getText());
	        entity.setEntity_type(dto.getType());
	        entity.setFile_name(dto.getFileName());
	        entity.setFile_url(dto.getFileUrl());

	        list.add(entity);
	    }

	    if(!list.isEmpty()) {
	        System.out.println("DB insert 시작, count = " + list.size());
	        entityMapper.insertEntities(list);
	        System.out.println("DB insert 완료");
	    }
	}

	@Override
	public List<NoticeEntityModel> getEntitiesByNoticeNumber(String noticeNumber) {
	    return entityMapper.selectByNoticeNumber(noticeNumber);
	}

	@Override
	public List<NoticeEntityModel> searchByKeyword(String keyword) {
		return entityMapper.searchByKeyword(keyword);
	}
}