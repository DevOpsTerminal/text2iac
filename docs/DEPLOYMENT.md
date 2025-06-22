# Deployment Guide

## Prerequisites

- Docker 20.10+ and Docker Compose 1.29+
- Node.js 18+ and npm 9+ (for building)
- Access to a cloud provider (AWS/GCP/Azure)
- Domain name (optional but recommended)

## Production Deployment

### 1. Server Setup

#### Recommended Server Requirements
- 2+ CPU cores
- 4GB+ RAM
- 20GB+ disk space
- Ubuntu 22.04 LTS

#### Initial Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y git curl htop ufw

# Configure firewall
sudo ufw allow OpenSSH
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```

### 2. Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add current user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 3. Deploy Application

```bash
# Clone repository
git clone https://github.com/DevOpsTerminal/text2iac.git
cd text2iac

# Copy and configure environment variables
cp .env.example .env
nano .env  # Edit with your configuration

# Build and start containers
make build
make start
```

### 4. Configure Reverse Proxy (Nginx)

1. Install Nginx:
   ```bash
   sudo apt install -y nginx
   ```

2. Create Nginx configuration:
   ```bash
   sudo nano /etc/nginx/sites-available/text2iac
   ```

   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:8080;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }

       location /api {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

3. Enable the site:
   ```bash
   sudo ln -s /etc/nginx/sites-available/text2iac /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

### 5. Set Up SSL (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com

# Test automatic renewal
sudo certbot renew --dry-run
```

## Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `NODE_ENV` | No | Node environment | `production` |
| `PORT` | No | API server port | `3000` |
| `OPENAI_API_KEY` | Yes | OpenAI API key | |
| `JWT_SECRET` | Yes | JWT secret key | |
| `DATABASE_URL` | Yes | Database connection URL | |
| `REDIS_URL` | No | Redis connection URL | `redis://redis:6379` |

## Scaling

### Horizontal Scaling

1. **API Service**:
   ```yaml
   # docker-compose.yml
   api:
     image: text2iac/api:latest
     deploy:
       replicas: 3
       resources:
         limits:
           cpus: '0.5'
           memory: 1G
   ```

2. **Load Balancing**:
   - Use a load balancer (AWS ALB, Nginx, Traefik)
   - Configure sticky sessions if needed

### Database

For production, consider using managed database services:
- AWS RDS
- Google Cloud SQL
- Azure Database

## Monitoring

### Logging

```bash
# View logs
docker-compose logs -f

# Set up log rotation
sudo nano /etc/logrotate.d/docker
```

### Metrics

- **Prometheus** for metrics collection
- **Grafana** for visualization
- **Sentry** for error tracking

## Backup

1. **Database Backup**:
   ```bash
   # Create backup
   docker-compose exec -T db pg_dump -U postgres text2iac > backup.sql

   # Restore
   cat backup.sql | docker-compose exec -T db psql -U postgres text2iac
   ```

2. **Volume Backup**:
   ```bash
   # Create backup
tar -czf data_backup.tar.gz /var/lib/docker/volumes/text2iac_*
   ```

## Maintenance

### Updating

```bash
git pull
docker-compose build --no-cache
docker-compose up -d --force-recreate
```

### Health Checks

```bash
# Check container status
docker ps

# Check logs
docker-compose logs -f

# Check disk usage
df -h
```

## Troubleshooting

### Common Issues

1. **Port Conflicts**:
   - Check if ports 80, 443, 3000 are in use
   - Use `netstat -tuln | grep <port>` to check

2. **Docker Issues**:
   ```bash
   # Restart Docker
   sudo systemctl restart docker

   # Check container logs
   docker logs <container_id>
   ```

3. **Database Connection Issues**:
   - Verify database URL in `.env`
   - Check if database is running: `docker-compose ps db`

For additional help, please open an issue on our [GitHub repository](https://github.com/DevOpsTerminal/text2iac/issues).
