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

            String url =
                "https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoCnstwk"
                + "?serviceKey=" + serviceKey
                + "&pageNo=1"
                + "&numOfRows=50"
                + "&inqryDiv=1"
                + "&inqryBgnDt=202601021000"
                + "&inqryEndDt=202601312359"
                + "&type=json";

            System.out.println("공공 API 요청 URL: " + url);

            String result = restTemplate.getForObject(url, String.class);

            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(result);

            JsonNode items =
                    root.path("response")
                        .path("body")
                        .path("items");

            if (items.isArray()) {

                System.out.println("조회된 공고 수: " + items.size());

                for (JsonNode node : items) {

                    String bidNtceNo = node.path("bidNtceNo").asText();
                    String bidNtceOrd = node.path("bidNtceOrd").asText();

                    if (bidNtceOrd == null || bidNtceOrd.isEmpty()) {
                        bidNtceOrd = "000";
                    }

                    System.out.println("공고번호: " + bidNtceNo + " / 차수: " + bidNtceOrd);

                    // 공고 DB 저장
                    saveNotice(node);

                    // 공고 JSON에서 첨부파일 추출
                    List<FileInfoDto> files = extractFilesFromNotice(node);

                    // Python 서버 전송
                    sendFilesToPython(files);

                }

            } else {

                System.out.println("조회된 공고 데이터가 없습니다.");

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
            notice.setAmount(node.path("asignBdgtAmt").asLong());
            notice.setAgency(node.path("ntceInsttNm").asText());
            notice.setDemand_agency(node.path("dminsttNm").asText());
            notice.setRegion(node.path("cnstrtsiteRgnNm").asText());

            noticeMapper.insertNotice(notice);

            System.out.println("DB 저장 완료: " + notice.getNotice_number());

        } catch (Exception e) {
            e.printStackTrace();
        }
    }


    // 공고 JSON에서 첨부파일 추출
    private List<FileInfoDto> extractFilesFromNotice(JsonNode node) {

        List<FileInfoDto> files = new ArrayList<>();

        String bidNtceNo = node.path("bidNtceNo").asText();

        for (int i = 1; i <= 10; i++) {

            String fileName = node.path("ntceSpecFileNm" + i).asText();
            String fileUrl = node.path("ntceSpecDocUrl" + i).asText();

            if (fileName != null && !fileName.isEmpty()
                    && fileUrl != null && !fileUrl.isEmpty()) {

                FileInfoDto file = new FileInfoDto();

                file.setBidNtceNo(bidNtceNo);
                file.setFileName(fileName);
                file.setFileUrl(fileUrl);

                files.add(file);

                System.out.println("첨부파일 발견: " + fileName);
            }
        }

        return files;
    }


    private void sendFilesToPython(List<FileInfoDto> files) {

        try {

            if (files == null || files.isEmpty()) {
                System.out.println("Python 전송 파일 없음");
                return;
            }

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

            System.out.println("Python 서버 전송 시작 (파일 수): " + fileList.size());

            restTemplate.postForObject(pythonUrl, requestBody, String.class);

            System.out.println("Python 서버 전송 완료");

        } catch (Exception e) {

            System.out.println("Python server connection failed");
            e.printStackTrace();

        }

    }


    @Override
    public List<NoticeModel> getAllNotices() {
        return noticeMapper.selectAllNotices();
    }

}