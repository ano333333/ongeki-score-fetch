FROM mcr.microsoft.com/playwright:v1.57.0

RUN apt-get update
RUN apt-get install -y curl
RUN curl -fsSL https://deb.nodesource.com/setup_22.x -o nodesource_setup.sh
RUN bash nodesource_setup.sh
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate
RUN mkdir /usr/src/app
WORKDIR /usr/src/app
COPY ./package.json ./
COPY ./pnpm-lock.yaml ./
RUN pnpm i --frozen-lockfile

COPY ./codes ./codes
COPY ./tsconfig.json ./
RUN pnpm run build

EXPOSE 8080

CMD ["node", "dist/index.js"]
