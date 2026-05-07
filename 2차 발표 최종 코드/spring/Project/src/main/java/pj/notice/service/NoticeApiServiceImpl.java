package pj.notice.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import pj.notice.mapper.NoticeMapper;
import pj.notice.model.NoticeModel;
import pj.notice.dto.FileInfoDto;

@Service
public class NoticeApiServiceImpl implements NoticeApiServiceIF {

	@Autowired
	private NoticeMapper noticeMapper;

	private RestTemplate restTemplate = new RestTemplate();

	private String serviceKey = "b801f42df1eaeb53e32ca3e08185a477ce2e0a1988d6c5f841370e09d5717190";

	@Override
	public void fetchNoticeFromApi() {
		try {
			String url = "https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoCnstwk"
					+ "?serviceKey=" + serviceKey + "&pageNo=1" + "&numOfRows=100" + "&inqryDiv=1"
					+ "&inqryBgnDt=202601180000" + "&inqryEndDt=202601312359" + "&type=json";

			String result = restTemplate.getForObject(url, String.class);

			ObjectMapper mapper = new ObjectMapper();
			JsonNode root = mapper.readTree(result);

			JsonNode items = root.path("response").path("body").path("items");

			if (items.isArray()) {
				for (JsonNode node : items) {
					saveNotice(node);
					List<FileInfoDto> files = extractFilesFromNotice(node);
					sendFilesToPython(files);
				}
			}

		} catch (Exception e) {
			e.printStackTrace();
		}
	}

	private void saveNotice(JsonNode node) {
		try {
			NoticeModel notice = new NoticeModel();
			notice.setNotice_number(node.path("bidNtceNo").asText());
			notice.setNotice_title(node.path("bidNtceNm").asText());
			notice.setContract_method(node.path("cntrctCnclsMthdNm").asText());

			String amtStr = node.path("bdgtAmt").asText().trim();
			Long amount = null;

			if (amtStr != null && !amtStr.isEmpty() && !amtStr.equals("-")) {
				amtStr = amtStr.replaceAll("[^0-9]", "");
				if (!amtStr.isEmpty()) {
					amount = Long.parseLong(amtStr);
				}
			}
			notice.setAmount(amount);

			notice.setAgency(node.path("ntceInsttNm").asText());
			notice.setDemand_agency(node.path("dminsttNm").asText());
			notice.setRegion(node.path("cnstrtsiteRgnNm").asText());

			noticeMapper.insertNotice(notice);

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

			restTemplate.postForObject(pythonUrl, requestBody, String.class);

		} catch (Exception e) {
			e.printStackTrace();
		}
	}

	@Override
	public List<NoticeModel> getAllNotices() {
		return noticeMapper.selectAllNotices();
	}

	// 🔥 핵심 수정된 부분
	public Map<String, Object> getNoticeDetailLive(String noticeNumber) {

		Map<String, Object> result = new HashMap<>();

		try {
			String url = "https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoCnstwk"
					+ "?serviceKey=" + serviceKey + "&pageNo=1" + "&numOfRows=100" + "&inqryDiv=1"
					+ "&inqryBgnDt=202601180000" + "&inqryEndDt=202601312359" + "&type=json";

			String response = restTemplate.getForObject(url, String.class);

			ObjectMapper mapper = new ObjectMapper();
			JsonNode items = mapper.readTree(response).path("response").path("body").path("items");

			for (JsonNode node : items) {

				if (noticeNumber.equals(node.path("bidNtceNo").asText())) {

					// ✅ 프론트 기준으로 key 맞춤
					result.put("notice_number", node.path("bidNtceNo").asText());
					result.put("notice_title", node.path("bidNtceNm").asText());
					result.put("contract_method", node.path("cntrctCnclsMthdNm").asText());
					result.put("agency", node.path("ntceInsttNm").asText());
					result.put("demand_agency", node.path("dminsttNm").asText());

					// 금액 변환
					String amtStr = node.path("bdgtAmt").asText();
					Long amount = null;

					if (amtStr != null && !amtStr.isEmpty()) {
						try {
							amtStr = amtStr.replaceAll("[^0-9]", "");
							if (!amtStr.isEmpty()) {
								amount = Long.parseLong(amtStr);
							}
						} catch (Exception e) {
							amount = null;
						}
					}

					result.put("amount", amount);

					result.put("bid_start", node.path("bidNtceDt").asText());
					result.put("bid_end", node.path("opengDt").asText());
					result.put("biz_type", node.path("rgstTyNm").asText());
					result.put("region", node.path("cnstrtsiteRgnNm").asText());

					List<Map<String, String>> files = new ArrayList<>();
					for (int i = 1; i <= 10; i++) {
						String name = node.path("ntceSpecFileNm" + i).asText();
						String urlFile = node.path("ntceSpecDocUrl" + i).asText();

						if (!name.isEmpty() && !urlFile.isEmpty()) {
							Map<String, String> f = new HashMap<>();
							f.put("fileName", name);
							f.put("fileUrl", urlFile);
							files.add(f);
						}
					}

					result.put("files", files);

					return result;
				}
			}

		} catch (Exception e) {
			e.printStackTrace();
		}

		return result;
	}
}