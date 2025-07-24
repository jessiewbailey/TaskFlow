# Configuring UI Labels in TaskFlow

TaskFlow provides a flexible configuration system that allows you to customize all UI labels and terminology to match your organization's needs.

## Overview

All UI labels are configured through YAML files in the `/config` directory. These configurations are served to the frontend via the API and can be updated without modifying code.

## Key Label Configurations

### Submitter/Requester Labels

The terms "Submitter" and "Requester" can be customized in several places:

1. **Table Headers** (`config/ui-labels/labels.yaml`):
   ```yaml
   dashboard:
     table:
       requester: "Submitter"  # Change this to customize the submitter column header
       analyst: "Assignee"     # Change this to customize the assignee column header
   ```

2. **Form Labels** (`config/ui-labels/labels.yaml`):
   ```yaml
   forms:
     new_task_modal:
       requester_label: "Submitter"  # Change this to customize the submitter field label
       requester_placeholder: "Enter submitter name or organization..."
   ```

### Other Customizable Labels

- **Application Name**: Change `app.name` and `app.title`
- **Task/Request Terminology**: Modify `terminology.task`, `terminology.request`
- **Status Labels**: Customize `terminology.status.*`
- **Action Buttons**: Update `dashboard.actions.*`
- **Navigation Items**: Modify `navigation.*`

## How to Update Labels

### Local Development

1. Edit the file `/config/ui-labels/labels.yaml`
2. The changes will be automatically picked up by the backend
3. Refresh your browser to see the updated labels

### Docker Deployment

1. Update the labels.yaml file
2. Restart the API container:
   ```bash
   docker-compose restart api
   ```

### Kubernetes Deployment

1. Update the ConfigMap with your custom labels:
   ```bash
   kubectl create configmap taskflow-ui-labels \
     --from-file=labels.yaml=config/ui-labels/labels.yaml \
     -n taskflow \
     --dry-run=client -o yaml | kubectl apply -f -
   ```

2. Restart the API deployment:
   ```bash
   kubectl rollout restart deployment/api -n taskflow
   ```

## Environment-Specific Configuration

You can maintain different label configurations for different environments:

- `labels.yaml` - Default labels
- `labels.production.yaml` - Production-specific labels
- `labels.development.yaml` - Development-specific labels

Set the `CONFIG_ENV` environment variable to select which configuration to use:
```bash
CONFIG_ENV=production
```

## Example: Customizing for Different Domains

### For Legal/FOIA Requests:
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

### For IT Helpdesk:
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

### For HR Department:
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

## Technical Details

The label configuration system uses:
- React Query hooks (`useUILabels()`) to fetch configurations
- Backend API endpoint `/api/config/ui-labels`
- YAML configuration files for easy editing
- Fallback values in the UI components for safety

## Best Practices

1. **Keep labels consistent** across the application
2. **Use clear, concise terminology** that your users understand
3. **Test label changes** in a development environment first
4. **Document your custom terminology** for new team members
5. **Consider internationalization** if you need multi-language support

## Troubleshooting

If labels aren't updating:
1. Check that the API is running and accessible
2. Clear your browser cache
3. Check the browser console for errors
4. Verify the YAML syntax is correct
5. Ensure the configuration files are mounted correctly in containers