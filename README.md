# Text2IaC Platform 🚀

> Generate production-ready infrastructure from plain English descriptions

[![Build Status](https://github.com/devopsterminal/text2iac-platform/workflows/CI/badge.svg)](https://github.com/devopsterminal/text2iac-platform/actions)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://hub.docker.com/r/devopsterminal/text2iac)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎯 What is Text2IaC?

Text2IaC transforms natural language descriptions into production-ready infrastructure code. Simply describe what you need in plain English, and get:

- **Terraform modules** for cloud infrastructure
- **Docker Compose** files for local development
- **Kubernetes manifests** for container orchestration
- **Monitoring setup** with Prometheus/Grafana
- **CI/CD pipelines** with GitHub Actions

## ✨ Key Features

- 📧 **Email Integration** - Send requests via email
- 🌐 **Web Interface** - User-friendly dashboard
- 🤖 **AI-Powered** - Uses Mistral 7B locally via Ollama
- 🔒 **Fully Local** - No external dependencies or data sharing
- ⚡ **Fast Setup** - Running in 5 minutes
- 🎨 **Template-Based** - Reusable, tested patterns

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- 8GB RAM (for LLM)
- 20GB disk space

### 1. Clone and Start
```bash
git clone https://github.com/devopsterminal/text2iac-platform.git
cd text2iac-platform

# Copy environment template
cp .env.example .env

# Start all services
make start
```

### 2. Wait for LLM Download (first time)
```bash
# Monitor Ollama logs
docker-compose logs -f ollama

# Should see: "Mistral 7B model loaded successfully"
```

### 3. Test via Email
```bash
# Send test email (if SMTP configured)
echo "Create a Node.js API with PostgreSQL database" | \
  mail -s "[TEXT2IAC] Test API" infrastructure@localhost
```

### 4. Test via Web Interface
```bash
# Open web interface
open http://localhost:8080

# Or manually navigate to http://localhost:8080
```

## 📖 Usage Examples

### Example 1: Simple Web API
```
Subject: [TEXT2IAC] User Management API

Create a Node.js REST API with:
- User authentication (JWT)
- PostgreSQL database
- Redis caching
- Auto-scaling setup
- Basic monitoring

Expected traffic: 1000 requests/hour
Environment: Production
```

**Generated Output:**
- ✅ Terraform AWS infrastructure
- ✅ Docker Compose for local dev
- ✅ Kubernetes manifests
- ✅ Monitoring dashboard
- ✅ CI/CD pipeline

### Example 2: E-commerce Platform
```
Build an e-commerce platform with:
- Product catalog (Elasticsearch)
- Shopping cart (Redis)
- Payment processing (Stripe integration)
- Order management (PostgreSQL)
- Admin dashboard
- Real-time analytics
```

**Generated Output:**
- ✅ Microservices architecture
- ✅ API Gateway setup
- ✅ Database migrations
- ✅ Load balancer configuration
- ✅ Security best practices

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Email       │────│   Text2IaC      │────│   Generated     │
│   Integration   │    │   API Server    │    │  Infrastructure │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Interface │────│   Mistral 7B    │────│   Templates     │
│   Dashboard     │    │   (via Ollama)  │    │   & Examples    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📡 Integration Options

### 1. Email Integration
Send infrastructure requests to `infrastructure@yourcompany.com`:

```
To: infrastructure@yourcompany.com
Subject: [TEXT2IAC] Project Name

Describe your infrastructure needs in plain English...
```

### 2. Web Interface
Access the web dashboard at `http://localhost:8080`:
- 📝 Text input form
- 🎯 Template gallery
- 📊 Status tracking
- 📋 Request history

### 3. API Endpoints
Direct API access for programmatic use:

```bash
# Generate infrastructure
curl -X POST http://localhost:3001/api/generate \
  -H "Content-Type: application/json" \
  -d '{"description": "Create a blog with comments", "environment": "production"}'

# Check status
curl http://localhost:3001/api/status/{request_id}
```

## 🛠️ Configuration

### Environment Variables
```bash
# Core Settings
OLLAMA_MODEL=mistral:7b
API_PORT=3001
WEB_PORT=8080

# Email Configuration (optional)
SMTP_HOST=mail.company.com
SMTP_USER=infrastructure@company.com
SMTP_PASS=your-password
IMAP_HOST=mail.company.com

# Database
DB_HOST=postgres
DB_NAME=text2iac
DB_USER=text2iac
DB_PASS=secure-password

# Security
JWT_SECRET=your-jwt-secret
API_KEY=your-api-key
```

### Email Setup (Optional)
If you want email integration, configure SMTP/IMAP:

1. **Gmail/Google Workspace:**
   ```bash
   SMTP_HOST=smtp.gmail.com
   IMAP_HOST=imap.gmail.com
   SMTP_USER=infrastructure@company.com
   SMTP_PASS=app-specific-password
   ```

2. **Microsoft Exchange:**
   ```bash
   SMTP_HOST=smtp.office365.com
   IMAP_HOST=outlook.office365.com
   ```

3. **Internal Mail Server:**
   ```bash
   SMTP_HOST=mail.company.internal
   IMAP_HOST=mail.company.internal
   ```

## 📊 Monitoring & Health Checks

### Service Status
```bash
# Check all services
make health-check

# Individual service health
curl http://localhost:3001/health    # API Server
curl http://localhost:8080/health    # Web Interface
curl http://localhost:11434/api/ps   # Ollama LLM
```

### Logs
```bash
# View all logs
docker-compose logs -f

# Specific service logs
docker-compose logs -f api
docker-compose logs -f email-bridge
docker-compose logs -f ollama
```

### Metrics
- 📈 **Request metrics**: `http://localhost:3001/metrics`
- 🔧 **System metrics**: `http://localhost:9090` (if Prometheus enabled)
- 📊 **Dashboards**: `http://localhost:3000` (if Grafana enabled)

## 🔧 Development

### Local Development
```bash
# Start in development mode
make dev

# Run tests
make test

# Code formatting
make format

# Type checking
make lint
```

### Adding New Templates
1. Create template in `templates/` directory
2. Add to template registry in `api/src/services/template.service.ts`
3. Test with example request
4. Update documentation

### Custom Prompts
Modify LLM prompts in `config/prompts/`:
- `system-prompt.txt` - Base instructions for LLM
- `terraform-prompt.txt` - Terraform-specific guidance
- `kubernetes-prompt.txt` - Kubernetes-specific guidance

## 🚢 Deployment

### Docker Compose (Recommended)
```bash
# Production deployment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# With monitoring stack
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

### Kubernetes
```bash
# Apply manifests
kubectl apply -f k8s/

# Check status
kubectl get pods -n text2iac
```

### Cloud Deployment
- **AWS**: Use ECS or EKS with provided configurations
- **Azure**: Use Container Instances or AKS
- **GCP**: Use Cloud Run or GKE

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for detailed guidelines.

## 📚 Documentation

- 📖 [Getting Started Guide](docs/GETTING_STARTED.md)
- 🏗️ [Architecture Overview](docs/ARCHITECTURE.md)
- 🔌 [API Reference](docs/API_REFERENCE.md)
- 🚀 [Deployment Guide](docs/DEPLOYMENT.md)
- 🎯 [Examples & Use Cases](examples/)

## 🐛 Troubleshooting

### Common Issues

**LLM not responding:**
```bash
# Check Ollama status
curl http://localhost:11434/api/ps

# Restart Ollama
docker-compose restart ollama
```

**Email not working:**
```bash
# Check email bridge logs
docker-compose logs email-bridge

# Test SMTP connection
telnet $SMTP_HOST 587
```

**Web interface not loading:**
```bash
# Check frontend logs
docker-compose logs frontend

# Verify API connection
curl http://localhost:3001/health
```

### Performance Tuning

**For better LLM performance:**
- Increase Docker memory limit to 12GB+
- Use GPU if available (NVIDIA Docker runtime)
- Consider faster models like CodeLlama 7B

**For high request volume:**
- Scale API service (`docker-compose up --scale api=3`)
- Add Redis caching
- Use load balancer (Nginx/HAProxy)

## 📈 Roadmap

### Version 1.0 (Current MVP)
- ✅ Email integration
- ✅ Web interface
- ✅ Basic templates (Terraform, Docker Compose)
- ✅ Local LLM (Mistral 7B)

### Version 1.1 (Next Release)
- 🔲 Slack/Teams integration
- 🔲 Template gallery
- 🔲 Request history
- 🔲 User authentication

### Version 2.0 (Future)
- 🔲 Backstage plugin
- 🔲 ArgoCD integration
- 🔲 Multi-cloud support
- 🔲 Advanced monitoring

## 📄 License

This project is licensed under the Apache License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Ollama](https://ollama.ai/) - Local LLM runtime
- [Mistral AI](https://mistral.ai/) - Language model
- [Terraform](https://terraform.io/) - Infrastructure as Code
- [Docker](https://docker.com/) - Containerization

## 📞 Support

- 📧 Email: support@company.com
- 💬 Slack: #text2iac-support
- 🐛 Issues: [GitHub Issues](https://github.com/devopsterminal/text2iac-platform/issues)
- 📖 Documentation: [Wiki](https://github.com/devopsterminal/text2iac-platform/wiki)

---

**Made with ❤️ by the Platform Engineering Team**