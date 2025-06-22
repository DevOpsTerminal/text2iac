# Database Instance Outputs
output "db_instance_arn" {
  description = "The ARN of the RDS instance"
  value       = aws_db_instance.database.arn
}

output "db_instance_id" {
  description = "The RDS instance ID"
  value       = aws_db_instance.database.id
}

output "db_instance_address" {
  description = "The address of the RDS instance"
  value       = aws_db_instance.database.address
}

output "db_instance_endpoint" {
  description = "The connection endpoint for the RDS instance"
  value       = aws_db_instance.database.endpoint
}

output "db_instance_port" {
  description = "The database port"
  value       = aws_db_instance.database.port
}

output "db_instance_username" {
  description = "The master username for the database"
  value       = aws_db_instance.database.username
  sensitive   = true
}

output "db_instance_database_name" {
  description = "The name of the database"
  value       = aws_db_instance.database.db_name
}

# Security Group Outputs
output "db_security_group_id" {
  description = "The ID of the security group for the database"
  value       = aws_security_group.database.id
}

# Subnet Group Outputs
output "db_subnet_group_id" {
  description = "The ID of the database subnet group"
  value       = aws_db_subnet_group.database.id
}

output "db_subnet_group_arn" {
  description = "The ARN of the database subnet group"
  value       = aws_db_subnet_group.database.arn
}

# Parameter Group Outputs
output "db_parameter_group_id" {
  description = "The ID of the database parameter group"
  value       = aws_db_parameter_group.database.id
}

output "db_parameter_group_arn" {
  description = "The ARN of the database parameter group"
  value       = aws_db_parameter_group.database.arn
}

# RDS Proxy Outputs
output "db_proxy_id" {
  description = "The ID of the RDS Proxy"
  value       = try(aws_db_proxy.database[0].id, null)
}

output "db_proxy_arn" {
  description = "The ARN of the RDS Proxy"
  value       = try(aws_db_proxy.database[0].arn, null)
}

output "db_proxy_endpoint" {
  description = "The endpoint of the RDS Proxy"
  value       = try(aws_db_proxy.database[0].endpoint, null)
}

# Secrets Manager Outputs
output "db_credentials_secret_arn" {
  description = "The ARN of the database credentials secret"
  value       = try(aws_secretsmanager_secret.database_credentials[0].arn, null)
}

output "db_credentials_secret_version" {
  description = "The unique identifier of the database credentials secret version"
  value       = try(aws_secretsmanager_secret_version.database_credentials[0].version_id, null)
  sensitive   = true
}

# CloudWatch Logs Outputs
output "cloudwatch_log_group_arns" {
  description = "A map of CloudWatch log group ARNs keyed by log type"
  value       = { for k, v in aws_cloudwatch_log_group.rds_logs : k => v.arn }
}

# Enhanced Monitoring Outputs
output "enhanced_monitoring_iam_role_arn" {
  description = "The ARN of the IAM role for enhanced monitoring"
  value       = try(aws_iam_role.rds_enhanced_monitoring[0].arn, null)
}

# Event Subscription Outputs
output "event_subscription_arn" {
  description = "The ARN of the RDS event subscription"
  value       = try(aws_db_event_subscription.database[0].arn, null)
}

# Combined Outputs
output "all_outputs" {
  description = "A map of all outputs for use in other modules"
  value = {
    instance = {
      arn      = aws_db_instance.database.arn
      id       = aws_db_instance.database.id
      address  = aws_db_instance.database.address
      endpoint = aws_db_instance.database.endpoint
      port     = aws_db_instance.database.port
      username = aws_db_instance.database.username
      db_name  = aws_db_instance.database.db_name
    }
    security_group = {
      id = aws_security_group.database.id
    }
    subnet_group = {
      id  = aws_db_subnet_group.database.id
      arn = aws_db_subnet_group.database.arn
    }
    parameter_group = {
      id  = aws_db_parameter_group.database.id
      arn = aws_db_parameter_group.database.arn
    }
    proxy = var.enable_proxy ? {
      id       = aws_db_proxy.database[0].id
      arn      = aws_db_proxy.database[0].arn
      endpoint = aws_db_proxy.database[0].endpoint
    } : null
    secrets = (var.enable_proxy || var.store_credentials_in_secrets_manager) ? {
      secret_arn = aws_secretsmanager_secret.database_credentials[0].arn
    } : null
    monitoring = var.monitoring_interval > 0 ? {
      role_arn = aws_iam_role.rds_enhanced_monitoring[0].arn
    } : null
    event_subscription = var.enable_event_subscription ? {
      arn = aws_db_event_subscription.database[0].arn
    } : null
  }
  sensitive = true
}
