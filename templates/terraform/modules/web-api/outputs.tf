# ALB Outputs
output "load_balancer_arn" {
  description = "The ARN of the load balancer"
  value       = aws_lb.web_api.arn
}

output "load_balancer_dns_name" {
  description = "The DNS name of the load balancer"
  value       = aws_lb.web_api.dns_name
}

output "load_balancer_zone_id" {
  description = "The zone ID of the load balancer"
  value       = aws_lb.web_api.zone_id
}

# Target Group Outputs
output "target_group_arn" {
  description = "The ARN of the target group"
  value       = aws_lb_target_group.web_api.arn
}

output "target_group_name" {
  description = "The name of the target group"
  value       = aws_lb_target_group.web_api.name
}

# ECS Outputs
output "ecs_cluster_arn" {
  description = "The ARN of the ECS cluster"
  value       = aws_ecs_cluster.web_api.arn
}

output "ecs_cluster_name" {
  description = "The name of the ECS cluster"
  value       = aws_ecs_cluster.web_api.name
}

output "ecs_service_arn" {
  description = "The ARN of the ECS service"
  value       = aws_ecs_service.web_api.id
}

output "ecs_service_name" {
  description = "The name of the ECS service"
  value       = aws_ecs_service.web_api.name
}

output "ecs_task_definition_arn" {
  description = "The ARN of the ECS task definition"
  value       = aws_ecs_task_definition.web_api.arn
}

# Security Group Outputs
output "alb_security_group_id" {
  description = "The ID of the ALB security group"
  value       = aws_security_group.web_api.id
}

output "ecs_security_group_id" {
  description = "The ID of the ECS service security group"
  value       = aws_security_group.ecs_service.id
}

# IAM Outputs
output "ecs_task_execution_role_arn" {
  description = "The ARN of the ECS task execution role"
  value       = aws_iam_role.ecs_task_execution_role.arn
}

output "ecs_task_role_arn" {
  description = "The ARN of the ECS task role"
  value       = aws_iam_role.ecs_task_role.arn
}

# CloudWatch Outputs
output "cloudwatch_log_group_name" {
  description = "The name of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.web_api.name
}

output "cloudwatch_log_group_arn" {
  description = "The ARN of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.web_api.arn
}

# Auto Scaling Outputs
output "appautoscaling_target_id" {
  description = "The ID of the Application Auto Scaling target"
  value       = aws_appautoscaling_target.ecs_target.id
}

output "cpu_scaling_policy_arn" {
  description = "The ARN of the CPU scaling policy"
  value       = aws_appautoscaling_policy.ecs_policy_cpu.arn
}

output "memory_scaling_policy_arn" {
  description = "The ARN of the memory scaling policy"
  value       = aws_appautoscaling_policy.ecs_policy_memory.arn
}

# Combined Outputs
output "web_api_url" {
  description = "The URL to access the web API"
  value       = "https://${aws_lb.web_api.dns_name}"
}

output "web_api_http_url" {
  description = "The HTTP URL to access the web API"
  value       = "http://${aws_lb.web_api.dns_name}"
}

output "all_outputs" {
  description = "A map of all outputs for use in other modules"
  value = {
    alb = {
      arn       = aws_lb.web_api.arn
      dns_name  = aws_lb.web_api.dns_name
      zone_id   = aws_lb.web_api.zone_id
      sg_id     = aws_security_group.web_api.id
    }
    target_group = {
      arn  = aws_lb_target_group.web_api.arn
      name = aws_lb_target_group.web_api.name
    }
    ecs = {
      cluster_arn  = aws_ecs_cluster.web_api.arn
      service_arn  = aws_ecs_service.web_api.id
      service_name = aws_ecs_service.web_api.name
      task_definition_arn = aws_ecs_task_definition.web_api.arn
    }
    security_groups = {
      alb = aws_security_group.web_api.id
      ecs = aws_security_group.ecs_service.id
    }
    iam = {
      task_execution_role = aws_iam_role.ecs_task_execution_role.arn
      task_role          = aws_iam_role.ecs_task_role.arn
    }
    cloudwatch = {
      log_group_name = aws_cloudwatch_log_group.web_api.name
      log_group_arn  = aws_cloudwatch_log_group.web_api.arn
    }
    autoscaling = {
      target_id          = aws_appautoscaling_target.ecs_target.id
      cpu_policy_arn     = aws_appautoscaling_policy.ecs_policy_cpu.arn
      memory_policy_arn  = aws_appautoscaling_policy.ecs_policy_memory.arn
    }
  }
}
