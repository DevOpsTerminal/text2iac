# Data Pipeline Example

This example demonstrates how to set up a scalable data processing pipeline using AWS services. The pipeline includes:

- Data ingestion
- Processing with AWS Glue or EMR
- Storage in S3 data lake
- Querying with Athena
- Visualization with QuickSight
- Monitoring and alerting

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Data Sources                                │
│  ┌─────────────┐    ┌─────────────┐    ┌────────────────────┐   │
│  │  API        │    │  Database   │    │  S3 Bucket        │   │
│  │  Endpoints  │    │  Exports    │    │  (CSV, JSON, etc) │   │
│  └──────┬──────┘    └─────┬───────┘    └────────┬───────────┘   │
│         │                   │                      │               │
└─────────┼───────────────────┼──────────────────────┼───────────────┘
          │                   │                      │
          ▼                   ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         AWS Cloud                                  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Amazon Kinesis Data Streams / Firehose                     │  │
│  │  • Real-time data collection                                 │  │
│  │  • Buffering and batching                                    │  │
│  └───────────────┬───────────────────────────────────────────────┘  │
│                  │                                                  │
│                  ▼                                                  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Amazon S3 Raw Zone                                         │  │
│  │  • Landing zone for raw data                                 │  │
│  │  • Partitioned by source/date                                │  │
│  └───────────────┬───────────────────────────────────────────────┘  │
│                  │                                                  │
│                  ▼                                                  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  AWS Glue / EMR                                             │  │
│  │  • Data transformation                                      │  │
│  │  • ETL processing                                           │  │
│  └───────────────┬───────────────────────────────────────────────┘  │
│                  │                                                  │
│                  ▼                                                  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Amazon S3 Processed Zone                                   │  │
│  │  • Processed and curated data                               │  │
│  │  • Partitioned for analytics                                │  │
│  └───────────────┬───────────────────────────────────────────────┘  │
│                  │                                                  │
│                  ▼                                                  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Amazon Athena                                              │  │
│  │  • Serverless query service                                 │  │
│  │  • SQL interface to S3 data                                 │  │
│  └───────────────┬───────────────────────────────────────────────┘  │
│                  │                                                  │
│                  ▼                                                  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Amazon QuickSight / Business Intelligence Tools             │  │
│  │  • Data visualization                                       │  │
│  │  • Dashboarding                                             │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  AWS CloudWatch                                             │  │
│  │  • Monitoring and logging                                   │  │
│  │  • Alerts and notifications                                 │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────────┘
```


## Components

### 1. Data Ingestion Layer
- **Kinesis Data Streams**: Real-time data ingestion
- **Kinesis Firehose**: Batch data loading to S3
- **API Gateway**: For REST API data sources
- **Database Migration Service (DMS)**: For database replication

### 2. Storage Layer
- **S3 Buckets**:
  - Raw zone: Untouched, raw data
  - Processed zone: Cleaned and transformed data
  - Curated zone: Business-ready datasets
- **Partitioning**: By date, source, and other relevant dimensions
- **Data Formats**: Parquet for analytics, JSON for semi-structured data

### 3. Processing Layer
- **AWS Glue**: Serverless ETL
  - Crawlers for schema discovery
  - ETL jobs using PySpark
  - Data catalog for metadata management
- **EMR**: For complex processing
  - Spark for large-scale processing
  - Hive for data warehousing
  - Presto for interactive queries

### 4. Query & Analysis
- **Athena**: Serverless query service
  - Standard SQL interface
  - Pay-per-query pricing
  - Integration with QuickSight
- **Redshift Spectrum**: For querying S3 directly

### 5. Visualization
- **QuickSight**: Business intelligence
  - Interactive dashboards
  - Machine learning insights
  - Embedded analytics

## Deployment Steps

1. **Prerequisites**
   - AWS Account with admin permissions
   - AWS CLI configured
   - Terraform 1.0+
   - Python 3.8+ with boto3

2. **Clone the Repository**
   ```bash
   git clone https://github.com/your-org/text2iac.git
   cd text2iac/examples/data-pipeline
   ```

3. **Configure Variables**
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

## Configuration

### Terraform Variables

```hcl
# Global
region          = "us-west-2"
environment     = "prod"
project        = "data-pipeline"

# S3 Buckets
raw_bucket_name    = "${var.project}-raw-${var.environment}"
processed_bucket_name = "${var.project}-processed-${var.environment}
curated_bucket_name = "${var.project}-curated-${var.environment}"

# Kinesis
shard_count = 2
retention_period = 24  # hours

# Glue
worker_type    = "G.1X"
number_of_workers = 5

data_catalog_database_name = "${var.project}_${var.environment}_catalog"

# Athena
athena_database_name = "${var.project}_${var.environment}_athena"
athena_workgroup_name = "${var.project}-${var.environment}-workgroup"

# Monitoring
enable_cloudwatch_alarms = true
alarm_email_address = "alerts@example.com"
```

## Data Flow

1. **Ingestion**
   - Data arrives via Kinesis, API Gateway, or S3 uploads
   - Raw data is stored in the S3 raw zone
   - Metadata is cataloged in Glue Data Catalog

2. **Processing**
   - Glue ETL jobs process the raw data
   - Data is cleaned, validated, and transformed
   - Processed data is stored in the processed zone

3. **Transformation**
   - Additional business logic is applied
   - Data is aggregated and enriched
   - Final datasets are stored in the curated zone

4. **Analysis**
   - Analysts query the data using Athena
   - Dashboards are built in QuickSight
   - Reports are generated and distributed

## Monitoring and Alerting

- **CloudWatch Alarms** for:
  - Data freshness
  - Processing errors
  - Resource utilization
  - Cost thresholds

- **CloudTrail** for API auditing
- **AWS Config** for compliance monitoring

## Security

- **Encryption**:
  - Data at rest with AWS KMS
  - Data in transit with TLS
- **Access Control**:
  - IAM roles with least privilege
  - S3 bucket policies
  - VPC endpoints for private access
- **Compliance**:
  - Data classification
  - Audit logging
  - Data retention policies

## Scaling

- **Kinesis**: Add shards for higher throughput
- **Glue**: Auto-scaling workers
- **S3**: Virtually unlimited storage
- **Athena**: Automatic query scaling

## Cost Optimization

- **S3 Storage Classes**:
  - Standard for frequently accessed data
  - Intelligent-Tiering for changing access patterns
  - Glacier for archival
- **Glue**: Pay per DPU hour consumed
- **Athena**: Pay per query
- **Lifecycle Policies**: Automate data lifecycle

## Clean Up

To destroy all resources:

```bash
terraform destroy
```

## Troubleshooting

### Common Issues

1. **Permission Errors**
   - Verify IAM roles and policies
   - Check S3 bucket policies
   - Ensure KMS key permissions are correct

2. **Glue Job Failures**
   - Check CloudWatch logs
   - Verify input/output formats
   - Check for data quality issues

3. **Performance Issues**
   - Check partition structure
   - Optimize file sizes (aim for 128MB-1GB)
   - Use columnar formats like Parquet

## Support

For issues and feature requests, please open an issue in the GitHub repository.
