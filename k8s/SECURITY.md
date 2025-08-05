# Kubernetes Deployment Security Implementation

All TaskFlow deployments implement the following security measures:

## Security Context

### Pod-level Security
- Runs as non-root user (UID 1000)
- Uses non-root group (GID 1000)
- File system group set to 1000 for proper volume permissions

### Container-level Security
- **Privilege Escalation**: Disabled (`allowPrivilegeEscalation: false`)
- **Capabilities**: All Linux capabilities dropped
- **Root Access**: Prevented (`runAsNonRoot: true`)
- **Privileged Mode**: Disabled (`privileged: false`)
- **Seccomp Profile**: Runtime default security profile applied
- **File System**: Read-only where possible, writable for services requiring data persistence

## Resource Management
- All containers define both resource requests and limits
- Resource allocation varies by service requirements
- Prevents resource exhaustion and ensures fair scheduling

## Storage Security
- Persistent volume claims use appropriate access modes (typically ReadWriteOnce)
- Volume ownership handled through fsGroup for proper permissions
- Stateful services use StatefulSets with dedicated storage

## Network Security
- Services exposed only within the cluster using ClusterIP by default
- External access controlled through Ingress with proper authentication
- Each service exposes only required ports

## Security Context YAML Configuration

```yaml
# Pod-level security context
securityContext:
  runAsUser: 1000
  runAsGroup: 1000
  fsGroup: 1000

# Container-level security context
securityContext:
  allowPrivilegeEscalation: false
  capabilities:
    drop:
      - ALL
  privileged: false
  readOnlyRootFilesystem: false
  runAsNonRoot: true
  seccompProfile:
    type: RuntimeDefault
```

## Service-Specific Configurations

Different services may use different UIDs/GIDs based on their base images:
- **Standard services**: UID/GID 1000
- **PostgreSQL**: UID/GID 999 (postgres user)
- **Other databases**: May vary based on official image requirements

## Compliance

This configuration follows Kubernetes security best practices and aligns with the restricted Pod Security Standards.