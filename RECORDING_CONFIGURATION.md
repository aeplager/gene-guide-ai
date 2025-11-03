# Tavus Recording Configuration

This document explains how to configure video recording for Tavus conversations.

## Overview

Tavus can record video conversations and store them in your AWS S3 bucket. This feature is **optional** and requires:
- An AWS S3 bucket for storage
- AWS IAM role with appropriate permissions
- Environment variables configured

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Enable/disable recording (default: false)
TAVUS_ENABLE_RECORDING=false

# AWS S3 Configuration (required if recording is enabled)
TAVUS_RECORDING_S3_BUCKET_NAME=your-bucket-name
TAVUS_RECORDING_S3_BUCKET_REGION=us-east-1
TAVUS_AWS_ASSUME_ROLE_ARN=arn:aws:iam::123456789012:role/TavusRecordingRole
```

### AWS Setup

1. **Create an S3 Bucket:**
   ```bash
   aws s3 mb s3://your-tavus-recordings --region us-east-1
   ```

2. **Create IAM Role for Tavus:**
   
   Create a trust policy (`trust-policy.json`):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {
           "AWS": "arn:aws:iam::TAVUS_ACCOUNT_ID:role/tavus-recording-role"
         },
         "Action": "sts:AssumeRole"
       }
     ]
   }
   ```
   
   Create the role:
   ```bash
   aws iam create-role \
     --role-name TavusRecordingRole \
     --assume-role-policy-document file://trust-policy.json
   ```

3. **Attach S3 Permissions:**
   
   Create policy document (`s3-policy.json`):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:PutObjectAcl",
           "s3:GetObject"
         ],
         "Resource": "arn:aws:s3:::your-tavus-recordings/*"
       }
     ]
   }
   ```
   
   Attach policy:
   ```bash
   aws iam put-role-policy \
     --role-name TavusRecordingRole \
     --policy-name TavusS3Access \
     --policy-document file://s3-policy.json
   ```

4. **Get the Role ARN:**
   ```bash
   aws iam get-role --role-name TavusRecordingRole --query 'Role.Arn' --output text
   ```
   
   Copy this ARN to `TAVUS_AWS_ASSUME_ROLE_ARN`.

## Enabling Recording

### Local Development

1. Update your `.env` file:
   ```env
   TAVUS_ENABLE_RECORDING=true
   TAVUS_RECORDING_S3_BUCKET_NAME=your-bucket-name
   TAVUS_RECORDING_S3_BUCKET_REGION=us-east-1
   TAVUS_AWS_ASSUME_ROLE_ARN=arn:aws:iam::123456789012:role/TavusRecordingRole
   ```

2. Restart the backend:
   ```bash
   docker-compose down
   docker-compose up --build
   ```

3. Check logs for confirmation:
   ```
   📹 Recording enabled with S3 bucket: your-bucket-name
   ```

### Azure Container Apps

1. Add secrets to GitHub repository:
   - Go to **Settings → Secrets and variables → Actions**
   - Add:
     - `TAVUS_ENABLE_RECORDING` = `true`
     - `TAVUS_RECORDING_S3_BUCKET_NAME` = `your-bucket-name`
     - `TAVUS_RECORDING_S3_BUCKET_REGION` = `us-east-1`
     - `TAVUS_AWS_ASSUME_ROLE_ARN` = `arn:aws:iam::123456789012:role/TavusRecordingRole`

2. The GitHub Actions workflow will automatically set these environment variables during deployment.

3. Alternatively, set manually via Azure CLI:
   ```bash
   az containerapp update \
     --name gene-guide-backend \
     --resource-group rg_custom_llm \
     --set-env-vars \
       TAVUS_ENABLE_RECORDING=true \
       TAVUS_RECORDING_S3_BUCKET_NAME=your-bucket-name \
       TAVUS_RECORDING_S3_BUCKET_REGION=us-east-1 \
       TAVUS_AWS_ASSUME_ROLE_ARN=arn:aws:iam::123456789012:role/TavusRecordingRole
   ```

## How It Works

When recording is **enabled**, the backend adds these properties to Tavus API calls:

```python
{
  "properties": {
    "enable_closed_captions": False,
    "enable_recording": True,
    "recording_s3_bucket_name": "your-bucket-name",
    "recording_s3_bucket_region": "us-east-1",
    "aws_assume_role_arn": "arn:aws:iam::123456789012:role/TavusRecordingRole"
  }
}
```

When recording is **disabled** (default):

```python
{
  "properties": {
    "enable_closed_captions": False,
    "enable_recording": False
  }
}
```

## Accessing Recordings

Recordings will be stored in your S3 bucket at:
```
s3://your-bucket-name/<conversation_id>/recording.mp4
```

You can:
- View them in AWS S3 console
- Download via AWS CLI:
  ```bash
  aws s3 cp s3://your-bucket-name/<conversation_id>/recording.mp4 .
  ```
- Set up S3 lifecycle policies for automatic archiving/deletion

## Security Considerations

1. **IAM Permissions**: Grant minimum required permissions (PutObject, GetObject only)
2. **Bucket Policy**: Restrict bucket access to your IAM role only
3. **Encryption**: Enable S3 bucket encryption:
   ```bash
   aws s3api put-bucket-encryption \
     --bucket your-bucket-name \
     --server-side-encryption-configuration \
     '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
   ```
4. **Lifecycle Policy**: Auto-delete old recordings after 90 days:
   ```bash
   aws s3api put-bucket-lifecycle-configuration \
     --bucket your-bucket-name \
     --lifecycle-configuration file://lifecycle.json
   ```
   
   Where `lifecycle.json`:
   ```json
   {
     "Rules": [
       {
         "Id": "DeleteOldRecordings",
         "Status": "Enabled",
         "Expiration": {
           "Days": 90
         }
       }
     ]
   }
   ```

## Troubleshooting

### Recording Not Working

1. **Check logs** for recording status:
   ```bash
   docker-compose logs backend | grep "Recording"
   ```
   
   You should see:
   ```
   📹 Recording enabled with S3 bucket: your-bucket-name
   ```

2. **Verify environment variables** are set:
   ```bash
   docker-compose exec backend env | grep TAVUS
   ```

3. **Check IAM permissions**: Ensure the role has `s3:PutObject` permission

4. **Verify bucket exists**:
   ```bash
   aws s3 ls s3://your-bucket-name
   ```

### Recordings Not Appearing in S3

- Tavus processes recordings asynchronously after the conversation ends
- Check the Tavus dashboard for conversation status
- Verify the conversation ended successfully (check `/tavus/end` logs)
- Wait 5-10 minutes for processing

## Disabling Recording

To disable recording:

1. **Local**: Set `TAVUS_ENABLE_RECORDING=false` in `.env`
2. **Azure**: Remove or set to `false` in GitHub secrets, or run:
   ```bash
   az containerapp update \
     --name gene-guide-backend \
     --resource-group rg_custom_llm \
     --set-env-vars TAVUS_ENABLE_RECORDING=false
   ```

The backend will log:
```
📹 Recording disabled
```

## Cost Considerations

Recording incurs costs from:
- **Tavus**: Recording feature usage (check Tavus pricing)
- **AWS S3**: Storage costs (~$0.023/GB/month in us-east-1)
- **AWS Data Transfer**: Egress costs if downloading recordings

**Recommendation**: Enable lifecycle policies to auto-delete old recordings.

## References

- [Tavus API Documentation](https://docs.tavus.io)
- [AWS S3 Pricing](https://aws.amazon.com/s3/pricing/)
- [AWS IAM Roles](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html)

