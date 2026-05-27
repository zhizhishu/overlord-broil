package com.admin.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Component;

import javax.annotation.Resource;
import javax.sql.DataSource;
import java.sql.Connection;
import java.util.List;

@Slf4j
@Component
public class OverlordSchemaInitializer implements ApplicationRunner {

    @Resource
    private JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        try {
            DataSource dataSource = jdbcTemplate.getDataSource();
            if (dataSource == null) {
                log.warn("overlord schema initialization skipped: datasource is unavailable");
                return;
            }
            try (Connection connection = dataSource.getConnection()) {
                String product = connection.getMetaData().getDatabaseProductName().toLowerCase();
                if (product.contains("sqlite")) {
                    initSqlite(dataSource);
                } else {
                    initMysql();
                }
            }
        } catch (Exception ex) {
            log.warn("overlord schema initialization skipped: {}", ex.getMessage());
        }
    }

    private void initMysql() {
        createMysqlTables();
        ensureMysqlControlServerColumns();
        copyMysqlLegacyRuntimeColumns();
    }

    private void createMysqlTables() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS `control_server` (
                  `id` int(10) NOT NULL AUTO_INCREMENT,
                  `name` varchar(100) NOT NULL,
                  `role` varchar(30) NOT NULL DEFAULT 'agent',
                  `endpoint` varchar(255) DEFAULT NULL,
                  `host` varchar(255) NOT NULL,
                  `xray_runtime_endpoint` varchar(255) DEFAULT NULL,
                  `xray_runtime_base_path` varchar(100) DEFAULT NULL,
                  `xray_runtime_api_token` varchar(512) DEFAULT NULL,
                  `xray_runtime_username` varchar(100) DEFAULT NULL,
                  `xray_runtime_password` varchar(512) DEFAULT NULL,
                  `xray_runtime_two_factor_code` varchar(255) DEFAULT NULL,
                  `xray_runtime_allow_insecure` int(1) NOT NULL DEFAULT '0',
                  `xray_runtime_last_sync` bigint(20) DEFAULT NULL,
                  `ssh_port` int(10) DEFAULT '22',
                  `ssh_user` varchar(100) DEFAULT 'root',
                  `api_token` varchar(100) NOT NULL,
                  `join_token` varchar(512) DEFAULT NULL,
                  `join_token_expires_at` bigint(20) DEFAULT NULL,
                  `join_token_used_at` bigint(20) DEFAULT NULL,
                  `allow_insecure` int(1) NOT NULL DEFAULT '0',
                  `agent_version` varchar(100) DEFAULT NULL,
                  `xray_version` varchar(100) DEFAULT NULL,
                  `snell_version` varchar(100) DEFAULT NULL,
                  `xray_runtime_service_status` varchar(30) DEFAULT NULL,
                  `xray_service_status` varchar(30) DEFAULT NULL,
                  `snell_service_status` varchar(30) DEFAULT NULL,
                  `certificate_mode` varchar(30) DEFAULT NULL,
                  `certificate_domain` varchar(255) DEFAULT NULL,
                  `certificate_status` varchar(30) DEFAULT NULL,
                  `certificate_expire_at` bigint(20) DEFAULT NULL,
                  `last_heartbeat` bigint(20) DEFAULT NULL,
                  `cpu_usage` double DEFAULT NULL,
                  `memory_usage` double DEFAULT NULL,
                  `memory_total_mb` bigint(20) DEFAULT NULL,
                  `low_memory_mode` int(1) NOT NULL DEFAULT '0',
                  `low_memory_profile` varchar(30) DEFAULT NULL,
                  `low_memory_advice` varchar(512) DEFAULT NULL,
                  `upload_traffic` bigint(20) DEFAULT NULL,
                  `download_traffic` bigint(20) DEFAULT NULL,
                  `last_error` longtext,
                  `created_time` bigint(20) NOT NULL,
                  `updated_time` bigint(20) DEFAULT NULL,
                  `status` int(10) NOT NULL,
                  PRIMARY KEY (`id`),
                  UNIQUE KEY `api_token` (`api_token`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS `protocol_profile` (
                  `id` int(10) NOT NULL AUTO_INCREMENT,
                  `name` varchar(100) NOT NULL,
                  `protocol` varchar(50) NOT NULL,
                  `version_family` varchar(50) DEFAULT NULL,
                  `listen_port` int(10) DEFAULT NULL,
                  `transport` varchar(50) DEFAULT NULL,
                  `remark` varchar(255) DEFAULT NULL,
                  `config_json` longtext,
                  `created_time` bigint(20) NOT NULL,
                  `updated_time` bigint(20) DEFAULT NULL,
                  `status` int(10) NOT NULL,
                  PRIMARY KEY (`id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS `protocol_node` (
                  `id` int(10) NOT NULL AUTO_INCREMENT,
                  `server_id` int(10) NOT NULL,
                  `server_name` varchar(100) DEFAULT NULL,
                  `name` varchar(100) NOT NULL,
                  `protocol` varchar(50) NOT NULL,
                  `engine` varchar(50) NOT NULL,
                  `direction` varchar(30) NOT NULL DEFAULT 'inbound',
                  `listen` varchar(100) DEFAULT NULL,
                  `port` int(10) DEFAULT NULL,
                  `transport` varchar(50) DEFAULT NULL,
                  `security` varchar(50) DEFAULT NULL,
                  `credential_json` longtext,
                  `config_json` longtext,
                  `remote_id` varchar(100) DEFAULT NULL,
                  `service_name` varchar(100) DEFAULT NULL,
                  `state` varchar(50) DEFAULT NULL,
                  `up` bigint(20) NOT NULL DEFAULT '0',
                  `down` bigint(20) NOT NULL DEFAULT '0',
                  `total` bigint(20) NOT NULL DEFAULT '0',
                  `last_sync` bigint(20) DEFAULT NULL,
                  `last_error` longtext,
                  `created_time` bigint(20) NOT NULL,
                  `updated_time` bigint(20) DEFAULT NULL,
                  `status` int(10) NOT NULL,
                  PRIMARY KEY (`id`),
                  KEY `server_id` (`server_id`),
                  KEY `engine` (`engine`),
                  KEY `protocol` (`protocol`),
                  KEY `remote_id` (`remote_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS `server_forward_rule` (
                  `id` int(10) NOT NULL AUTO_INCREMENT,
                  `server_id` int(10) NOT NULL,
                  `server_name` varchar(100) DEFAULT NULL,
                  `name` varchar(100) NOT NULL,
                  `protocol` varchar(20) NOT NULL DEFAULT 'tcp',
                  `listen_host` varchar(100) DEFAULT '0.0.0.0',
                  `listen_port` int(10) NOT NULL,
                  `target_host` varchar(255) NOT NULL,
                  `target_port` int(10) NOT NULL,
                  `engine` varchar(50) DEFAULT 'socat',
                  `service_name` varchar(100) DEFAULT NULL,
                  `state` varchar(50) DEFAULT NULL,
                  `up` bigint(20) NOT NULL DEFAULT '0',
                  `down` bigint(20) NOT NULL DEFAULT '0',
                  `last_sync` bigint(20) DEFAULT NULL,
                  `last_error` longtext,
                  `created_time` bigint(20) NOT NULL,
                  `updated_time` bigint(20) DEFAULT NULL,
                  `status` int(10) NOT NULL,
                  PRIMARY KEY (`id`),
                  KEY `server_id` (`server_id`),
                  KEY `listen_port` (`listen_port`),
                  KEY `service_name` (`service_name`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS `deploy_task` (
                  `id` int(10) NOT NULL AUTO_INCREMENT,
                  `server_id` int(10) NOT NULL,
                  `server_name` varchar(100) DEFAULT NULL,
                  `protocol` varchar(50) NOT NULL,
                  `action` varchar(50) NOT NULL DEFAULT 'present',
                  `state` varchar(50) NOT NULL DEFAULT 'generated',
                  `request_json` longtext,
                  `script` longtext,
                  `result_json` longtext,
                  `started_time` bigint(20) DEFAULT NULL,
                  `finished_time` bigint(20) DEFAULT NULL,
                  `created_time` bigint(20) NOT NULL,
                  `updated_time` bigint(20) DEFAULT NULL,
                  `status` int(10) NOT NULL,
                  PRIMARY KEY (`id`),
                  KEY `server_id` (`server_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS `monitor_alert` (
                  `id` int(10) NOT NULL AUTO_INCREMENT,
                  `server_id` int(10) NOT NULL,
                  `server_name` varchar(100) DEFAULT NULL,
                  `alert_type` varchar(50) NOT NULL,
                  `severity` varchar(30) NOT NULL DEFAULT 'warning',
                  `source` varchar(50) NOT NULL,
                  `message` varchar(255) NOT NULL,
                  `detail_json` longtext,
                  `first_seen_at` bigint(20) NOT NULL,
                  `last_seen_at` bigint(20) NOT NULL,
                  `acknowledged` int(1) NOT NULL DEFAULT '0',
                  `acknowledged_time` bigint(20) DEFAULT NULL,
                  `created_time` bigint(20) NOT NULL,
                  `updated_time` bigint(20) DEFAULT NULL,
                  `status` int(10) NOT NULL,
                  PRIMARY KEY (`id`),
                  KEY `server_id` (`server_id`),
                  KEY `alert_type` (`alert_type`),
                  KEY `acknowledged` (`acknowledged`),
                  KEY `last_seen_at` (`last_seen_at`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
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
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS `xray_runtime_traffic_snapshot` (
                  `id` int(10) NOT NULL AUTO_INCREMENT,
                  `server_id` int(10) NOT NULL,
                  `server_name` varchar(100) DEFAULT NULL,
                  `source_type` varchar(30) NOT NULL,
                  `inbound_id` int(10) DEFAULT NULL,
                  `inbound_remark` varchar(255) DEFAULT NULL,
                  `protocol` varchar(50) DEFAULT NULL,
                  `tag` varchar(255) DEFAULT NULL,
                  `email` varchar(255) DEFAULT NULL,
                  `client_id` varchar(255) DEFAULT NULL,
                  `up` bigint(20) NOT NULL DEFAULT '0',
                  `down` bigint(20) NOT NULL DEFAULT '0',
                  `total` bigint(20) NOT NULL DEFAULT '0',
                  `expiry_time` bigint(20) DEFAULT NULL,
                  `enable` int(1) DEFAULT NULL,
                  `synced_time` bigint(20) NOT NULL,
                  `raw_json` longtext,
                  `created_time` bigint(20) NOT NULL,
                  `updated_time` bigint(20) DEFAULT NULL,
                  `status` int(10) NOT NULL,
                  PRIMARY KEY (`id`),
                  KEY `server_id` (`server_id`),
                  KEY `source_type` (`source_type`),
                  KEY `synced_time` (`synced_time`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
    }

    private void ensureMysqlControlServerColumns() {
        ensureMysqlColumn("control_server", "role", "varchar(30) NOT NULL DEFAULT 'agent'");
        ensureMysqlColumn("control_server", "endpoint", "varchar(255) DEFAULT NULL");
        ensureMysqlColumn("control_server", "host", "varchar(255) NOT NULL DEFAULT ''");
        ensureMysqlColumn("control_server", "xray_runtime_endpoint", "varchar(255) DEFAULT NULL");
        ensureMysqlColumn("control_server", "xray_runtime_base_path", "varchar(100) DEFAULT NULL");
        ensureMysqlColumn("control_server", "xray_runtime_api_token", "varchar(512) DEFAULT NULL");
        ensureMysqlColumn("control_server", "xray_runtime_username", "varchar(100) DEFAULT NULL");
        ensureMysqlColumn("control_server", "xray_runtime_password", "varchar(512) DEFAULT NULL");
        ensureMysqlColumn("control_server", "xray_runtime_two_factor_code", "varchar(255) DEFAULT NULL");
        ensureMysqlColumn("control_server", "xray_runtime_allow_insecure", "int(1) NOT NULL DEFAULT '0'");
        ensureMysqlColumn("control_server", "xray_runtime_last_sync", "bigint(20) DEFAULT NULL");
        ensureMysqlColumn("control_server", "ssh_port", "int(10) DEFAULT '22'");
        ensureMysqlColumn("control_server", "ssh_user", "varchar(100) DEFAULT 'root'");
        ensureMysqlColumn("control_server", "api_token", "varchar(100) NOT NULL DEFAULT ''");
        ensureMysqlColumn("control_server", "join_token", "varchar(512) DEFAULT NULL");
        ensureMysqlColumn("control_server", "join_token_expires_at", "bigint(20) DEFAULT NULL");
        ensureMysqlColumn("control_server", "join_token_used_at", "bigint(20) DEFAULT NULL");
        ensureMysqlColumn("control_server", "allow_insecure", "int(1) NOT NULL DEFAULT '0'");
        ensureMysqlColumn("control_server", "agent_version", "varchar(100) DEFAULT NULL");
        ensureMysqlColumn("control_server", "xray_version", "varchar(100) DEFAULT NULL");
        ensureMysqlColumn("control_server", "snell_version", "varchar(100) DEFAULT NULL");
        ensureMysqlColumn("control_server", "xray_runtime_service_status", "varchar(30) DEFAULT NULL");
        ensureMysqlColumn("control_server", "xray_service_status", "varchar(30) DEFAULT NULL");
        ensureMysqlColumn("control_server", "snell_service_status", "varchar(30) DEFAULT NULL");
        ensureMysqlColumn("control_server", "certificate_mode", "varchar(30) DEFAULT NULL");
        ensureMysqlColumn("control_server", "certificate_domain", "varchar(255) DEFAULT NULL");
        ensureMysqlColumn("control_server", "certificate_status", "varchar(30) DEFAULT NULL");
        ensureMysqlColumn("control_server", "certificate_expire_at", "bigint(20) DEFAULT NULL");
        ensureMysqlColumn("control_server", "last_heartbeat", "bigint(20) DEFAULT NULL");
        ensureMysqlColumn("control_server", "cpu_usage", "double DEFAULT NULL");
        ensureMysqlColumn("control_server", "memory_usage", "double DEFAULT NULL");
        ensureMysqlColumn("control_server", "memory_total_mb", "bigint(20) DEFAULT NULL");
        ensureMysqlColumn("control_server", "low_memory_mode", "int(1) NOT NULL DEFAULT '0'");
        ensureMysqlColumn("control_server", "low_memory_profile", "varchar(30) DEFAULT NULL");
        ensureMysqlColumn("control_server", "low_memory_advice", "varchar(512) DEFAULT NULL");
        ensureMysqlColumn("control_server", "upload_traffic", "bigint(20) DEFAULT NULL");
        ensureMysqlColumn("control_server", "download_traffic", "bigint(20) DEFAULT NULL");
        ensureMysqlColumn("control_server", "last_error", "longtext");
    }

    private void copyMysqlLegacyRuntimeColumns() {
        copyMysqlLegacyText("xui_endpoint", "xray_runtime_endpoint");
        copyMysqlLegacyText("xui_base_path", "xray_runtime_base_path");
        copyMysqlLegacyText("xui_api_token", "xray_runtime_api_token");
        copyMysqlLegacyText("xui_username", "xray_runtime_username");
        copyMysqlLegacyText("xui_password", "xray_runtime_password");
        copyMysqlLegacyText("xui_two_factor_code", "xray_runtime_two_factor_code");
        copyMysqlLegacyNumber("xui_last_sync", "xray_runtime_last_sync");
        copyMysqlLegacyText("xui_service_status", "xray_runtime_service_status");
    }

    private boolean mysqlColumnExists(String table, String column) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
                Integer.class,
                table,
                column
        );
        return count != null && count > 0;
    }

    private void ensureMysqlColumn(String table, String column, String definition) {
        if (!mysqlColumnExists(table, column)) {
            jdbcTemplate.execute("ALTER TABLE `" + table + "` ADD COLUMN `" + column + "` " + definition);
        }
    }

    private void copyMysqlLegacyText(String legacyColumn, String newColumn) {
        if (mysqlColumnExists("control_server", legacyColumn) && mysqlColumnExists("control_server", newColumn)) {
            jdbcTemplate.update("UPDATE `control_server` SET `" + newColumn + "` = COALESCE(NULLIF(`" + newColumn + "`, ''), `" + legacyColumn + "`) WHERE `" + legacyColumn + "` IS NOT NULL AND (`" + newColumn + "` IS NULL OR `" + newColumn + "` = '')");
        }
    }

    private void copyMysqlLegacyNumber(String legacyColumn, String newColumn) {
        if (mysqlColumnExists("control_server", legacyColumn) && mysqlColumnExists("control_server", newColumn)) {
            jdbcTemplate.update("UPDATE `control_server` SET `" + newColumn + "` = `" + legacyColumn + "` WHERE `" + legacyColumn + "` IS NOT NULL AND (`" + newColumn + "` IS NULL OR `" + newColumn + "` = 0)");
        }
    }

    private void initSqlite(DataSource dataSource) {
        ResourceDatabasePopulator populator = new ResourceDatabasePopulator(new ClassPathResource("schema-sqlite.sql"));
        populator.setContinueOnError(true);
        populator.execute(dataSource);
        ensureSqliteControlServerColumns();
        copySqliteLegacyRuntimeColumns();
    }

    private void ensureSqliteControlServerColumns() {
        ensureSqliteColumn("control_server", "role", "TEXT NOT NULL DEFAULT 'agent'");
        ensureSqliteColumn("control_server", "endpoint", "TEXT");
        ensureSqliteColumn("control_server", "host", "TEXT NOT NULL DEFAULT ''");
        ensureSqliteColumn("control_server", "xray_runtime_endpoint", "TEXT");
        ensureSqliteColumn("control_server", "xray_runtime_base_path", "TEXT");
        ensureSqliteColumn("control_server", "xray_runtime_api_token", "TEXT");
        ensureSqliteColumn("control_server", "xray_runtime_username", "TEXT");
        ensureSqliteColumn("control_server", "xray_runtime_password", "TEXT");
        ensureSqliteColumn("control_server", "xray_runtime_two_factor_code", "TEXT");
        ensureSqliteColumn("control_server", "xray_runtime_allow_insecure", "INTEGER NOT NULL DEFAULT 0");
        ensureSqliteColumn("control_server", "xray_runtime_last_sync", "INTEGER");
        ensureSqliteColumn("control_server", "ssh_port", "INTEGER DEFAULT 22");
        ensureSqliteColumn("control_server", "ssh_user", "TEXT DEFAULT 'root'");
        ensureSqliteColumn("control_server", "api_token", "TEXT NOT NULL DEFAULT ''");
        ensureSqliteColumn("control_server", "join_token", "TEXT");
        ensureSqliteColumn("control_server", "join_token_expires_at", "INTEGER");
        ensureSqliteColumn("control_server", "join_token_used_at", "INTEGER");
        ensureSqliteColumn("control_server", "allow_insecure", "INTEGER NOT NULL DEFAULT 0");
        ensureSqliteColumn("control_server", "agent_version", "TEXT");
        ensureSqliteColumn("control_server", "xray_version", "TEXT");
        ensureSqliteColumn("control_server", "snell_version", "TEXT");
        ensureSqliteColumn("control_server", "xray_runtime_service_status", "TEXT");
        ensureSqliteColumn("control_server", "xray_service_status", "TEXT");
        ensureSqliteColumn("control_server", "snell_service_status", "TEXT");
        ensureSqliteColumn("control_server", "certificate_mode", "TEXT");
        ensureSqliteColumn("control_server", "certificate_domain", "TEXT");
        ensureSqliteColumn("control_server", "certificate_status", "TEXT");
        ensureSqliteColumn("control_server", "certificate_expire_at", "INTEGER");
        ensureSqliteColumn("control_server", "last_heartbeat", "INTEGER");
        ensureSqliteColumn("control_server", "cpu_usage", "REAL");
        ensureSqliteColumn("control_server", "memory_usage", "REAL");
        ensureSqliteColumn("control_server", "memory_total_mb", "INTEGER");
        ensureSqliteColumn("control_server", "low_memory_mode", "INTEGER NOT NULL DEFAULT 0");
        ensureSqliteColumn("control_server", "low_memory_profile", "TEXT");
        ensureSqliteColumn("control_server", "low_memory_advice", "TEXT");
        ensureSqliteColumn("control_server", "upload_traffic", "INTEGER");
        ensureSqliteColumn("control_server", "download_traffic", "INTEGER");
        ensureSqliteColumn("control_server", "last_error", "TEXT");
    }

    private boolean sqliteColumnExists(String table, String column) {
        List<String> columns = jdbcTemplate.query("PRAGMA table_info(" + table + ")", (rs, rowNum) -> rs.getString("name"));
        return columns.contains(column);
    }

    private void ensureSqliteColumn(String table, String column, String definition) {
        if (!sqliteColumnExists(table, column)) {
            jdbcTemplate.execute("ALTER TABLE " + table + " ADD COLUMN " + column + " " + definition);
        }
    }

    private void copySqliteLegacyRuntimeColumns() {
        copySqliteLegacyText("xui_endpoint", "xray_runtime_endpoint");
        copySqliteLegacyText("xui_base_path", "xray_runtime_base_path");
        copySqliteLegacyText("xui_api_token", "xray_runtime_api_token");
        copySqliteLegacyText("xui_username", "xray_runtime_username");
        copySqliteLegacyText("xui_password", "xray_runtime_password");
        copySqliteLegacyText("xui_two_factor_code", "xray_runtime_two_factor_code");
        copySqliteLegacyNumber("xui_last_sync", "xray_runtime_last_sync");
        copySqliteLegacyText("xui_service_status", "xray_runtime_service_status");
    }

    private void copySqliteLegacyText(String legacyColumn, String newColumn) {
        if (sqliteColumnExists("control_server", legacyColumn) && sqliteColumnExists("control_server", newColumn)) {
            jdbcTemplate.update("UPDATE control_server SET " + newColumn + " = COALESCE(NULLIF(" + newColumn + ", ''), " + legacyColumn + ") WHERE " + legacyColumn + " IS NOT NULL AND (" + newColumn + " IS NULL OR " + newColumn + " = '')");
        }
    }

    private void copySqliteLegacyNumber(String legacyColumn, String newColumn) {
        if (sqliteColumnExists("control_server", legacyColumn) && sqliteColumnExists("control_server", newColumn)) {
            jdbcTemplate.update("UPDATE control_server SET " + newColumn + " = " + legacyColumn + " WHERE " + legacyColumn + " IS NOT NULL AND (" + newColumn + " IS NULL OR " + newColumn + " = 0)");
        }
    }
}
