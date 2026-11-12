FROM node:20-alpine

WORKDIR /app/frontend

ARG VITE_API_BASE_URL=http://localhost:8080
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ARG VITE_GOOGLE_CLIENT_ID=
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ .
COPY shared/maps ../shared/maps
RUN npm run build

EXPOSE 5173

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
