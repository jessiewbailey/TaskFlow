FROM ollama/ollama:0.11.4

# Run as root to make system changes
USER root

# Set up the existing ubuntu user (UID 1000) for ollama
RUN mkdir -p /home/ubuntu/.ollama && \
    chown -R 1000:1000 /home/ubuntu/.ollama && \
    chmod 755 /bin/ollama

# Switch to non-root user (existing ubuntu user with UID 1000)
USER 1000:1000

# Set environment variables
ENV HOME=/home/ubuntu
ENV OLLAMA_HOST=0.0.0.0
ENV OLLAMA_ORIGINS=*

# Set working directory
WORKDIR /home/ubuntu

# Expose port
EXPOSE 11434

# Use same entrypoint and cmd as base image
ENTRYPOINT ["/bin/ollama"]
CMD ["serve"]