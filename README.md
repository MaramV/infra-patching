# Tomcat and Apache AMI Compliance CDK Stack #

This stack deploys resources necessary to generate compliance reports and perform AMI cleanup for Tomcat and Apache AMIs.


# Adding a New Account to Deploy to #
- Accounts are defined withing the ./accounts/ directory in their own .yaml file. If you want to leave the default resource names, only the information under the 'Account Information' section needs to be filled out. 
- An example template for an account can be found in the './accounts/optiTest.yaml' file.


# How to Deploy the CDK Stack #

- The stack can be deployed through the AWS CLI using the following command format:

    cdk deploy --all -c config={file name from /accounts/ directory} --profile {CLI profile name from /.aws/.config file}

    ex: cdk deploy --all -c config=optiTest --profile opti-test


# Prerequisites #

- This stack requires a Lambda Layer containing SDK V3 packages used to perform against within the AWS account. The contents of this Lambda layer are within the ./src/layers/aws-sdk/nodejs/ directory.

- This can be installed from the root directory of this stack with the following CLI command:

    - aws lambda publish-layer-version --layer-name sdkV3Layer --description "SDK V3 Layer for AMI Report Generation" --compatible-runtimes nodejs14.x nodejs16.x --zip-file fileb://./src/layers/aws-sdk/node_sdkv3.zip --profile {profile name}

    - Ex: aws lambda publish-layer-version --layer-name sdkV3Layer --description "SDK V3 Layer for AMI Report Generation" --compatible-runtimes nodejs14.x nodejs16.x --zip-file fileb://./src/layers/aws-sdk/node_sdkv3.zip --profile opti-test

- After the Lambda Layer has been created, attach the layer to the two Lambda functions created by the CDK stack.

- Have a file created within the /accounts/ directory with the designated fields filled out. An example of a working account configuration file can be found in the 'optiTest.yaml' file.

# Workflows #
- All objects uploaded to the S3 bucket targeted by instances and Lambda functions trigger an S3 Event Notification and are sent to an SNS topic where subscribers can be notified by email.
- Patch Scan Report
    1. A Systems Manager Maintenance Window "scanAmisForPatches" is configured on a CRON Schedule with a single task: executeAmiPatchScanDocuments
    2. The executeAmiPatchScanDocuments Automation Document is executed with the following steps:
        1. Launch a CloudFormation Stack to create two security groups and 3 VPC Interface Endpoints for instances in private subnets to communicate with Systems Manager
        2. Execute two child automation documents: tomcatScanForPatches and apacheScanForPatches that does the following:
            1. Launch an instance in a private subnet

            2. Issue a Run Command to verify the 
            instance can communicate with Systems Manager

            3. Scan for patches against the 'ami-patching-pb' custom Patch Baseline.

            4. Generate a CSV with the package name, current version, and updated version

            5. push the CSV to an S3 bucket.
    3. After each AMI has been scanned for patches and an report has been uploaded to an S3 bucket, tear down the CloudFormation stack with the two security groups and three VPC Interface Endpoints.

- Out of Date Instance Report
    - This report is generated through the use of a Lambda function. This Lambda function executes the following steps:
        1. Call all EC2 instances within the account and region the Lambda is deployed in, filtering by the following tag:
            - a. Tomcat: amiType:tomcat
            - b. Apache: amiType:apache
        2. For each instance, get the Name Tag, Instance Id, AMI Id, and Launch Time and put it into a CSV
        3. Push the CSV to an S3 bucket

- AMI and Snapshot Cleanup
    - This functionality is defined within a single Lambda function. The purpose of this Lambda function is to deregister any AMIs and delete their corresponding snapshot based on a key value pair. The Lambda function executes the following logic
        1. Get a list of all AMIs within the account and region, filtering by the following tags:
            - a. amiType: (apache or tomcat)
            - b. markedForDeletion: true
        2. If the Tag 'markedForDeletion' has a value of 'true', the Lambda Function will deregister the AMI and delete the corresponding snapshot.
        3. The AMI Id(s) and Snapshot Id(s) that are deleted are placed into a CSV and uploaded to an S3 bucket.


# Resources Deployed #
- IAM Role for the two Lambda Functions to use
- Two Lambda Functions
    - SSMbuildDeprecatedInstancesReport
    - SSMremoveDeprecatedAmis
- Systems Manager Parameter Store Keys for the three Automation Documents that are created by the stack
- 3 Automation documents to complete patch scanning for the Apache and Tomcat AMIs
- 3 Maintenance Windows to execute AMI patch scanning, report generation for out of date instances, and AMI/Snapshot Removal.