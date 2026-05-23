FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml ./
COPY app/ ./app/
COPY scripts/ ./scripts/
COPY run.py ./

RUN pip install --no-cache-dir -e .

EXPOSE 5001

CMD ["python", "run.py"]
