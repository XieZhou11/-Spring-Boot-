package com.handcraft.platform.common.exception;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

class GlobalExceptionHandlerTest {

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new TestController())
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void shouldHandleBusinessException() throws Exception {
        mockMvc.perform(get("/test/business"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40000))
                .andExpect(jsonPath("$.message").value("业务校验失败"))
                .andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    void shouldHandleRequestBodyValidationException() throws Exception {
        mockMvc.perform(post("/test/validation")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40000))
                .andExpect(jsonPath("$.message").value("名称不能为空"))
                .andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    void shouldHideUnexpectedExceptionDetails() throws Exception {
        mockMvc.perform(get("/test/unexpected"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value(50000))
                .andExpect(jsonPath("$.message").value("系统内部错误"))
                .andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    void shouldPreserveMethodNotAllowedStatusAndAllowHeader() throws Exception {
        mockMvc.perform(get("/test/validation"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(header().string("Allow", containsString("POST")))
                .andExpect(jsonPath("$.code").value(40500))
                .andExpect(jsonPath("$.message").value("请求方法不支持"));
    }

    @Test
    void shouldPreserveUnsupportedMediaTypeStatus() throws Exception {
        mockMvc.perform(post("/test/validation")
                        .contentType(MediaType.TEXT_PLAIN)
                        .content("plain text"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.code").value(41500))
                .andExpect(jsonPath("$.message").value("请求内容类型不支持"));
    }

    @Test
    void shouldPreserveNotFoundStatus() throws Exception {
        mockMvc.perform(get("/test/missing"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(40400))
                .andExpect(jsonPath("$.message").value("请求的资源不存在"));
    }

    @Test
    void shouldPreserveFrameworkServerErrorStatusWithoutDetails() throws Exception {
        mockMvc.perform(get("/test/unavailable"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value(50300))
                .andExpect(jsonPath("$.message").value("系统内部错误"));
    }

    @Test
    void shouldHideBindingFailureDetails() throws Exception {
        mockMvc.perform(get("/test/binding").param("count", "review_test_marker"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40000))
                .andExpect(jsonPath("$.message").value("请求参数错误"));
    }

    @RestController
    static class TestController {

        @GetMapping("/test/business")
        void business() {
            throw new BusinessException(CommonErrorCode.INVALID_REQUEST, "业务校验失败");
        }

        @PostMapping("/test/validation")
        void validation(@Valid @RequestBody TestRequest request) {
        }

        @GetMapping("/test/unexpected")
        void unexpected() {
            throw new IllegalStateException("sensitive detail");
        }

        @GetMapping("/test/unavailable")
        void unavailable() {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "sensitive detail");
        }

        @GetMapping("/test/binding")
        void binding(@ModelAttribute BindingRequest request) {
        }
    }

    record TestRequest(@NotBlank(message = "名称不能为空") String name) {
    }

    record BindingRequest(Integer count) {
    }
}
