# --- ÉTAPE 1 : Build du Frontend React (Vite) ---
FROM node:20-slim AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- ÉTAPE 2 : Backend Python + uv ---
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1

WORKDIR /app

# Récupération de uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Installation des dépendances Python via uv
COPY agent-pharma/pyproject.toml agent-pharma/uv.lock ./
RUN uv pip install --system -r pyproject.toml

# Copie exacte selon ton arborescence (main.py à la racine de /app, app/ et corpus/ à côté)
COPY agent-pharma/main.py ./main.py
COPY agent-pharma/app ./app
COPY agent-pharma/corpus ./corpus
COPY --from=frontend-builder /frontend/dist ./frontend_dist

# Utilisateur non-root
RUN useradd --create-home appuser && chown -R appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health').status==200 else 1)"

# Lancement de main:app (puisque main.py est copié dans /app/main.py)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]