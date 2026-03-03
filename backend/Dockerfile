FROM python:3.12-slim

WORKDIR /app

# Install Python dependencies first (cache layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Create directories expected at runtime
RUN mkdir -p /backups /app/ansible/runner

EXPOSE 8000

# Default: run the FastAPI app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
