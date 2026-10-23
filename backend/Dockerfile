# ==============================================================================
# Stage 1: Build (Maven + Java 21 Alpine)
# ==============================================================================
FROM maven:3.9.9-eclipse-temurin-21-alpine AS build
WORKDIR /build

# 1. Copia apenas o pom.xml primeiro para aproveitar o cache de camadas do Docker
COPY pom.xml .
RUN mvn dependency:go-offline -B

# 2. Copia o código-fonte e gera o artefato .jar otimizado para produção
COPY src ./src
RUN mvn clean package -DskipTests -B

# ==============================================================================
# Stage 2: Runtime (Eclipse Temurin 21 JRE Alpine - Leve e Seguro)
# ==============================================================================
FROM eclipse-temurin:21-jre-alpine AS runtime
WORKDIR /app

# Cria diretório de dados persistentes caso use fallback local / logs
RUN mkdir -p /app/data

# Copia o .jar executável gerado no stage de build
COPY --from=build /build/target/*.jar app.jar

# Porta padrão do Total Trigo ERP (Google Cloud Run / Railway injetam $PORT)
EXPOSE 8085

# Ajuste de memória para containers cloud (Cloud Run / Railway / Render)
ENTRYPOINT ["sh", "-c", "java -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Dserver.port=${PORT:-8085} -jar app.jar"]
