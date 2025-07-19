# Security Guidelines

## Environment Configuration

### Development vs Production

This repository is configured for secure deployment with the following practices:

### ✅ Security Features Implemented

1. **Environment Variables**: All sensitive configuration uses environment variables with fallback defaults
2. **No Hardcoded Secrets**: Credentials are not hardcoded in the source code
3. **Template Files**: `.env.example` and `secrets.yaml.example` provide secure configuration templates
4. **Comprehensive .gitignore**: Prevents accidental commits of sensitive files

### 🔧 Setup for Development

1. **Create Environment File**: 
   ```bash
   cp .env.example .env
   # Edit .env with your development credentials
   ```

2. **Update Docker Compose**: The `docker-compose.yml` uses environment variables with safe defaults for development

3. **Kubernetes Deployment**:
   ```bash
   cp k8s/secrets.yaml.example k8s/secrets.yaml
   # Edit k8s/secrets.yaml with your production credentials
   ```

### 🚨 Production Security Checklist

- [ ] Change all default passwords
- [ ] Generate secure random SECRET_KEY (32+ characters)
- [ ] Use strong database passwords
- [ ] Enable HTTPS/TLS
- [ ] Set DEBUG=false
- [ ] Use external secret management (Vault, AWS Secrets Manager, etc.)
- [ ] Regular security updates
- [ ] Network security (firewalls, VPNs)
- [ ] Database access restrictions
- [ ] Container security scanning

### 🔒 Default Credentials (CHANGE IN PRODUCTION!)

**Default development credentials** (must be changed for production):
- MySQL Root Password: `rootpassword`
- MySQL User: `taskflow_user` 
- MySQL Password: `taskflow_password`
- Secret Key: `dev-secret-key-change-in-production`

### 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MYSQL_ROOT_PASSWORD` | MySQL root password | `rootpassword` |
| `MYSQL_USER` | MySQL application user | `taskflow_user` |
| `MYSQL_PASSWORD` | MySQL application password | `taskflow_password` |
| `MYSQL_DATABASE` | MySQL database name | `taskflow_db` |
| `SECRET_KEY` | Application secret key | `dev-secret-key-change-in-production` |
| `DEBUG` | Debug mode | `true` |

### 🛡️ Security Recommendations

1. **Use External Secret Management**: For production, consider:
   - HashiCorp Vault
   - AWS Secrets Manager
   - Azure Key Vault
   - Kubernetes External Secrets Operator

2. **Database Security**:
   - Use separate users with minimal privileges
   - Enable SSL/TLS connections
   - Regular backups with encryption

3. **Container Security**:
   - Regular image updates
   - Security scanning
   - Non-root users where possible
   - Resource limits

4. **Network Security**:
   - Use private networks
   - Implement proper firewall rules
   - TLS termination at load balancer

## Reporting Security Issues

If you discover a security vulnerability, please report it privately by emailing [security contact] rather than opening a public issue.