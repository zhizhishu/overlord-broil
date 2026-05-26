package com.admin.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.annotation.Resource;
import java.sql.Connection;

@Slf4j
@Component
public class OperationAuditSchemaInitializer implements ApplicationRunner {

    @Resource
    private JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        try (Connection connection = jdbcTemplate.getDataSource().getConnection()) {
            String product = connection.getMetaData().getDatabaseProductName().toLowerCase();
            if (product.contains("sqlite")) {
                initSqlite();
            } else {
                initMysql();
            }
        } catch (Exception ex) {
            log.warn("operation audit schema initialization skipped: {}", ex.getMessage());
        }
    }

    private void initMysql() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS `operation_audit_log` (
                  `id` int(10) NOT NULL AUTO_INCREMENT,
                  `actor_type` varchar(50) NOT NULL,
                  `actor_id` varchar(100) DEFAULT NULL,
                  `actor_name` varchar(100) DEFAULT NULL,
                  `event_type` varchar(80) NOT NULL,
                  `resource_type` varchar(80) DEFAULT NULL,
                  `resource_id` varchar(100) DEFAULT NULL,
                  `server_id` int(10) DEFAULT NULL,
                  `server_name` varchar(100) DEFAULT NULL,
                  `provider_key` varchar(50) DEFAULT NULL,
                  `action` varchar(80) DEFAULT NULL,
                  `danger` int(1) NOT NULL DEFAULT '0',
                  `outcome` varchar(50) NOT NULL,
                  `summary` varchar(255) DEFAULT NULL,
                  `detail_json` longtext,
                  `created_time` bigint(20) NOT NULL,
                  `updated_time` bigint(20) DEFAULT NULL,
                  `status` int(10) NOT NULL,
                  PRIMARY KEY (`id`),
                  KEY `server_id` (`server_id`),
                  KEY `event_type` (`event_type`),
                  KEY `provider_key` (`provider_key`),
                  KEY `outcome` (`outcome`),
                  KEY `created_time` (`created_time`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
    }

    private void initSqlite() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS operation_audit_log (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  actor_type TEXT NOT NULL,
                  actor_id TEXT,
                  actor_name TEXT,
                  event_type TEXT NOT NULL,
                  resource_type TEXT,
                  resource_id TEXT,
                  server_id INTEGER,
                  server_name TEXT,
                  provider_key TEXT,
                  action TEXT,
                  danger INTEGER NOT NULL DEFAULT 0,
                  outcome TEXT NOT NULL,
                  summary TEXT,
                  detail_json TEXT,
                  created_time INTEGER NOT NULL,
                  updated_time INTEGER,
                  status INTEGER NOT NULL
                )
                """);
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_operation_audit_server_id ON operation_audit_log (server_id)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_operation_audit_event_type ON operation_audit_log (event_type)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_operation_audit_provider_key ON operation_audit_log (provider_key)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_operation_audit_outcome ON operation_audit_log (outcome)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_operation_audit_created_time ON operation_audit_log (created_time)");
    }
}
