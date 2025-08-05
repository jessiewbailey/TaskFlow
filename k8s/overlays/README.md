# TaskFlow Kubernetes Overlays

This directory contains Kustomize overlays for different container registry configurations.

## Available Overlays

### Registry Overlays

These overlays configure TaskFlow to use different container registries:

- **local-registry/** - For local development with a local Docker registry
- **dockerhub-registry/** - For deployments using Docker Hub

## Usage

To deploy TaskFlow with a specific registry configuration:

```bash
# For local registry
kubectl apply -k k8s/overlays/local-registry/

# For Docker Hub
kubectl apply -k k8s/overlays/dockerhub-registry/
```

## Configuration

Each overlay updates the image references in the base deployment to point to the appropriate registry.

### Creating Custom Registry Overlays

To create an overlay for your own registry:

1. Create a new directory:
   ```bash
   mkdir -p k8s/overlays/my-registry
   ```

2. Create a `kustomization.yaml` file:
   ```yaml
   apiVersion: kustomize.config.k8s.io/v1beta1
   kind: Kustomization

   resources:
     - ../../base

   images:
     - name: docker.io/jessiewbailey/taskflow-api
       newName: my-registry.com/taskflow-api
       newTag: latest
     - name: docker.io/jessiewbailey/taskflow-ai
       newName: my-registry.com/taskflow-ai
       newTag: latest
     - name: docker.io/jessiewbailey/taskflow-web
       newName: my-registry.com/taskflow-web
       newTag: latest
   ```

## Note on Ollama

TaskFlow expects Ollama to be deployed separately in the `llm` namespace. The AI services will connect to Ollama at `http://ollama-service.llm:11434`.