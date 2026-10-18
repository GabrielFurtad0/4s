# ==========================================
# TotalTrigo ERP Backend - Multi-stage Build
# ==========================================

# Stage 1: Build stage with JDK 21 Alpine
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app

# Copy Maven wrapper files and pom.xml
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./

# Ensure Unix line endings and execute permissions on mvnw
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw

# Resolve dependencies in a separate layer for faster rebuilds
RUN ./mvnw dependency:go-offline -B || true

# Copy source code and build production jar
COPY src/ src/
RUN ./mvnw clean package -DskipTests -B

# Stage 2: Minimal, secure runtime stage with JRE 21 Alpine
FROM eclipse-temurin:21-jre-alpine AS runner
WORKDIR /app

# Create non-root user and group
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy built JAR artifact from builder stage
COPY --from=builder /app/target/*.jar app.jar

# Adjust file ownership
RUN chown -R appuser:appgroup /app

USER appuser

# Default environment configuration (overrideable at runtime)
ENV SPRING_PROFILES_ACTIVE=prod
ENV PORT=8085

EXPOSE 8085

ENTRYPOINT ["java", "-Djava.security.egd=file:/dev/./urandom", "-jar", "app.jar"]
