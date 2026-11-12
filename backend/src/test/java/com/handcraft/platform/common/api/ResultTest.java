package com.handcraft.platform.common.api;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ResultTest {

    @Test
    void shouldCreateSuccessResultWithData() {
        Result<String> result = Result.ok("ready");

        assertThat(result.getCode()).isEqualTo(0);
        assertThat(result.getMessage()).isEqualTo("success");
        assertThat(result.getData()).isEqualTo("ready");
    }

    @Test
    void shouldCreateSuccessResultWithoutData() {
        Result<Void> result = Result.ok();

        assertThat(result.getCode()).isEqualTo(0);
        assertThat(result.getMessage()).isEqualTo("success");
        assertThat(result.getData()).isNull();
    }

    @Test
    void shouldCreateFailureResult() {
        Result<Void> result = Result.error(40000, "请求参数错误");

        assertThat(result.getCode()).isEqualTo(40000);
        assertThat(result.getMessage()).isEqualTo("请求参数错误");
        assertThat(result.getData()).isNull();
    }
}
