package com.handcraft.platform;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** 应用入口；数据源与 Flyway 随启动配置完成初始化。 */
@SpringBootApplication
public class HandcraftPlatformApplication {

    public static void main(String[] args) {
        SpringApplication.run(HandcraftPlatformApplication.class, args);
    }
}
