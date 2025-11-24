# Use a lightweight Nginx image
FROM nginx:alpine

# Copy the static website files to the Nginx document root
COPY public /usr/share/nginx/html

# Expose port 80
EXPOSE 80
