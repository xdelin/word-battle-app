# Next.js 前端：node 构建 -> node 运行
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_JAVA_API_URL=http://localhost:8080
ENV NEXT_PUBLIC_JAVA_API_URL=$NEXT_PUBLIC_JAVA_API_URL
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
RUN npm prune --omit=dev
EXPOSE 3000
CMD ["npm", "start"]
