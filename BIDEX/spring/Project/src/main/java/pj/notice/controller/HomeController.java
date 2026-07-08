package pj.notice.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class HomeController {

    @GetMapping("/sec_fin")
    public String index() {
	return "sec_fin"; // templates/index.html
    }
}