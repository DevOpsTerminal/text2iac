# Database Module - Main Configuration

# Create a security group for the database
resource "aws_security_group" "database" {
  name        = "${var.name_prefix}-db-sg"
  description = "Security group for ${var.name_prefix} database"
  vpc_id      = var.vpc_id

  # Allow inbound traffic from the specified security groups or CIDR blocks
  dynamic "ingress" {
    for_each = var.allowed_security_group_ids != [] ? [1] : []
    content {
      from_port       = var.port
      to_port         = var.port
      protocol        = "tcp"
      security_groups = var.allowed_security_group_ids
      description     = "Allow inbound from security groups"
    }
  }


  dynamic "ingress" {
    for_each = var.allowed_cidr_blocks != [] ? [1] : []
    content {
      from_port   = var.port
      to_port     = var.port
      protocol    = "tcp"
      cidr_blocks = var.allowed_cidr_blocks
      description = "Allow inbound from CIDR blocks"
    }
  }

  # Allow all outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-db-sg"
  })
}

# Create a DB subnet group
resource "aws_db_subnet_group" "database" {
  name        = "${var.name_prefix}-db-subnet-group"
  description = "Database subnet group for ${var.name_prefix}"
  subnet_ids  = var.subnet_ids

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-db-subnet-group"
  })
}

# Create a DB parameter group
resource "aws_db_parameter_group" "database" {
  name        = "${var.name_prefix}-db-param-group"
  family      = var.parameter_group_family
  description = "Database parameter group for ${var.name_prefix}"

  dynamic "parameter" {
    for_each = var.parameters
    content {
      name         = parameter.value.name
      value        = parameter.value.value
      apply_method = lookup(parameter.value, "apply_method", "immediate")
    }
  }

  tags = var.tags
}

# Create the RDS instance
resource "aws_db_instance" "database" {
  identifier             = var.identifier
  engine                 = var.engine
  engine_version         = var.engine_version
  instance_class         = var.instance_class
  allocated_storage      = var.allocated_storage
  max_allocated_storage  = var.max_allocated_storage
  storage_type           = var.storage_type
  storage_encrypted      = var.storage_encrypted
  kms_key_id             = var.kms_key_id
  
  db_name               = var.db_name
  username              = var.username
  password              = var.password
  port                  = var.port
  
  vpc_security_group_ids = concat([aws_security_group.database.id], var.additional_security_group_ids)
  db_subnet_group_name   = aws_db_subnet_group.database.name
  parameter_group_name    = aws_db_parameter_group.database.name
  
  availability_zone      = var.availability_zone
  multi_az               = var.multi_az
  
  backup_retention_period = var.backup_retention_period
  backup_window           = var.backup_window
  maintenance_window      = var.maintenance_window
  
  skip_final_snapshot     = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.identifier}-final-snapshot-${formatdate("YYYYMMDDhhmmss", timestamp())}"
  deletion_protection     = var.deletion_protection
  
  allow_major_version_upgrade = var.allow_major_version_upgrade
  auto_minor_version_upgrade  = var.auto_minor_version_upgrade
  apply_immediately          = var.apply_immediately
  
  copy_tags_to_snapshot     = true
  delete_automated_backups   = var.delete_automated_backups
  
  # Monitoring
  monitoring_interval = var.monitoring_interval
  monitoring_role_arn = var.monitoring_interval > 0 ? aws_iam_role.rds_enhanced_monitoring[0].arn : null
  
  # Performance Insights
  performance_insights_enabled          = var.performance_insights_enabled
  performance_insights_retention_period = var.performance_insights_enabled ? var.performance_insights_retention_period : null
  
  # CloudWatch Logs
  enabled_cloudwatch_logs_exports = var.enabled_cloudwatch_logs_exports
  
  # Network
  publicly_accessible = var.publicly_accessible
  
  # Maintenance
  maintenance_window = var.maintenance_window
  
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
