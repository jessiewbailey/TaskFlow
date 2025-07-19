# Kubernetes Label Configuration Guide

This guide explains how to customize UI labels when deploying TaskFlow to Kubernetes.

## Quick Start

1. **Edit the ConfigMap** (`k8s/base/config-configmap.yaml`):
   ```yaml
   # Key fields to customize:
   dashboard:
     table:
       requester: "Submitter"  # Change to your preferred term
       analyst: "Assignee"     # Change to your preferred term
   ```

2. **Deploy with Kustomize**:
   ```bash
   kubectl apply -k k8s/base/ -n llm
   ```

3. **Restart the API** to apply changes:
   ```bash
   kubectl rollout restart deployment/taskflow-api -n llm
   ```

## Detailed Configuration

### Label Structure

The labels are organized in a hierarchical structure:

- `app` - Application branding
- `terminology` - Core terminology (task, request, etc.)
- `dashboard` - Dashboard-specific labels
  - `table` - Table column headers
  - `actions` - Button labels
- `forms` - Form labels and placeholders
- `navigation` - Navigation menu items
- `errors` - Error messages
- `success` - Success messages

### Common Customizations

#### Legal/FOIA System
```yaml
terminology:
  task: "FOIA Request"
  requester: "Requester"
  analyst: "FOIA Officer"
dashboard:
  table:
    requester: "Requester"
    analyst: "FOIA Officer"
```

#### IT Helpdesk
```yaml
terminology:
  task: "Ticket"
  requester: "User"
  analyst: "Technician"
dashboard:
  table:
    requester: "Reported By"
    analyst: "Assigned To"
```

#### HR Department
```yaml
terminology:
  task: "HR Request"
  requester: "Employee"
  analyst: "HR Specialist"
dashboard:
  table:
    requester: "Employee"
    analyst: "HR Specialist"
```

## Update Process

### Method 1: Edit ConfigMap Directly

1. Edit the ConfigMap in the cluster:
   ```bash
   kubectl edit configmap taskflow-config -n llm
   ```

2. Update the `ui-labels-labels.yaml` section

3. Restart the API:
   ```bash
   kubectl rollout restart deployment/taskflow-api -n llm
   ```

### Method 2: Update and Reapply

1. Edit `k8s/base/config-configmap.yaml`

2. Apply the changes:
   ```bash
   kubectl apply -f k8s/base/config-configmap.yaml -n llm
   ```

3. Restart the API:
   ```bash
   kubectl rollout restart deployment/taskflow-api -n llm
   ```

### Method 3: Using Kustomize Overlays

Create environment-specific overlays:

1. Create overlay directory:
   ```bash
   mkdir -p k8s/overlays/production
   ```

2. Create `kustomization.yaml`:
   ```yaml
   apiVersion: kustomize.config.k8s.io/v1beta1
   kind: Kustomization
   
   bases:
   - ../../base
   
   configMapGenerator:
   - name: taskflow-config
     behavior: merge
     files:
     - ui-labels-labels.yaml=custom-labels.yaml
   ```

3. Apply with overlay:
   ```bash
   kubectl apply -k k8s/overlays/production/ -n llm
   ```

## Verification

1. Check if ConfigMap is updated:
   ```bash
   kubectl get configmap taskflow-config -n llm -o yaml | grep requester
   ```

2. Check API logs:
   ```bash
   kubectl logs deployment/taskflow-api -n llm | grep "config"
   ```

3. Test in browser:
   - Clear browser cache
   - Refresh the application
   - Check if new labels appear

## Troubleshooting

### Labels not updating

1. **ConfigMap not mounted correctly**:
   ```bash
   kubectl describe pod -l app=taskflow-api -n llm
   ```
   Check the Volumes and Volume Mounts sections

2. **API not restarted**:
   ```bash
   kubectl rollout status deployment/taskflow-api -n llm
   ```

3. **Browser cache**:
   - Open Developer Tools
   - Disable cache
   - Hard refresh (Ctrl+Shift+R)

### Invalid YAML

If you get YAML parsing errors:
```bash
# Validate YAML syntax
kubectl create configmap test-config --from-file=labels.yaml --dry-run=client -o yaml
```

### Debugging

Enable debug logging:
```bash
kubectl set env deployment/taskflow-api LOG_LEVEL=DEBUG -n llm
```

Check config loading:
```bash
kubectl exec -it deployment/taskflow-api -n llm -- ls -la /app/config/
kubectl exec -it deployment/taskflow-api -n llm -- cat /app/config/ui-labels/labels.yaml
```

## Best Practices

1. **Test in staging first** before applying to production
2. **Keep backups** of your custom configurations
3. **Document your customizations** for team members
4. **Use version control** for your overlay configurations
5. **Monitor after changes** to ensure everything works correctly

## Advanced Configuration

### Multi-Language Support

While not built-in, you can create multiple label files:
```yaml
# k8s/overlays/spanish/labels-es.yaml
terminology:
  task: "Tarea"
  requester: "Solicitante"
  analyst: "Analista"
```

### Dynamic Configuration

For dynamic updates without restarts, consider:
1. Using a ConfigMap reloader sidecar
2. Implementing a webhook to reload config
3. Using a configuration management system

## Related Documentation

- [General UI Labels Configuration](configuring-ui-labels.md)
- [Docker Compose Configuration](../docker-compose.yml)
- [Backend Configuration API](../backend/app/routers/config_api.py)