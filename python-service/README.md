# HiddenGemsAI Python Recommendation Service

Production-ready Flask / Gunicorn microservice executing semantic recommendations with `SentenceTransformer` (`all-MiniLM-L6-v2`).

---

## 1. Architecture & Network Security

- **Public Access Restriction**: The Python service is designed as an internal microservice. It is **NOT** publicly exposed to the internet.
- **Node → Python Communication**: Node/Express acts as the public application gateway and communicates with the Python service over an internal network using `PYTHON_SERVICE_URL`.
- **Default Interface Binding**: When run standalone, `recommendation.py` binds to loopback interface `127.0.0.1` (`PYTHON_HOST`), preventing direct internet exposure.
- **Production Gunicorn Binding**:
  ```bash
  gunicorn --bind 127.0.0.1:5000 --workers 1 recommendation:app
  ```

### Recommended Production Deployment Architectures

1. **Private Service (Render / Railway / Fly.io)**:
   - Deploy Python service as a **Private Service / Internal Service** accessible only within the provider's private network (e.g. `http://python-service.internal:5000`).
2. **Docker Compose / Container Network**:
   - Run Node and Python in a shared Docker network where only port 3000 (Node) is published to host/internet, and port 5000 (Python) remains internal.
3. **Single Host Reverse Proxy (Nginx / Express Gateway)**:
   - Run Python on localhost (`127.0.0.1:5000`) on the same server, allowing local traffic from Node (`http://127.0.0.1:5000`).

---

## 2. Request Security & Input Validation

1. **Request Body Size Limit**:
   - `MAX_CONTENT_LENGTH`: Enforces a hard maximum request payload size of **1 MB** (1,048,576 bytes).
   - Rejects oversized requests immediately with `413 Request Entity Too Large` before model processing.
2. **Payload Validation**:
   - Require valid JSON object body (`400 Bad Request` if invalid).
   - `experiences`: Must be an array, capped at max **100 items** (`MAX_EXPERIENCES`).
   - `user_vibes`: Must be an array, capped at max **50 items** (`MAX_USER_VIBES`).
3. **Safe Error Handling**:
   - All internal exceptions return JSON error responses (`{"success": false, "message": "..."}`).
   - Stack traces are **never** exposed to HTTP clients.
4. **Lightweight Health Check**:
   - `GET /health` returns microservice health status without triggering model inference.

---

## 3. Environment Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PYTHON_HOST` | `127.0.0.1` | Network interface to bind (loopback for security) |
| `PORT` | `5000` | Microservice port |
| `MAX_CONTENT_LENGTH` | `1048576` | Maximum HTTP request body size in bytes (1 MB) |
| `MAX_EXPERIENCES` | `100` | Maximum allowed experiences in single prediction request |
| `MAX_USER_VIBES` | `50` | Maximum allowed user vibes in single prediction request |

---

## 4. Running Unit Tests

```bash
python -m unittest python-service/test_recommendation.py
```


## 5. Production start

From this directory:

```bash
pip install -r requirements.txt
PORT=5000 PYTHON_HOST=127.0.0.1 gunicorn recommendation:app --bind 127.0.0.1:5000 --workers 1 --worker-class gthread --threads 4 --timeout 120
```

The repository also includes `Procfile` and `Dockerfile` for managed/container deployments. Keep one Gunicorn worker per instance because the SentenceTransformer model is loaded once per worker process.

When Node and Python run in Docker Compose, set `PYTHON_SERVICE_URL=http://python-service:5000` and do not publish port 5000 to the internet.
