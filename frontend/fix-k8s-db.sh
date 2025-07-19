#!/bin/bash
# Script to fix database foreign key issues in K8s deployment

echo "This script will help fix the foreign key constraint issue in your K8s deployment"
echo ""
echo "Run these commands to ensure all migrations are applied:"
echo ""
echo "# First, check if workflow_dashboard_configs table exists:"
echo "kubectl exec -it deployment/mysql -n llm -- mysql -u root -p\${MYSQL_ROOT_PASSWORD} taskflow_db -e \"SHOW TABLES LIKE 'workflow_dashboard_configs';\""
echo ""
echo "# If the table doesn't exist, create it:"
echo "kubectl exec -it deployment/mysql -n llm -- mysql -u root -p\${MYSQL_ROOT_PASSWORD} taskflow_db -e \"CREATE TABLE IF NOT EXISTS workflow_dashboard_configs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workflow_id BIGINT NOT NULL,
    fields JSON NOT NULL,
    layout ENUM('grid', 'list') DEFAULT 'grid',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
    UNIQUE KEY unique_workflow_dashboard (workflow_id)
);\""
echo ""
echo "# Check if custom_instructions table exists:"
echo "kubectl exec -it deployment/mysql -n llm -- mysql -u root -p\${MYSQL_ROOT_PASSWORD} taskflow_db -e \"SHOW TABLES LIKE 'custom_instructions';\""
echo ""
echo "# Verify workflow exists before saving dashboard config:"
echo "kubectl exec -it deployment/mysql -n llm -- mysql -u root -p\${MYSQL_ROOT_PASSWORD} taskflow_db -e \"SELECT id, name, status FROM workflows;\""
echo ""
echo "# If you're getting foreign key errors, check the specific error:"
echo "kubectl logs deployment/api -n llm | grep -i \"foreign key\" | tail -20"