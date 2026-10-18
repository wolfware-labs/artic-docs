FROM nginxinc/nginx-unprivileged:1.30.6-alpine@sha256:782bb89768cc87b7f95c18b95baa1af250e5d451f26794f59363540161147c01

LABEL org.opencontainers.image.source="https://github.com/wolfware-labs/artic-docs"

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html

EXPOSE 8080
