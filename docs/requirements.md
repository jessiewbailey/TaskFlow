# Technical Product Requirements – TaskFlow Request Processing Application (Internal Deployment)

## 1 Tech Stack

| Layer       | Technology                                            |
| ----------- | ----------------------------------------------------- |
| Frontend    | React 18 + TypeScript, Vite, TailwindCSS, React Query |
| Backend API | FastAPI 0.111, Python 3.12                            |
| AI Worker   | Python micro‑service calling Ollama model             |

| **gemma3:27b**    |                                                      |
| ----------------- | ---------------------------------------------------- |
| DB                | MySQL 8                                              |
| Container Runtime | Docker 26 (images run **non‑root**, UID 1000)        |
| Orchestration     | Kubernetes 1.30+ (`kustomize` / raw `kubectl apply`) |

---

## 2 High‑Level Architecture

```
Browser ──HTTPS──▶ Ingress (nginx)
                 │
                 ▼
            FastAPI Pods  ⇄  PostgreSQL 15+
                 │
 gRPC / HTTP     ▼
           AI Worker Pods (gemma3:27b via Ollama)
```

- Namespace `taskflow`.
- TLS ends at ingress; internal mTLS via Linkerd.
- No external OAuth—cluster is private; access via VPN + NetworkPolicies.

---

## 3 Database Schema (DDL excerpt)

```sql
CREATE TABLE taskflow_requests (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  text MEDIUMTEXT NOT NULL,
  requester VARCHAR(256),
  date_received DATE DEFAULT CURRENT_DATE,
  assigned_analyst_id BIGINT,
  status ENUM('NEW','IN_REVIEW','PENDING','CLOSED') DEFAULT 'NEW',
  due_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_analyst_status (assigned_analyst_id, status)
);

CREATE TABLE ai_outputs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  request_id BIGINT NOT NULL,
  version INT NOT NULL,
  summary TEXT,
  topic VARCHAR(128),
  sensitivity_score DECIMAL(3,2),
  redactions_json JSON,
  custom_instructions TEXT,
  model_name VARCHAR(64),
  tokens_used INT,
  duration_ms INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES taskflow_requests(id)
);

CREATE TABLE users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(128),
  email VARCHAR(256) UNIQUE,
  role ENUM('ANALYST','SUPERVISOR','ADMIN'),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4 API Contract (JSON over HTTPS)

| Endpoint                     | Verb        | Payload → Response                                                                 | Notes                                                                                                  |
| ---------------------------- | ----------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `/api/requests`              | `GET`       | query params `analyst?`, `status?`, `sort_by`, `order`, `page`, `page_size` → list | List / filter                                                                                          |
| `/api/requests`              | `POST`      | `{text: str, requester?: str, assigned_analyst_id?: int}` → `{id}`                 | **Creates** new request, status `NEW`; triggers standard AI pipeline asynchronously (returns `job_id`) |
| `/api/requests/{id}`         | `GET`       | → `{request, latest_ai_output}`                                                    | Detail fetch                                                                                           |
| `/api/requests/{id}/process` | `POST`      | `{instructions?: str}` → `202 Accepted {job_id}`                                   | Re‑process with custom instructions                                                                    |
| `/api/requests/{id}/status`  | `PATCH`     | `{status, assigned_analyst_id?}`                                                   | Update status/reassignment                                                                             |
| `/api/jobs/{job_id}`         | `GET` (SSE) | progress stream                                                                    | Long‑poll/stream job state                                                                             |
| `/healthz`                   | `GET`       | `200 OK`                                                                           | Liveness                                                                                               |
| `/metrics`                   | `GET`       | Prometheus exposition                                                              | Telemetry                                                                                              |

- **Auth**: none for MVP (internal VPN). Replace with header middleware later.

### Pydantic Output Models

*Unchanged from prior version.*

---

## 5 AI Processing Workflows

### Standard Pipeline (auto‑run on create)

1. `extract_basic_metadata`
2. `classify_topic`
3. `summarize_request`
4. `sensitivity_score` (uses step 2)
5. `suggest_redactions` (uses steps 1‑4)
6. Persist output (`version = 1`).

### Custom Pipeline

Same steps, prompt augmented with user `instructions`; increments `version`.

*Invocation Template*

```python
resp = ollama.chat(
    model='gemma3:27b',
    messages=[
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": step_prompt},
    ],
    format='json'
)
```

- Timeout 60 s/call, up to 2 retries.

---

## 6 Frontend Components

| File                     | Responsibility                                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `FiltersPanel.tsx`       | Analyst multi‑select, status chips, date range picker                                                                             |
| `RequestsTable.tsx`      | Server‑side sort & pagination (MUI DataGrid)                                                                                      |
| `RequestDrawer.tsx`      | Original text, AI Output, History tabs                                                                                            |
| `CustomInstructions.tsx` | Textarea + Run button (debounced POST)                                                                                            |
| `NewRequestModal.tsx`    | **Form** with textarea for request text, optional requester & analyst dropdown; POST `/api/requests`; shows toast w/ job progress |
| State                    | React Query (`staleTime = 30 000`)                                                                                                |

---

## 7 Container Images (non‑root)

| Image      | Base                        | Dockerfile Highlights                                                                                                                                   |
| ---------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `taskflow-api` | `python:3.12-slim`          | `RUN adduser --uid 1000 --disabled-password app && pip install -r requirements.txt`; `USER 1000`; `CMD uvicorn app.main:app --host 0.0.0.0 --port 8000` |
| `taskflow-ai`  | `python:3.12-slim` + Ollama | same non‑root pattern; `CMD python worker.py`                                                                                                           |
| `taskflow-web` | `nginx:alpine`              | `RUN adduser -D -u 1000 nginx`; `USER 1000`; static files in `/usr/share/nginx/html`                                                                    |

### Kubernetes Manifests (kustomize snippets)

`kustomization.yaml`

```yaml
resources:
  - api-deployment.yaml
  - ai-deployment.yaml
  - web-deployment.yaml
  - mysql-statefulset.yaml
```

`api-deployment.yaml` (excerpt)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: taskflow-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: taskflow-api
  template:
    metadata:
      labels:
        app: taskflow-api
    spec:
      securityContext:
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
      containers:
        - name: api
          image: registry.local/taskflow-api:latest
          ports:
            - containerPort: 8000
          envFrom:
            - secretRef:
                name: taskflow-env
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8000
            initialDelaySeconds: 5
            periodSeconds: 10
```

---

## 8 Observability

- **Logs**: JSON via FluentBit → ELK.
- **Metrics**: Prometheus (`api_latency_ms`, `ai_job_duration_ms`, `ollama_tokens_total`).
- **Tracing**: OpenTelemetry → Jaeger.

---

## 9 Performance Targets

| Metric                      | P95 Target             |
| --------------------------- | ---------------------- |
| List API latency            | ≤ 300 ms (@ 10 k rows) |
| Create‑&‑process end‑to‑end | ≤ 120 s                |
| AI job internal (worker)    | ≤ 90 s                 |
| Uptime                      | 99.9 % monthly         |

---

## 10 Security Controls

- Private subnet + VPN; cluster not internet‑reachable.
- Pods run as non‑root (UID 1000); SELinux & seccomp default‑deny.
- Secrets via `ProjectedVolume` (K8s Secrets).
- MySQL encrypted at rest; backups daily × 30 days.
- Audit logs stored 3 yrs in S3‑compatible immutable bucket.

---

> **Revision History**: Added UI & API support for creating a new TaskFlow request via modal → `POST /api/requests`, auto‑triggering standard AI pipeline.

