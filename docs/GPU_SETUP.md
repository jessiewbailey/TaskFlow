# GPU Support for TaskFlow

This guide explains how to enable GPU acceleration for Ollama in TaskFlow, which can significantly improve AI model performance.

## Prerequisites

### 1. NVIDIA GPU
- NVIDIA GPU with CUDA Compute Capability 5.0 or higher
- At least 4GB of VRAM (8GB+ recommended for larger models)

### 2. NVIDIA Drivers
```bash
# Check if NVIDIA drivers are installed
nvidia-smi

# Install drivers on Ubuntu/Debian
sudo apt update
sudo apt install nvidia-driver-535  # or latest version
```

### 3. NVIDIA Container Toolkit
```bash
# Add the package repositories
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list

# Install nvidia-docker2
sudo apt update
sudo apt install -y nvidia-docker2

# Restart Docker
sudo systemctl restart docker

# Test GPU access
docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi
```

## Using GPU with TaskFlow

### Option 1: Use the GPU-enabled compose file
```bash
# Start TaskFlow with GPU support
docker-compose -f docker-compose.gpu.yml up -d

# Check if Ollama is using GPU
docker logs taskflow-ollama | grep -i gpu
```

### Option 2: Modify the default compose file
If you prefer to use the standard `docker-compose.yml`, it has been updated to include GPU support. Just ensure you have the prerequisites installed.

```bash
docker-compose up -d
```

## Verifying GPU Usage

### 1. Check Ollama GPU detection
```bash
# Execute inside the Ollama container
docker exec taskflow-ollama nvidia-smi

# Check Ollama logs for GPU initialization
docker logs taskflow-ollama | grep -i "gpu"
```

### 2. Monitor GPU usage during inference
```bash
# In a separate terminal, monitor GPU usage
watch -n 1 nvidia-smi

# Run a workflow in TaskFlow and observe GPU utilization
```

## Troubleshooting

### Issue: "could not select device driver"
**Solution**: Ensure NVIDIA Container Toolkit is properly installed:
```bash
sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker
```

### Issue: "no NVIDIA GPU detected"
**Solution**: 
1. Verify drivers: `nvidia-smi`
2. Check Docker runtime: `docker info | grep nvidia`
3. Ensure Docker daemon config includes nvidia runtime

### Issue: Out of Memory (OOM) errors
**Solution**:
1. Use smaller models (e.g., gemma3:1b instead of larger variants)
2. Reduce batch size in model configuration
3. Monitor VRAM usage: `nvidia-smi -l 1`

## Performance Tips

1. **Model Selection**: Smaller models like `gemma3:1b` are GPU-efficient
2. **VRAM Management**: Keep ~20% VRAM free for overhead
3. **Multi-GPU**: Ollama supports multi-GPU setups automatically

## Alternative: CPU-only Mode

If you don't have a compatible GPU, TaskFlow will automatically fall back to CPU mode. No configuration changes needed.

```bash
# Use standard compose file without GPU
docker-compose up -d
```

## Resources

- [NVIDIA Container Toolkit Documentation](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)
- [Ollama GPU Support](https://github.com/ollama/ollama/blob/main/docs/gpu.md)
- [Docker GPU Support](https://docs.docker.com/config/containers/resource_constraints/#gpu)