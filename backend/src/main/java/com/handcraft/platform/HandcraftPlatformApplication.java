package com.handcraft.platform;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration;
import org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration;

@SpringBootApplication(exclude = {
        DataSourceAutoConfiguration.class,
        FlywayAutoConfiguration.class
})
public class HandcraftPlatformApplication {

    public static void main(String[] args) {
        SpringApplication.run(HandcraftPlatformApplication.class, args);
    }
}
