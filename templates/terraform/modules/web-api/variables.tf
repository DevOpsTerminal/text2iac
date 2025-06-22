# Required Variables
variable "name_prefix" {
  description = "A prefix used for naming resources"
  type        = string
}

variable "vpc_id" {
  description = "The VPC ID where resources will be created"
  type        = string
}

variable "public_subnet_ids" {
  description = "List of public subnet IDs for the load balancer"
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for ECS tasks"
  type        = list(string)
}

variable "container_image" {
  description = "The Docker image to run in the ECS task"
  type        = string
}

# Optional Variables with Defaults
variable "container_port" {
  description = "The port on which the container is listening"
  type        = number
  default     = 80
}

variable "health_check_path" {
  description = "The path for the health check endpoint"
  type        = string
  default     = "/health"
}

variable "enable_https" {
  description = "Whether to enable HTTPS on the load balancer"
  type        = bool
  default     = false
}

variable "certificate_arn" {
  description = "The ARN of the SSL certificate for HTTPS"
  type        = string
  default     = ""
}

variable "cpu" {
  description = "The number of CPU units to reserve for the container"
  type        = string
  default     = "256"
}

variable "memory" {
  description = "The amount (in MiB) of memory to reserve for the container"
  type        = string
  default     = "512"
}

variable "desired_count" {
  description = "The number of instances of the task to place and keep running"
  type        = number
  default     = 1
}

variable "environment_variables" {
  description = "Environment variables to pass to the container"
  type        = map(string)
  default     = {}
}

variable "tags" {
  description = "A map of tags to add to all resources"
  type        = map(string)
  default     = {}
}

variable "enable_container_insights" {
  description = "Whether to enable CloudWatch Container Insights"
  type        = bool
  default     = false
}

variable "log_retention_days" {
  description = "Number of days to retain logs in CloudWatch"
  type        = number
  default     = 30
}

variable "enable_deletion_protection" {
  description = "Whether to enable deletion protection on the ALB"
  type        = bool
  default     = false
}

# Auto Scaling Configuration
variable "min_capacity" {
  description = "Minimum number of tasks to run"
  type        = number
  default     = 1
}

variable "max_capacity" {
  description = "Maximum number of tasks to run"
  type        = number
  default     = 5
}

variable "target_cpu_utilization" {
  description = "Target CPU utilization percentage for auto scaling"
  type        = number
  default     = 70
}

variable "target_memory_utilization" {
  description = "Target memory utilization percentage for auto scaling"
  type        = number
  default     = 80
}

# CloudWatch Alarms
variable "cpu_utilization_threshold" {
  description = "The threshold for CPU utilization alarm"
  type        = number
  default     = 80
}

variable "memory_utilization_threshold" {
  description = "The threshold for memory utilization alarm"
  type        = number
  default     = 80
}

variable "alarm_actions" {
  description = "A list of ARNs to be executed when the alarm transitions into an ALARM state"
  type        = list(string)
  default     = []
}

variable "ok_actions" {
  description = "A list of ARNs to be executed when the alarm transitions into an OK state"
  type        = list(string)
  default     = []
}

# Security Group Rules
variable "additional_security_group_rules" {
  description = "List of additional security group rules to apply to the ECS service"
  type = list(object({
    type        = string
    from_port   = number
    to_port     = number
    protocol    = string
    cidr_blocks = list(string)
    description = string
  }))
  default = []
}
