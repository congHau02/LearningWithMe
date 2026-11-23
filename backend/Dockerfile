FROM --platform=$BUILDPLATFORM maven:3.9-eclipse-temurin-21-alpine AS build
WORKDIR /workspace/backend
RUN mkdir -p /root/.m2 && printf '%s\n' \
  '<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0">' \
  '  <mirrors>' \
  '    <mirror>' \
  '      <id>google-maven-central</id>' \
  '      <url>https://maven-central.storage-download.googleapis.com/maven2/</url>' \
  '      <mirrorOf>external:*</mirrorOf>' \
  '    </mirror>' \
  '  </mirrors>' \
  '</settings>' > /root/.m2/settings.xml
COPY backend/pom.xml .
RUN mvn dependency:go-offline test-compile -Dmaven.test.skip=true -Djacoco.skip=true -B
COPY backend/src/main ./src/main
COPY shared/maps ../shared/maps
RUN mvn clean package -Dmaven.test.skip=true -Djacoco.skip=true -B

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN mkdir -p /tmp/homework-uploads
COPY --from=build /workspace/backend/target/*.jar app.jar
ENV JAVA_TOOL_OPTIONS="-XX:+UseSerialGC -XX:MaxRAMPercentage=60.0 -Xss512k"
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
