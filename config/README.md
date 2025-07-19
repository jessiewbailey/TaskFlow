# TaskFlow Configuration Guide

This directory contains all the configuration files needed to customize TaskFlow for your specific use case. By modifying these files, you can adapt TaskFlow from a generic task processing system to match your organization's terminology, workflows, and requirements.

## Directory Structure

```
config/
├── README.md                 # This file
├── domain-config.yaml       # Main domain configuration
├── ui-labels/
│   └── labels.yaml          # UI text labels and terminology
├── workflows/
│   ├── default-workflow.sql # Default workflow with AI analysis
│   └── simple-workflow.sql  # Simple workflow without AI
└── database-init/
    └── init-workflows.sql   # Database initialization script
```

## Configuration Files

### 1. UI Labels (`ui-labels/labels.yaml`)

This file contains all the text labels and terminology used throughout the TaskFlow user interface. Modify these to match your organization's language and terminology.

**Key sections:**
- `terminology`: Core terms like "task", "request", "analyst", etc.
- `dashboard`: Labels for the main dashboard interface
- `forms`: Labels for forms and input fields
- `settings`: Labels for configuration pages
- `errors`/`success`: User feedback messages

**Example customization:**
```yaml
terminology:
  task: "Support Ticket"
  tasks: "Support Tickets"
  requester: "Customer"
  analyst: "Support Agent"
```

### 2. Domain Configuration (`domain-config.yaml`)

This file defines the overall behavior and settings for your TaskFlow instance.

**Key sections:**
- `domain`: Basic information about your system
- `terminology`: Core terminology (should match UI labels)
- `ai_processing`: AI model and processing settings
- `workflows`: Default workflow behavior
- `dashboard`: Dashboard configuration
- `security`: Security and privacy settings
- `custom_fields`: Additional fields for requests

### 3. Workflow SQL Files (`workflows/`)

These files define the actual workflows that tasks will follow through your system.

**`default-workflow.sql`**: A comprehensive workflow with AI analysis steps
- Metadata extraction
- Topic classification
- Content summarization
- Sensitivity assessment
- Redaction suggestions
- Manual review
- Final approval

**`simple-workflow.sql`**: A basic workflow for simple task management
- Initial review
- Task processing
- Completion

**Creating custom workflows:**
1. Copy one of the existing workflow files
2. Modify the workflow name, description, and blocks
3. Update the dashboard configuration as needed
4. Add your new file to the `database-init/init-workflows.sql` script

### 4. Database Initialization (`database-init/init-workflows.sql`)

This script runs during system startup to initialize your workflows and create default users.

## Quick Start Customization

To quickly adapt TaskFlow for your use case:

1. **Update terminology** in `ui-labels/labels.yaml`:
   ```yaml
   terminology:
     task: "Your Task Type"
     requester: "Your User Type"
     analyst: "Your Processor Type"
   ```

2. **Modify domain settings** in `domain-config.yaml`:
   ```yaml
   domain:
     name: "Your System Name"
     description: "Description of your system"
   ```

3. **Choose or customize a workflow** in `workflows/`:
   - Use `default-workflow.sql` if you want AI analysis
   - Use `simple-workflow.sql` for basic task management
   - Create a custom workflow for specific needs

4. **Update database initialization** in `database-init/init-workflows.sql`:
   - Modify default users
   - Add your custom workflow
   - Remove sample data for production

## Example Use Cases

### Customer Support System
```yaml
# ui-labels/labels.yaml
terminology:
  task: "Support Ticket"
  requester: "Customer"
  analyst: "Support Agent"
  processing: "Ticket Resolution"
```

### Legal Document Review
```yaml
# ui-labels/labels.yaml
terminology:
  task: "Document Review"
  requester: "Client"
  analyst: "Legal Reviewer"
  processing: "Legal Analysis"
```

### HR Request Processing
```yaml
# ui-labels/labels.yaml
terminology:
  task: "HR Request"
  requester: "Employee"
  analyst: "HR Specialist"
  processing: "HR Review"
```

## Advanced Customization

### Custom Workflow Blocks

You can create custom workflow blocks by modifying the SQL files:

```sql
INSERT INTO workflow_blocks (workflow_id, block_type, name, description, config, sort_order, created_at) VALUES
(@workflow_id, 'custom_processing', 'Custom Step', 'Your custom processing step', 
 '{"custom_config": "value"}', 1, NOW());
```

### Custom Dashboard Widgets

Modify the dashboard configuration in workflow SQL files:

```sql
{
  "type": "metric",
  "title": "Your Custom Metric",
  "query": "SELECT COUNT(*) as value FROM your_table WHERE your_condition",
  "position": {"x": 0, "y": 0, "w": 3, "h": 2}
}
```

### Custom AI Prompts

Update the domain configuration or create custom prompt templates:

```yaml
ai_processing:
  prompt_templates:
    system_role: "Your custom AI role"
    custom_prompt: "Your custom prompt template"
```

## Docker Integration

These configuration files are automatically loaded when you start TaskFlow with Docker:

```bash
# Mount the config directory
docker-compose up -d

# Or with custom config location
docker run -v /path/to/your/config:/app/config taskflow
```

## Validation

After making changes, you can validate your configuration by:

1. Starting the system: `docker-compose up -d`
2. Checking the logs: `docker-compose logs`
3. Accessing the dashboard to verify UI changes
4. Testing workflow creation and processing

## Support

For additional help with customization:
- Check the main TaskFlow documentation
- Review the example configurations in this directory
- Test changes in a development environment before production deployment