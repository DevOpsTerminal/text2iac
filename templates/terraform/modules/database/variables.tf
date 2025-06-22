# Required Variables
variable "name_prefix" {
  description = "A prefix used for naming resources"
  type        = string
}

variable "vpc_id" {
  description = "The VPC ID where the database will be created"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for the database"
  type        = list(string)
}

variable "allowed_security_group_ids" {
  description = "List of security group IDs allowed to access the database"
  type        = list(string)
  default     = []
}

variable "allowed_cidr_blocks" {
  description = "List of CIDR blocks allowed to access the database"
  type        = list(string)
  default     = []
}

# Database Configuration
variable "identifier" {
  description = "The name of the RDS instance"
  type        = string
  default     = ""
}

variable "engine" {
  description = "The database engine to use"
  type        = string
  default     = "postgres"
}

variable "engine_version" {
  description = "The engine version to use"
  type        = string
  default     = ""
}

variable "instance_class" {
  description = "The instance type of the RDS instance"
  type        = string
  default     = "db.t3.micro"
}

variable "allocated_storage" {
  description = "The allocated storage in GB"
  type        = number
  default     = 20
}

variable "max_allocated_storage" {
  description = "The maximum allocated storage in GB for autoscaling"
  type        = number
  default     = 100
}

variable "storage_type" {
  description = "The type of storage to use"
  type        = string
  default     = "gp2"
}

variable "storage_encrypted" {
  description = "Whether to encrypt the storage"
  type        = bool
  default     = true
}

variable "kms_key_id" {
  description = "The ARN of the KMS key to use for encryption"
  type        = string
  default     = ""
}

variable "db_name" {
  description = "The name of the database to create"
  type        = string
  default     = ""
}

variable "username" {
  description = "The master username for the database"
  type        = string
  default     = "admin"
}

variable "password" {
  description = "The master password for the database"
  type        = string
  sensitive   = true
  default     = ""
}

variable "port" {
  description = "The port on which the database accepts connections"
  type        = number
  default     = 5432
}

variable "parameter_group_family" {
  description = "The family of the DB parameter group"
  type        = string
  default     = ""
}

variable "parameters" {
  description = "A list of DB parameters to apply"
  type = list(object({
    name         = string
    value        = string
    apply_method = string
  }))
  default = []
}

# Network Configuration
variable "availability_zone" {
  description = "The AZ for the RDS instance"
  type        = string
  default     = ""
}

variable "multi_az" {
  description = "Whether to deploy in multiple AZs"
  type        = bool
  default     = false
}

variable "publicly_accessible" {
  description = "Whether the database is publicly accessible"
  type        = bool
  default     = false
}

# Backup & Maintenance
variable "backup_retention_period" {
  description = "The number of days to retain backups"
  type        = number
  default     = 7
}

variable "backup_window" {
  description = "The daily time range during which automated backups are created"
  type        = string
  default     = "03:00-06:00"
}

variable "maintenance_window" {
  description = "The weekly time range during which system maintenance can occur"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

# Deletion Protection
variable "skip_final_snapshot" {
  description = "Whether to skip creating a final snapshot when destroying the DB"
  type        = bool
  default     = false
}

variable "deletion_protection" {
  description = "Whether to enable deletion protection"
  type        = bool
  default     = true
}

# Upgrades
variable "allow_major_version_upgrade" {
  description = "Whether to allow major version upgrades"
  type        = bool
  default     = false
}

auto_minor_version_upgrade = var.auto_minor_version_upgrade
  maintenance_window          = var.maintenance_window
  
  tags = merge(var.tags, {
    Name = var.identifier
  })
  
  lifecycle {
    ignore_changes = [
      password,
      final_snapshot_identifier,
    ]
  }
}

# Enhanced Monitoring IAM Role
resource "aws_iam_role" "rds_enhanced_monitoring" {
  count = var.monitoring_interval > 0 ? 1 : 0
  
  name               = "${var.name_prefix}-rds-enhanced-monitoring-role"
  assume_role_policy = data.aws_iam_policy_document.rds_enhanced_monitoring_assume_role[0].json
  
  tags = var.tags
}

data "aws_iam_policy_document" "rds_enhanced_monitoring_assume_role" {
  count = var.monitoring_interval > 0 ? 1 : 0
  
  statement {
    actions = ["sts:AssumeRole"]
    
    principals {
      type        = "Service"
      identifiers = ["monitoring.rds.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy_attachment" "rds_enhanced_monitoring" {
  count = var.monitoring_interval > 0 ? 1 : 0
  
  role       = aws_iam_role.rds_enhanced_monitoring[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "cpu_utilization" {
  alarm_name          = "${var.name_prefix}-rds-cpu-utilization"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.cpu_utilization_threshold
  alarm_description   = "This metric monitors RDS CPU utilization"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.ok_actions

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.database.id
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "free_storage_space" {
  alarm_name          = "${var.name_prefix}-rds-free-storage"
  comparison_operator = "LessThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.free_storage_space_threshold
  alarm_description   = "This metric monitors RDS free storage space"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.ok_actions

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.database.id
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "database_connections" {
  alarm_name          = "${var.name_prefix}-rds-connections"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.database_connections_threshold
  alarm_description   = "This metric monitors RDS database connections"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.ok_actions

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.database.id
  }

  tags = var.tags
}

# RDS Proxy (if enabled)
resource "aws_db_proxy" "database" {
  count                  = var.enable_proxy ? 1 : 0
  name                   = "${var.name_prefix}-proxy"
  debug_logging         = var.proxy_debug_logging
  engine_family         = var.engine_family
  idle_client_timeout   = var.proxy_idle_client_timeout
  require_tls           = var.proxy_require_tls
  role_arn              = aws_iam_role.rds_proxy[0].arn
  vpc_security_group_ids = concat([aws_security_group.database.id], var.additional_security_group_ids)
  vpc_subnet_ids        = var.subnet_ids

  auth {
    auth_scheme = "SECRETS"
    description = "RDS Proxy auth"
    iam_auth    = var.proxy_iam_auth_enabled ? "REQUIRED" : "DISABLED"
    secret_arn  = aws_secretsmanager_secret.database_credentials[0].arn
  }

  tags = var.tags
}

resource "aws_db_proxy_default_target_group" "database" {
  count              = var.enable_proxy ? 1 : 0
  db_proxy_name      = aws_db_proxy.database[0].name
  connection_pool_config {
    connection_borrow_timeout   = var.proxy_connection_borrow_timeout
    init_query                  = var.proxy_init_query
    max_connections_percent     = var.proxy_max_connections_percent
    max_idle_connections_percent = var.proxy_max_idle_connections_percent
  }
}

resource "aws_db_proxy_target" "database" {
  count                 = var.enable_proxy ? 1 : 0
  db_instance_identifier = aws_db_instance.database.id
  db_proxy_name         = aws_db_proxy.database[0].name
  target_group_name     = aws_db_proxy_default_target_group.database[0].name
}

# IAM Role for RDS Proxy
resource "aws_iam_role" "rds_proxy" {
  count = var.enable_proxy ? 1 : 0
  
  name               = "${var.name_prefix}-rds-proxy-role"
  assume_role_policy = data.aws_iam_policy_document.rds_proxy_assume_role[0].json
  
  tags = var.tags
}

data "aws_iam_policy_document" "rds_proxy_assume_role" {
  count = var.enable_proxy ? 1 : 0
  
  statement {
    actions = ["sts:AssumeRole"]
    
    principals {
      type        = "Service"
      identifiers = ["rds.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy_attachment" "rds_proxy_secrets" {
  count      = var.enable_proxy ? 1 : 0
  role       = aws_iam_role.rds_proxy[0].name
  policy_arn = aws_iam_policy.rds_proxy_secrets[0].arn
}

resource "aws_iam_policy" "rds_proxy_secrets" {
  count = var.enable_proxy ? 1 : 0
  
  name        = "${var.name_prefix}-rds-proxy-secrets-policy"
  description = "Policy for RDS Proxy to access secrets"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
          "secretsmanager:ListSecretVersionIds",
          "secretsmanager:ListSecrets"
        ]
        Resource = [aws_secretsmanager_secret.database_credentials[0].arn]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = [var.kms_key_id]
      }
    ]
  })
}

# Secrets Manager for database credentials
resource "aws_secretsmanager_secret" "database_credentials" {
  count = var.enable_proxy || var.store_credentials_in_secrets_manager ? 1 : 0
  
  name        = "${var.name_prefix}-db-credentials"
  description = "Database credentials for ${var.identifier}"
  
  kms_key_id = var.kms_key_id
  
  recovery_window_in_days = var.secret_recovery_window_in_days
  
  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "database_credentials" {
  count = var.enable_proxy || var.store_credentials_in_secrets_manager ? 1 : 0
  
  secret_id = aws_secretsmanager_secret.database_credentials[0].id
  
  secret_string = jsonencode({
    username = var.username
    password = var.password
    engine   = var.engine
    host     = aws_db_instance.database.address
    port     = var.port
    dbname   = var.db_name
    dbInstanceIdentifier = aws_db_instance.database.id
  })
  
  lifecycle {
    ignore_changes = [secret_string]
  }
}

# CloudWatch Log Group for RDS logs
resource "aws_cloudwatch_log_group" "rds_logs" {
  for_each = toset(var.enabled_cloudwatch_logs_exports)
  
  name              = "/aws/rds/instance/${var.identifier}/${each.value}"
  retention_in_days = var.cloudwatch_logs_retention_days
  kms_key_id        = var.cloudwatch_logs_kms_key_id
  
  tags = var.tags
}

# RDS Event Subscription (if enabled)
resource "aws_db_event_subscription" "database" {
  count     = var.enable_event_subscription ? 1 : 0
  name      = "${var.name_prefix}-events"
  sns_topic = var.event_subscription_sns_topic_arn
  
  event_categories = var.event_subscription_event_categories
  source_type      = "db-instance"
  source_ids       = [aws_db_instance.database.id]
  
  tags = var.tags
}
