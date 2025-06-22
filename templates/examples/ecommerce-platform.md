# E-commerce Platform Example

This example demonstrates how to deploy a complete e-commerce platform using Text2IaC templates. The architecture includes:

- Frontend web application
- Backend API services
- Product catalog service
- Shopping cart service
- Order processing service
- Payment processing integration
- Redis cache
- PostgreSQL database
- Search service (Elasticsearch)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                            AWS Cloud                                │
│                                                                   │
│  ┌─────────────┐    ┌─────────────┐    ┌────────────────────┐   │
│  │  CloudFront │    │  Route 53   │    │  Certificate       │   │
│  │  (CDN)     │◄───►│  (DNS)      │◄───┤  Manager (SSL/TLS) │   │
│  └─────────────┘    └─────────────┘    └────────────────────┘   │
│           │                                                      │
│           ▼                                                      │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │                     VPC                                  │     │
│  │  ┌─────────────┐     ┌─────────────┐    ┌───────────┐  │     │
│  │  │  Public     │     │  Application │    │  Private  │  │     │
│  │  │  Subnets    │     │  Load        │    │  Subnets  │  │     │
│  │  │             │     │  Balancer    │    │           │  │     │
│  │  └──────┬──────┘     └──────┬──────┘    └─────┬─────┘  │     │
│  │         │                    │                  │        │     │
│  │         ▼                    ▼                  ▼        │     │
│  │  ┌─────────────┐    ┌───────────────────────────────────┐  │     │
│  │  │  NAT        │    │  ECS Cluster                     │  │     │
│  │  │  Gateway    │    │  ┌─────────────┐  ┌───────────┐  │  │     │
│  │  └────────────┘    │  │  Frontend    │  │  Backend  │  │  │     │
│  │                    │  │  Service     │  │  Service  │  │  │     │
│  │                    │  └──────┬──────┘  └─────┬─────┘  │  │     │
│  │                    │         │                │        │  │     │
│  │  ┌─────────────┐    │  ┌──────▼──────┐  ┌────┴─────┐  │  │     │
│  │  │  Internet   │    │  │  Product    │  │  Cart    │  │  │     │
│  │  │  Gateway    │    │  │  Catalog    │  │  Service │  │  │     │
│  │  └────────────┘    │  └──────┬──────┘  └────┬─────┘  │  │     │
│  │                    │         │               │        │  │     │
│  │                    │  ┌──────▼──────────────▼───────┐  │  │     │
│  │                    │  │  Redis Cache                │  │  │     │
│  │                    │  └───────────────┬────────────┘  │  │     │
│  │                    │                  │               │  │     │
│  │                    │  ┌───────────────▼────────────┐  │  │     │
│  │                    │  │  RDS PostgreSQL            │  │  │     │
│  │                    │  └───────────────┬────────────┘  │  │     │
│  │                    │                  │               │  │     │
│  │                    │  ┌───────────────▼────────────┐  │  │     │
│  │                    │  │  OpenSearch (Elasticsearch) │  │  │     │
│  │                    │  └────────────────────────────┘  │  │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  CloudWatch (Logs, Metrics, Alarms)                         │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Frontend
- **Technology**: React.js
- **Deployment**: S3 + CloudFront
- **Features**:
  - Product listing
  - Shopping cart
  - User authentication
  - Checkout process
  - Order tracking

### 2. Backend Services (ECS Fargate)
- **API Gateway**: Request routing and authentication
- **Product Service**: Product catalog and search
- **Cart Service**: Shopping cart management
- **Order Service**: Order processing
- **User Service**: User management and authentication
- **Payment Service**: Payment processing integration

### 3. Data Layer
- **RDS PostgreSQL**: Primary data store
- **Elasticsearch**: Product search and filtering
- **Redis**: Session management and caching

### 4. Infrastructure
- **VPC**: Network isolation
- **ALB**: Load balancing
- **ECS Fargate**: Container orchestration
- **RDS**: Managed PostgreSQL
- **ElastiCache**: Redis for caching
- **OpenSearch**: Product search
- **S3**: Static assets and media storage
- **CloudFront**: CDN for static content

## Deployment Steps

1. **Prerequisites**
   - AWS Account with appropriate permissions
   - Terraform 1.0+
   - AWS CLI configured
   - Docker
   - Node.js and npm

2. **Clone the Repository**
   ```bash
   git clone https://github.com/your-org/text2iac.git
   cd text2iac/examples/ecommerce-platform
   ```

3. **Configure Variables**
   Copy and edit the example configuration:
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   # Edit the file with your values
   ```

4. **Initialize Terraform**
   ```bash
   terraform init
   ```

5. **Review the Plan**
   ```bash
   terraform plan
   ```

6. **Deploy the Infrastructure**
   ```bash
   terraform apply
   ```

7. **Deploy the Application**
   ```bash
   ./deploy.sh
   ```

## Configuration

### Terraform Variables

```hcl
# Global
region          = "us-west-2"
environment     = "prod"
project        = "ecommerce"

# Network
vpc_cidr        = "10.0.0.0/16"
availability_zones = ["us-west-2a", "us-west-2b", "us-west-2c"]

# ECS
container_cpu    = 256
container_memory = 512
min_capacity    = 2
max_capacity    = 10

# RDS
db_instance_class = "db.t3.medium"
db_allocated_storage = 100
db_multi_az = true

# Redis
redis_node_type = "cache.t3.micro"
redis_num_cache_nodes = 2

# OpenSearch
opensearch_instance_type = "t3.small.search"
opensearch_instance_count = 2
```

## Monitoring and Logging

- **CloudWatch Logs**: Centralized logging for all services
- **CloudWatch Metrics**: Performance monitoring
- **CloudWatch Alarms**: Automated alerting
- **X-Ray**: Distributed tracing

## Security

- IAM roles with least privilege
- Security groups for network isolation
- Secrets management with AWS Secrets Manager
- Encryption at rest and in transit
- WAF for web application firewall

## Scaling

- Auto Scaling for ECS services
- Read replicas for RDS
- Redis cluster scaling
- OpenSearch domain auto-tuning

## Cost Optimization

- Reserved instances for RDS and OpenSearch
- Spot instances for non-critical workloads
- Auto-scaling based on demand
- S3 lifecycle policies for cost-effective storage

## Clean Up

To destroy all resources:

```bash
terraform destroy
```

## Support

For issues and feature requests, please open an issue in the GitHub repository.
