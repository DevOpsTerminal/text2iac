# Simple Web API Example

This example demonstrates how to deploy a simple web API using the Text2IaC templates. The example includes:

- A web API service deployed as a container
- A PostgreSQL database
- Load balancing and auto-scaling
- Monitoring and logging

## Prerequisites

- Terraform 1.0+
- AWS CLI configured with appropriate credentials
- Docker (for building container images)
- kubectl (if using Kubernetes)

## Directory Structure

```
./simple-web-api/
├── main.tf           # Main Terraform configuration
├── variables.tf      # Variable definitions
├── outputs.tf        # Output values
├── app/              # Application code
│   ├── app.py
│   ├── requirements.txt
│   └── Dockerfile
└── README.md         # This file
```

## Configuration

1. Create a `terraform.tfvars` file with your configuration:

```hcl
region               = "us-west-2"
environment         = "dev"
vpc_id              = "vpc-12345678"
public_subnet_ids   = ["subnet-12345678", "subnet-87654321"]
private_subnet_ids  = ["subnet-23456789", "subnet-98765432"]

# Database configuration
db_username         = "admin"
db_password         = "changeme123"  # In production, use a secret manager
db_name             = "myappdb"

# Web API configuration
container_image      = "123456789012.dkr.ecr.us-west-2.amazonaws.com/myapp:latest"
desired_count       = 2
```

2. Initialize Terraform:

```bash
terraform init
```

3. Review the execution plan:

```bash
terraform plan
```

4. Apply the configuration:

```bash
terraform apply
```

## Architecture

This example creates the following AWS resources:

- **VPC** (existing)
- **Subnets** (existing)
- **Application Load Balancer** - Distributes traffic to ECS tasks
- **ECS Cluster** - Runs the containerized application
- **RDS PostgreSQL** - Managed database service
- **Security Groups** - Network access control
- **CloudWatch Logs** - Centralized logging
- **Auto Scaling** - Automatically scales the service based on load

## Customization

You can customize the example by modifying the variables in `variables.tf` or by providing different values in `terraform.tfvars`.

## Clean Up

To destroy all resources created by this example:

```bash
terraform destroy
```

## Next Steps

- Configure CI/CD pipelines
- Set up monitoring and alerting
- Implement blue/green deployments
- Add a custom domain with TLS
