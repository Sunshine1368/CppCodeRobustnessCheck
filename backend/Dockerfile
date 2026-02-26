FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制整个项目（包括 static 子目录）
COPY . .

EXPOSE 5000

CMD ["python", "app.py"]