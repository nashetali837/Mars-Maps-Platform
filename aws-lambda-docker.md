# AWS Lambda Deployment (Serverless)

To deploy the routing engine on AWS Lambda:

1. **Build Docker Image**: Use a Lambda-compatible base image if necessary, but AWS supports arbitrary containers now.
2. **Push to ECR**: 
   `aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin account_id.dkr.ecr.us-east-1.amazonaws.com`
3. **Create Lambda**:
   `aws lambda create-function --function-name MarsRoutingEngine --package-type Image --code ImageUri=account_id.dkr.ecr.us-east-1.amazonaws.com/mars-routing-engine:latest --role arn:aws:iam::account_id:role/lambda-role`
4. **Provision Concurrency**: For CUDA/Scientific libs, ensure high memory (>= 3GB) and consider Provisioned Concurrency to avoid cold starts.

Note: Native CUDA is not available on standard Lambda. For GPU-acceleration, use **AWS SageMaker Serverless Inference** or **GCP Cloud Run with GPUs**.
