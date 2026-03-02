FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && pip cache purge || true
COPY . .
ENV PYTHONUNBUFFERED=1
EXPOSE 8081
CMD ["sh", "-c", "gunicorn -w 2 -b 0.0.0.0:${PORT:-8081} --timeout 120 app:app"]
