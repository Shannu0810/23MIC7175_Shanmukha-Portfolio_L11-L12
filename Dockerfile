# Production Frontend Nginx Container
FROM nginx:alpine

# Remove default configuration
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy custom reverse-proxy and security configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy web assets
COPY index.html /usr/share/nginx/html/
COPY login.html /usr/share/nginx/html/
COPY css /usr/share/nginx/html/css
COPY js /usr/share/nginx/html/js
RUN mkdir -p /usr/share/nginx/html/assets

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
