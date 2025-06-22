# Getting Started

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ and npm 9+
- Python 3.9+
- Git

## Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/DevOpsTerminal/text2iac.git
   cd text2iac
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Install dependencies**
   ```bash
   make install
   ```

4. **Start development services**
   ```bash
   make dev
   ```

5. **Access the application**
   - Web UI: http://localhost:3001
   - API: http://localhost:3000
   - API Docs: http://localhost:3000/api-docs

## Project Structure

```
text2iac/
├── api/               # Backend API service
├── email-bridge/      # Email processing service
├── frontend/          # Web interface
├── templates/         # IaC templates
└── docs/              # Documentation
```

## Development Workflow

1. Create a new branch for your feature/fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit them:
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

3. Run tests and linters:
   ```bash
   make test
   make lint
   ```

4. Push your changes and create a pull request

## Available Scripts

- `make install` - Install all dependencies
- `make dev` - Start development servers
- `make test` - Run tests
- `make lint` - Run linters
- `make format` - Format code
- `make clean` - Clean up temporary files

## Need Help?

- Check the [documentation](docs/)
- Open an issue on GitHub
- Join our community chat
