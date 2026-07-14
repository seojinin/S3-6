package pj.notice.service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import pj.notice.dto.FileInfoDto;
import pj.notice.mapper.NoticeEntityMapper;
import pj.notice.mapper.NoticeMapper;
import pj.notice.model.NoticeModel;

@Service
public class NoticeApiServiceImpl implements NoticeApiServiceIF {

    @Autowired
    private NoticeMapper noticeMapper;

    @Autowired
    private NoticeEntityMapper noticeEntityMapper;

    @Autowired
    private NotificationIF notificationIF;

    private RestTemplate restTemplate = new RestTemplate();

    private String serviceKey = "b801f42df1eaeb53e32ca3e08185a477ce2e0a1988d6c5f841370e09d5717190";

    @Override
    @Scheduled(fixedDelay = 60000)
    public void fetchNoticeFromApi() {

	LocalDate today = LocalDate.now();

	String begin = today.minusDays(10).format(DateTimeFormatter.ofPattern("yyyyMMdd"));

	String end = today.format(DateTimeFormatter.ofPattern("yyyyMMdd"));

	System.out.println("========== 공고 수집 시작 ==========");

	try {

	    ObjectMapper mapper = new ObjectMapper();

	    int pageNo = 1;

	    while (true) {

		String url =
	                "https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoCnstwk"
	                + "?serviceKey=" + serviceKey
	                + "&pageNo=" + pageNo
	                + "&numOfRows=100"
	                + "&inqryDiv=1"
	                + "&inqryBgnDt=" + begin + "0000"
	                + "&inqryEndDt=" + end + "2359"
	                + "&type=json";

		String result = restTemplate.getForObject(url, String.class);

		JsonNode root = mapper.readTree(result);

		JsonNode items = root.path("response").path("body").path("items");

		// 더 이상 조회할 공고가 없으면 종료
		if (!items.isArray() || items.size() == 0) {
		    break;
		}

		System.out.println("페이지 " + pageNo + " 조회 (" + items.size() + "건)");

		for (JsonNode node : items) {

		    boolean inserted = saveNotice(node);

		    if (!inserted) {
			System.out.println("기존 공고 → 처리 생략 : " + node.path("bidNtceNo").asText());
			continue;
		    }

		    System.out.println("신규 공고 저장 : " + node.path("bidNtceNo").asText());

		    List<FileInfoDto> files = extractFilesFromNotice(node);

		    sendFilesToPython(files);
		}

		pageNo++;
	    }

	} catch (Exception e) {
	    e.printStackTrace();
	}

	System.out.println("========== 공고 수집 종료 ==========");
    }

    private boolean saveNotice(JsonNode node) {

	try {

	    NoticeModel notice = new NoticeModel();

	    notice.setNoticeNumber(node.path("bidNtceNo").asText());

	    notice.setNoticeTitle(node.path("bidNtceNm").asText());

	    notice.setContractMethod(node.path("cntrctCnclsMthdNm").asText());

	    String amtStr = node.path("bdgtAmt").asText().trim();

	    Long amount = null;

	    if (amtStr != null && !amtStr.isEmpty()) {

		amtStr = amtStr.replaceAll("[^0-9]", "");

		if (!amtStr.isEmpty()) {

		    amount = Long.parseLong(amtStr);

		}
	    }

	    notice.setAmount(amount);

	    notice.setNoticeDate(node.path("bidNtceDt").asText());

	    notice.setOpeningDate(node.path("opengDt").asText());

	    notice.setBizType(node.path("rgstTyNm").asText());

	    notice.setAgency(node.path("ntceInsttNm").asText());

	    notice.setDemandAgency(node.path("dminsttNm").asText());

	    notice.setRegion(node.path("cnstrtsiteRgnNm").asText());

	    int result = noticeMapper.insertNotice(notice);

	    if (result > 0) {

		// 공고 제목으로 관심 키워드 알림 생성
		checkKeywordMatchAndNotify(notice);

		for (int i = 1; i <= 10; i++) {

		    String fileName = node.path("ntceSpecFileNm" + i).asText();
		    String fileUrl = node.path("ntceSpecDocUrl" + i).asText();

		    if (!fileName.isEmpty() && !fileUrl.isEmpty()) {

			NoticeModel file = new NoticeModel();

			file.setNoticeNumber(notice.getNoticeNumber());
			file.setFileName(fileName);
			file.setFileUrl(fileUrl);

			noticeMapper.insertNoticeFile(file);
		    }
		}

		return true;
	    }

	    return false;

	} catch (Exception e) {

	    e.printStackTrace();

	    return false;

	}

    }

    // 신규 공고 제목에 등록된 키워드가 포함되어 있으면, 그 키워드를 등록한 회원에게 알림 생성
    private void checkKeywordMatchAndNotify(NoticeModel notice) {

	try {

	    String title = notice.getNoticeTitle();

	    if (title == null || title.trim().isEmpty()) {
		return;
	    }

	    // 제목도 키워드와 동일한 방식으로 정규화
	    String normalizedTitle = title.replaceAll("\\s+", "").toLowerCase();

	    List<Map<String, Object>> keywords = noticeEntityMapper.selectAllKeywords();

	    for (Map<String, Object> row : keywords) {

		Object idObj = row.get("keyword_id");
		Object wordObj = row.get("standard_word");

		if (idObj == null || wordObj == null) {
		    continue;
		}

		Long keywordId = ((Number) idObj).longValue();
		String word = wordObj.toString();

		if (word == null || word.trim().isEmpty()) {
		    continue;
		}

		if (normalizedTitle.contains(word)) {

		    notificationIF.createKeywordNotifications(keywordId, word, notice.getNoticeNumber());

		    System.out.println("제목 키워드 알림 생성 : " + word + " / " + notice.getNoticeNumber());
		}
	    }

	} catch (Exception e) {
	    e.printStackTrace();
	}
    }

    private List<FileInfoDto> extractFilesFromNotice(JsonNode node) {

	List<FileInfoDto> files = new ArrayList<>();
	String bidNtceNo = node.path("bidNtceNo").asText();

	for (int i = 1; i <= 10; i++) {
	    String fileName = node.path("ntceSpecFileNm" + i).asText();
	    String fileUrl = node.path("ntceSpecDocUrl" + i).asText();

	    if (!fileName.isEmpty() && !fileUrl.isEmpty()) {
		FileInfoDto file = new FileInfoDto();
		file.setBidNtceNo(bidNtceNo);
		file.setFileName(fileName);
		file.setFileUrl(fileUrl);
		files.add(file);
	    }
	}
	return files;
    }

    private void sendFilesToPython(List<FileInfoDto> files) {

	try {
	    if (files == null || files.isEmpty())
		return;

	    String pythonUrl = "http://localhost:8000/process";
	    List<Map<String, String>> fileList = new ArrayList<>();

	    for (FileInfoDto f : files) {
		Map<String, String> fileMap = new HashMap<>();
		fileMap.put("bidNtceNo", f.getBidNtceNo());
		fileMap.put("fileName", f.getFileName());
		fileMap.put("fileUrl", f.getFileUrl());
		fileList.add(fileMap);
	    }

	    Map<String, Object> requestBody = new HashMap<>();
	    requestBody.put("files", fileList);

	    System.out.println("========== Python 전송 ==========");
	    System.out.println("공고번호 : " + files.get(0).getBidNtceNo());
	    System.out.println("전송 파일 수 : " + files.size());

	    for (FileInfoDto f : files) {
		System.out.println(" - " + f.getFileName());
	    }

	    String response = restTemplate.postForObject(pythonUrl, requestBody, String.class);

	    System.out.println("Python 응답 : " + response);
	    System.out.println("================================");

	} catch (Exception e) {
	    System.out.println("Python 서버 호출 실패");
	    e.printStackTrace();
	}
    }

    @Override
    public List<NoticeModel> getAllNotices() {
	return noticeMapper.selectAllNotices();
    }
    
    @Override
    public Map<String, Object> getNoticeDetail(String noticeNumber) {

	Map<String, Object> result = noticeMapper.selectNoticeDetail(noticeNumber);

	if (result == null) {
	    return new HashMap<>();
	}

	result.put("files", noticeMapper.selectNoticeFiles(noticeNumber));

	return result;
    }

//    public Map<String, Object> getNoticeDetailLive(String noticeNumber) {
//
//	LocalDate today = LocalDate.now();
//
//	String begin = today.minusDays(3).format(DateTimeFormatter.ofPattern("yyyyMMdd"));
//
//	String end = today.format(DateTimeFormatter.ofPattern("yyyyMMdd"));
//
//	Map<String, Object> result = new HashMap<>();
//
//	try {
//
//	    ObjectMapper mapper = new ObjectMapper();
//
//	    int pageNo = 1;
//
//	    while (true) {
//
//		String url =
//	                "https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoCnstwk"
//	                + "?serviceKey=" + serviceKey
//	                + "&pageNo=" + pageNo
//	                + "&numOfRows=100"
//	                + "&inqryDiv=1"
//	                + "&inqryBgnDt=" + begin + "0000"
//	                + "&inqryEndDt=" + end + "2359"
//	                + "&type=json";
//
//		String response = restTemplate.getForObject(url, String.class);
//
//		JsonNode items = mapper.readTree(response).path("response").path("body").path("items");
//
//		// 조회 결과가 없으면 종료
//		if (!items.isArray() || items.size() == 0) {
//		    break;
//		}
//
//		for (JsonNode node : items) {
//
//		    if (noticeNumber.equals(node.path("bidNtceNo").asText())) {
//
//			result.put("notice_number", node.path("bidNtceNo").asText());
//			result.put("notice_title", node.path("bidNtceNm").asText());
//			result.put("contract_method", node.path("cntrctCnclsMthdNm").asText());
//			result.put("agency", node.path("ntceInsttNm").asText());
//			result.put("demand_agency", node.path("dminsttNm").asText());
//			result.put("notice_date", node.path("bidNtceDt").asText());
//			result.put("opening_date", node.path("opengDt").asText());
//
//			String amtStr = node.path("bdgtAmt").asText();
//			Long amount = null;
//
//			if (amtStr != null && !amtStr.isEmpty()) {
//			    try {
//				amtStr = amtStr.replaceAll("[^0-9]", "");
//				if (!amtStr.isEmpty()) {
//				    amount = Long.parseLong(amtStr);
//				}
//			    } catch (Exception e) {
//				amount = null;
//			    }
//			}
//
//			result.put("amount", amount);
//
//			result.put("bid_start", node.path("bidNtceDt").asText());
//			result.put("bid_end", node.path("opengDt").asText());
//			result.put("biz_type", node.path("rgstTyNm").asText());
//			result.put("region", node.path("cnstrtsiteRgnNm").asText());
//
//			List<Map<String, String>> files = new ArrayList<>();
//
//			for (int i = 1; i <= 10; i++) {
//			    String name = node.path("ntceSpecFileNm" + i).asText();
//			    String urlFile = node.path("ntceSpecDocUrl" + i).asText();
//
//			    if (!name.isEmpty() && !urlFile.isEmpty()) {
//				Map<String, String> f = new HashMap<>();
//				f.put("fileName", name);
//				f.put("fileUrl", urlFile);
//				files.add(f);
//			    }
//			}
//
//			result.put("files", files);
//
//			return result;
//		    }
//		}
//
//		pageNo++;
//	    }
//
//	} catch (Exception e) {
//	    e.printStackTrace();
//	}
//
//	return result;
//    }
}