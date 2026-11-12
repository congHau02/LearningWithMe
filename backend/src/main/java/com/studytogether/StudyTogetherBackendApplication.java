package com.studytogether;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class StudyTogetherBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(StudyTogetherBackendApplication.class, args);
    }
}
