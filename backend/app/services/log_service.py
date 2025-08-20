import asyncio
import json
import os
import re
import subprocess
from datetime import datetime
from typing import AsyncGenerator, List

import structlog
from kubernetes import client, config
from kubernetes.client.rest import ApiException

logger = structlog.get_logger()


class LogStreamingService:
    def __init__(self):
        self.active_streams = set()
        # Detect environment - Kubernetes vs Docker Compose
        self.is_kubernetes = os.path.exists(
            "/var/run/secrets/kubernetes.io/serviceaccount"
        )
        self.ollama_container_name = "taskflow-ollama"  # For Docker Compose
        self.ollama_pod_selector = "app=ollama"  # For Kubernetes
        self.namespace = "taskflow"  # Kubernetes namespace

        # Initialize Kubernetes client if in cluster
        if self.is_kubernetes:
            try:
                config.load_incluster_config()
                self.k8s_client = client.CoreV1Api()
                logger.info("Kubernetes client initialized successfully")
            except Exception as e:
                logger.error("Failed to initialize Kubernetes client", error=str(e))
                self.k8s_client = None
        else:
            self.k8s_client = None

    async def stream_ollama_logs(self, websocket) -> AsyncGenerator[str, None]:
        """Stream Ollama container logs in real-time"""
        self.active_streams.add(websocket)

        try:
            if self.is_kubernetes:
                await self._stream_kubernetes_logs(websocket)
            else:
                await self._stream_docker_logs(websocket)

        except Exception as e:
            logger.error("Error streaming Ollama logs", error=str(e))
            error_entry = {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "level": "ERROR",
                "message": f"Log streaming error: {str(e)}",
                "source": "log_service",
            }

            if websocket in self.active_streams:
                try:
                    await websocket.send_text(json.dumps(error_entry))
                except:
                    pass

        finally:
            self.active_streams.discard(websocket)

    async def _stream_kubernetes_logs(self, websocket):
        """Stream logs using Kubernetes API"""
        try:
            if not self.k8s_client:
                error_entry = {
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "level": "ERROR",
                    "message": "Kubernetes client not available for log streaming",
                    "source": "log_service",
                }
                if websocket in self.active_streams:
                    await websocket.send_text(json.dumps(error_entry))
                return

            # Get Ollama pods
            pods = await self._get_ollama_pods()
            if not pods:
                error_entry = {
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "level": "WARN",
                    "message": "No Ollama pods found for log streaming",
                    "source": "log_service",
                }
                if websocket in self.active_streams:
                    await websocket.send_text(json.dumps(error_entry))
                return

            pod_name = pods[0]

            # Send initial logs
            recent_logs = await self._get_kubernetes_logs(50)
            for log_entry in recent_logs:
                if websocket in self.active_streams:
                    try:
                        await websocket.send_text(json.dumps(log_entry))
                    except Exception as e:
                        logger.error("Failed to send log to WebSocket", error=str(e))
                        break
                else:
                    break

            # Start periodic log polling (since real-time streaming is complex in K8s)
            info_msg = {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "level": "INFO",
                "message": f"Streaming logs from pod: {pod_name} (refreshing every 5 seconds)",
                "source": "log_service",
            }

            if websocket in self.active_streams:
                try:
                    await websocket.send_text(json.dumps(info_msg))
                except Exception as e:
                    logger.error("Failed to send info message", error=str(e))
                    return

            # Poll for new logs every 5 seconds
            last_log_count = len(recent_logs)
            while websocket in self.active_streams:
                await asyncio.sleep(5)

                if websocket not in self.active_streams:
                    break

                try:
                    # Get fresh logs
                    current_logs = await self._get_kubernetes_logs(100)

                    # Send only new logs if we have more than before
                    if len(current_logs) > last_log_count:
                        new_logs = current_logs[last_log_count:]
                        for log_entry in new_logs:
                            if websocket in self.active_streams:
                                try:
                                    await websocket.send_text(json.dumps(log_entry))
                                except Exception as e:
                                    logger.error(
                                        "Failed to send new log to WebSocket",
                                        error=str(e),
                                    )
                                    break
                            else:
                                break
                        last_log_count = len(current_logs)

                except Exception as e:
                    logger.error("Error during log polling", error=str(e))
                    break

        except Exception as e:
            logger.error("Kubernetes log streaming error", error=str(e))
            error_entry = {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "level": "ERROR",
                "message": f"Kubernetes log streaming error: {str(e)}",
                "source": "log_service",
            }

            if websocket in self.active_streams:
                try:
                    await websocket.send_text(json.dumps(error_entry))
                except:
                    pass

    async def _stream_docker_logs(self, websocket):
        """Stream logs using Docker API in Docker Compose environment"""
        try:
            import docker
            from docker.errors import DockerException

            # Use Docker Python API for streaming
            client = docker.from_env()
            container = client.containers.get(self.ollama_container_name)

            logger.info(
                "Started Docker Ollama log streaming",
                container=self.ollama_container_name,
            )

            # Stream logs from the container
            log_stream = container.logs(
                stream=True, follow=True, tail=50, stdout=True, stderr=True
            )

            for log_chunk in log_stream:
                if websocket not in self.active_streams:
                    break

                decoded_chunk = log_chunk.decode("utf-8").strip()
                if decoded_chunk:
                    # Split into lines in case multiple lines come in one chunk
                    for line in decoded_chunk.split("\n"):
                        if line.strip():
                            log_entry = {
                                "timestamp": datetime.utcnow().isoformat() + "Z",
                                "level": self._extract_log_level(line),
                                "message": line.strip(),
                                "source": "ollama",
                            }

                            # Send to WebSocket if still connected
                            if websocket in self.active_streams:
                                try:
                                    await websocket.send_text(json.dumps(log_entry))
                                except Exception as e:
                                    logger.error(
                                        "Failed to send log to WebSocket", error=str(e)
                                    )
                                    break
                            else:
                                break

            client.close()

        except DockerException as e:
            logger.error("Docker error streaming Ollama logs", error=str(e))
            error_entry = {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "level": "ERROR",
                "message": f"Docker log streaming error: {str(e)}",
                "source": "log_service",
            }

            if websocket in self.active_streams:
                try:
                    await websocket.send_text(json.dumps(error_entry))
                except:
                    pass

    def _extract_log_level(self, log_line: str) -> str:
        """Extract log level from log line"""
        log_line_upper = log_line.upper()

        if "ERROR" in log_line_upper or "ERRO" in log_line_upper:
            return "ERROR"
        elif "WARN" in log_line_upper:
            return "WARN"
        elif "INFO" in log_line_upper:
            return "INFO"
        elif "DEBUG" in log_line_upper or "DEBU" in log_line_upper:
            return "DEBUG"
        else:
            return "INFO"

    async def get_recent_logs(self, lines: int = 100) -> list:
        """Get recent logs from Ollama container"""
        try:
            if self.is_kubernetes:
                return await self._get_kubernetes_logs(lines)
            else:
                return await self._get_docker_logs(lines)

        except Exception as e:
            logger.error("Error fetching recent logs", error=str(e))
            return [
                {
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "level": "ERROR",
                    "message": f"Error fetching logs: {str(e)}",
                    "source": "log_service",
                }
            ]

    async def _get_kubernetes_logs(self, lines: int = 100) -> list:
        """Get recent logs using Kubernetes API"""
        try:
            if not self.k8s_client:
                return [
                    {
                        "timestamp": datetime.utcnow().isoformat() + "Z",
                        "level": "ERROR",
                        "message": "Kubernetes client not available",
                        "source": "log_service",
                    }
                ]

            # Get Ollama pods
            pods = await self._get_ollama_pods()
            if not pods:
                return [
                    {
                        "timestamp": datetime.utcnow().isoformat() + "Z",
                        "level": "WARN",
                        "message": "No Ollama pods found",
                        "source": "log_service",
                    }
                ]

            # Fetch logs from the first available pod
            pod_name = pods[0]
            loop = asyncio.get_event_loop()

            def _fetch_logs():
                try:
                    log_response = self.k8s_client.read_namespaced_pod_log(
                        name=pod_name,
                        namespace=self.namespace,
                        tail_lines=lines,
                        timestamps=True,
                    )
                    return log_response
                except ApiException as e:
                    logger.error("Kubernetes API error fetching logs", error=str(e))
                    return f"Error fetching logs: {e.reason}"
                except Exception as e:
                    logger.error("Unexpected error fetching logs", error=str(e))
                    return f"Unexpected error: {str(e)}"

            log_text = await loop.run_in_executor(None, _fetch_logs)

            if log_text.startswith("Error") or log_text.startswith("Unexpected"):
                return [
                    {
                        "timestamp": datetime.utcnow().isoformat() + "Z",
                        "level": "ERROR",
                        "message": log_text,
                        "source": "log_service",
                    }
                ]

            return self._parse_kubernetes_logs(log_text)

        except Exception as e:
            logger.error("Kubernetes error fetching recent logs", error=str(e))
            return [
                {
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "level": "ERROR",
                    "message": f"Error in Kubernetes log service: {str(e)}",
                    "source": "log_service",
                }
            ]

    async def _get_ollama_pods(self) -> List[str]:
        """Get list of Ollama pod names"""
        try:
            loop = asyncio.get_event_loop()

            def _list_pods():
                pod_list = self.k8s_client.list_namespaced_pod(
                    namespace=self.namespace, label_selector=self.ollama_pod_selector
                )
                return [
                    pod.metadata.name
                    for pod in pod_list.items
                    if pod.status.phase == "Running"
                ]

            return await loop.run_in_executor(None, _list_pods)
        except Exception as e:
            logger.error("Error listing Ollama pods", error=str(e))
            return []

    def _parse_kubernetes_logs(self, log_text: str) -> List[dict]:
        """Parse Kubernetes logs with timestamps into structured format"""
        logs = []

        for line in log_text.strip().split("\n"):
            if not line.strip():
                continue

            # Parse timestamp from Kubernetes log format
            timestamp_match = re.match(
                r"^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(.*)$", line
            )

            if timestamp_match:
                timestamp, message = timestamp_match.groups()
            else:
                timestamp = datetime.utcnow().isoformat() + "Z"
                message = line.strip()

            logs.append(
                {
                    "timestamp": timestamp,
                    "level": self._extract_log_level(message),
                    "message": message,
                    "source": "ollama",
                }
            )

        return logs

    async def _get_docker_logs(self, lines: int = 100) -> list:
        """Get recent logs using Docker API"""
        try:
            import docker
            from docker.errors import DockerException

            # Run Docker API call in thread pool to avoid blocking
            def _get_logs():
                client = docker.from_env()
                container = client.containers.get(self.ollama_container_name)
                log_bytes = container.logs(tail=lines, stdout=True, stderr=True)
                client.close()
                return log_bytes

            # Execute in thread pool
            loop = asyncio.get_event_loop()
            log_bytes = await loop.run_in_executor(None, _get_logs)
            log_text = log_bytes.decode("utf-8")

            logs = []
            for line in log_text.strip().split("\n"):
                if line.strip():
                    logs.append(
                        {
                            "timestamp": datetime.utcnow().isoformat() + "Z",
                            "level": self._extract_log_level(line),
                            "message": line.strip(),
                            "source": "ollama",
                        }
                    )

            return logs

        except DockerException as e:
            logger.error("Docker error fetching recent logs", error=str(e))
            return [
                {
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "level": "ERROR",
                    "message": f"Docker error fetching logs: {str(e)}",
                    "source": "log_service",
                }
            ]

    def disconnect_websocket(self, websocket):
        """Remove WebSocket from active streams"""
        self.active_streams.discard(websocket)


# Global instance
log_streaming_service = LogStreamingService()
