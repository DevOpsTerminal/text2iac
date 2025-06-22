# API Reference

## Base URL
```
https://api.text2iac.com/v1
```

## Authentication

All API requests must include an API key in the `X-API-Key` header.

```http
GET /status HTTP/1.1
Host: api.text2iac.com
X-API-Key: your-api-key-here
```

## Endpoints

### Health Check

```http
GET /health
```

**Response**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2023-06-22T16:00:00Z"
}
```

### Generate IaC

```http
POST /generate
```

**Request Body**
```json
{
  "description": "A simple web application with a load balancer",
  "provider": "aws",
  "format": "terraform",
  "variables": {
    "region": "us-west-2",
    "instance_type": "t3.micro"
  }
}
```

**Response**
```json
{
  "id": "gen_1234567890",
  "status": "completed",
  "created_at": "2023-06-22T16:00:00Z",
  "files": [
    {
      "name": "main.tf",
      "content": "# Terraform configuration..."
    },
    {
      "name": "variables.tf",
      "content": "# Variables..."
    }
  ]
}
```

### Get Generation Status

```http
GET /generate/{id}
```

**Response**
```json
{
  "id": "gen_1234567890",
  "status": "completed",
  "progress": 100,
  "created_at": "2023-06-22T16:00:00Z",
  "completed_at": "2023-06-22T16:00:15Z"
}
```

## Error Handling

Errors follow the following format:

```json
{
  "error": {
    "code": "invalid_request",
    "message": "Invalid request parameters",
    "details": {
      "description": "is required"
    }
  }
}
```

### Common Error Codes

| Status Code | Error Code | Description |
|-------------|------------|-------------|
| 400 | invalid_request | Invalid request parameters |
| 401 | unauthorized | Invalid or missing API key |
| 403 | forbidden | Insufficient permissions |
| 404 | not_found | Resource not found |
| 429 | rate_limit_exceeded | Too many requests |
| 500 | internal_error | Internal server error |

## Rate Limiting

- 100 requests per minute per API key
- 10,000 requests per day per API key

## Webhooks

You can configure webhooks to receive notifications about generation status changes. Set the `webhook_url` in your request to receive updates.

**Webhook Payload**
```json
{
  "event": "generation.completed",
  "data": {
    "id": "gen_1234567890",
    "status": "completed",
    "created_at": "2023-06-22T16:00:00Z"
  }
}
```
