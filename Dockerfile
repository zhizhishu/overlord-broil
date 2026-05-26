# overlord-master single-image build.
# Builds the Vite UI first, then embeds the static assets into the Spring Boot jar.

FROM node:22-bookworm AS frontend-build
WORKDIR /workspace/vite-frontend

COPY vite-frontend/package*.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

COPY vite-frontend/ ./
RUN npm run build

FROM maven:3.9.6-eclipse-temurin-21 AS backend-build
WORKDIR /workspace

COPY springboot-backend/pom.xml ./
COPY springboot-backend/src ./src
COPY --from=frontend-build /workspace/vite-frontend/dist ./src/main/resources/static

RUN mvn -B -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app

ENV SERVER_PORT=5166
ENV JAVA_OPTS="-Xmx512m -Xms256m -Dfile.encoding=UTF-8 -Duser.timezone=Asia/Shanghai"
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

RUN apt-get update \
    && apt-get install -y --no-install-recommends fontconfig fonts-dejavu wget \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY --from=backend-build /workspace/target/*.jar app.jar

EXPOSE 5166

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
