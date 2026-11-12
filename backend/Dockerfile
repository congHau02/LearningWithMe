FROM maven:3.9-eclipse-temurin-21-alpine AS build
WORKDIR /workspace/backend
COPY backend/pom.xml .
RUN mvn dependency:go-offline -B
COPY backend/src ./src
COPY shared/maps ../shared/maps
RUN mvn clean package -DskipTests -B

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN mkdir -p /tmp/homework-uploads
COPY --from=build /workspace/backend/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
