#!/bin/bash

# Apply migrations for async task processing renovation

echo "Applying async task processing migrations..."

# Get the postgres pod name
POSTGRES_POD=$(kubectl get pods -n taskflow -l app=postgres -o jsonpath='{.items[0].metadata.name}')

if [ -z "$POSTGRES_POD" ]; then
    echo "Error: PostgreSQL pod not found"
    exit 1
fi

echo "Found PostgreSQL pod: $POSTGRES_POD"

# Apply the migrations
echo "Applying embedding_status migration..."
kubectl exec -n taskflow -i $POSTGRES_POD -- psql -U taskflow_user -d taskflow_db < ../database/migrations/add_embedding_status.sql

echo "Applying retry_count migration..."
kubectl exec -n taskflow -i $POSTGRES_POD -- psql -U taskflow_user -d taskflow_db < ../database/migrations/add_retry_count_to_jobs.sql

echo "Migrations applied successfully!"

# Verify the changes
echo -e "\nVerifying schema changes..."
kubectl exec -n taskflow -i $POSTGRES_POD -- psql -U taskflow_user -d taskflow_db -c "\d requests" | grep embedding_status
kubectl exec -n taskflow -i $POSTGRES_POD -- psql -U taskflow_user -d taskflow_db -c "\d processing_jobs" | grep retry_count

echo -e "\nMigration complete!"