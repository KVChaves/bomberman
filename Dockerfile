# Servidor do CTI Bombers (WebSocket + jogo). Sem dependências além do Python.
FROM python:3.12-slim
WORKDIR /app
COPY server ./server
COPY public ./public
ENV PYTHONUNBUFFERED=1
# A hospedagem define a variável PORT; sem ela o servidor usa 8000.
EXPOSE 8000
CMD ["python", "server/server.py"]
