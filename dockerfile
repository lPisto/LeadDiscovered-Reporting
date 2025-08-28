FROM node:20-slim

RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-venv \
    wget unzip curl gnupg \
    cron \
    && rm -rf /var/lib/apt/lists/*

RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-linux.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-linux.gpg] http://dl.google.com/linux/chrome/deb/ stable main" \
        > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update && apt-get install -y google-chrome-stable

RUN CHROME_VERSION=$(google-chrome --version | sed 's/Google Chrome //; s/ .*//') \
    && CHROMEDRIVER_VERSION=$(curl -s "https://googlechromelabs.github.io/chrome-for-testing/LATEST_RELEASE_$CHROME_VERSION") \
    && wget -q "https://storage.googleapis.com/chrome-for-testing-public/${CHROMEDRIVER_VERSION}/linux64/chromedriver-linux64.zip" \
    && unzip chromedriver-linux64.zip -d /usr/local/bin/ \
    && rm chromedriver-linux64.zip

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN chmod +x /app/entrypoint.sh

EXPOSE 3000

CMD ["/bin/bash", "/app/entrypoint.sh"]
