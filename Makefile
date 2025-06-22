.PHONY: help install test lint format clean build start stop restart logs

# Help target
help:
	@echo "Available commands:"
	@echo "  make install      Install all dependencies"
	@echo "  make dev          Start development environment"
	@echo "  make build        Build all services"
	@echo "  make start        Start all services"
	@echo "  make stop         Stop all services"
	@echo "  make restart      Restart all services"
	@echo "  make logs         Show logs"
	@echo "  make test         Run tests"
	@echo "  make lint         Run linters"
	@echo "  make format       Format code"
	@echo "  make clean        Clean up"

# Install dependencies
install:
	@echo "Installing dependencies..."
	cd api && npm install
	cd frontend && npm install
	cd email-bridge && pip install -r requirements.txt

# Development
up:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

dev: up

# Build
build:
	docker-compose build

# Start/Stop/Restart
start:
	docker-compose up -d

stop:
	docker-compose down

restart: stop start

# Logs
logs:
	docker-compose logs -f

# Testing
test:
	cd api && npm test
	cd frontend && npm test

# Linting
lint:
	cd api && npm run lint
	cd frontend && npm run lint

# Formatting
format:
	cd api && npm run format
	cd frontend && npm run format

# Cleanup
clean:
	docker-compose down -v
	find . -name "node_modules" -type d -prune -exec rm -rf '{}' +
	find . -name "dist" -type d -prune -exec rm -rf '{}' +
	find . -name "build" -type d -prune -exec rm -rf '{}' +
	find . -name "coverage" -type d -prune -exec rm -rf '{}' +




# Build and push git changes
push:
	./scripts/build.sh
	git add .
	git commit -m "[auto] Update at $(date '+%Y-%m-%d %H:%M:%S')"
	git push

# Publish to Docker registry
publish:
	docker-compose build
	docker-compose push


