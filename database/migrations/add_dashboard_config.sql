-- Add dashboard configuration table
CREATE TABLE workflow_dashboard_configs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workflow_id BIGINT NOT NULL,
    fields JSON NOT NULL,
    layout ENUM('grid', 'list') DEFAULT 'grid',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
    UNIQUE KEY unique_workflow_dashboard (workflow_id)
);