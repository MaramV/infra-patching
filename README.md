# Tomcat and Apache AMI Update CDK Stack #

This stack deploys resources to automatically patch and update Tomcat and Apache AMI's used by the respective Autoscaling Groups through the use of Launch Templates.

# Adding a New Account to Deploy to #
- Accounts are defined withing the ./accounts/ directory in their own .yaml file. If you want to leave the default resource names, only the information under the 'Account Information' section needs to be filled out. 
- An example template for an account can be found in the './accounts/optiTest.yaml' file.


# How to Deploy the CDK Stack #
- The stack can be deployed through the AWS CLI using the following command format:

    cdk deploy --all -c config={file name from /accounts/ directory} --profile {CLI profile name from /.aws/.config file}

    ex: cdk deploy --all -c config=optiTest --profile opti-test

# Prerequisites #

The only prerequisite is to have a file created within the /accounts/ directory with the designated fields filled out. An example of a working account configuration file can be found in the 'optiTest.yaml' file.


# Workflow #

Inside Systems Manager, the 'tomcatAndApacheAMIPatching' maintenance window controls the rate at which the automations are executed through the use of a CRON Schedule.

During the maintenance window, the parent Automation Document named 'executeAmiPatchScanDocuments' is executed. This document has 4 steps:

1. Launch a CloudFormation Stack to create 2 Security Groups, and 3 VPC Interface Endpoints.

2. Execute the child Automation Document named 'patchAndUpdateTomcatAmi'

3. Execute the child Automation Document named 'patchAndUpdateApacheAmi'

4. Delete the CloudFormation Stack to remove the Security Groups and VPC Interface Endpoints.

Each child Automation Document that is executed for a Tomcat and Apache instance will go through the following workflow:

1. Launch an instance from the existing AMI listed in Parameter Store.
    a. Tomcat: /amiPatching/tomcat/tomcatAmiId
    b. Apache: /amiPatching/apache/apacheAmiId
2. Add tags to the instance so it can scan against the custom Patch Baseline.
3. Issue a Run Command from Systems Manager to verify connectivity between Systems Manager and the instance.
4. Issue a Run Command to update OS level packages.
5. Issue a Run Command to scan the instance against the custom patch baseline.
6. Issue a Run Command to install any missing patches found by the custom patch baseline.
7. Issue a Run Command to update the Systems Manager Agent to the latest version.
8. Stop the Instance.
9. Start the Instance (Essentially to reboot it in case it needs to be rebooted for any changes to be applied).
10. Stop the instance.
11. Create a new Amazon Machine Image (AMI) from the stopped instance.
12. Add tags to the newly created image.
13. Terminate the instance.
14. Execute a Lambda function to update the respective Parameter Store value with the new AMI Id.


# Resources Deployed #
- S3 Bucket that contains the CloudFormation Template used by the parent Automation Execution Document and to store CSV Reports.
- SNS Topic that can optionally be subscribed to for alerts whenever a new object is uploaded to the S3 bucket above
- IAM Role for EC2 Instances that are launched to be patched
- IAM Role for the Automation Documents to assume
- IAM Role the Lambda Function to assume
- Lambda Function to update the Systems Manager Parameter Store value.
- SSM Parameter Store values for patching configuration, Tomcat information, and Apache information.
- Custom Patch Baseline for Amazon Linux 2 OS that anything with the 'Patch Group:apache' or 'Patch Group:tomcat' key/value pairs are associated with.
- Parent Automation Document to deploy resources necessary for patching and execution of child Automation Documents.
- Child Automation Documents to update Tomcat and Apache AMIs.
- Maintenance Window with a task to execute Parent Automation Document.