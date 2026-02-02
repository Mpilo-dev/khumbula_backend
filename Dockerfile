FROM node:20-alpine


RUN apk add --no-cache tzdata \
    && cp /usr/share/zoneinfo/Africa/Johannesburg /etc/localtime \
    && echo "Africa/Johannesburg" > /etc/timezone

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV NODE_ENV=development
ENV PORT=8000

EXPOSE 8000

CMD ["npm", "start"]
