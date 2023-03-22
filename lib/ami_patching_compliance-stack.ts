import { Stack, Duration, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { amiPatchingConfig } from '../models/config';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as fs from 'fs';
import * as path from 'path';
const yaml = require('js-yaml');

export class AmiPatchingComplianceStack extends Stack {
  constructor(scope: Construct, id: string, account: amiPatchingConfig, props?: StackProps) {
    super(scope, id, props);

    /*-----------------------------------------------------------------------------------------------------------------------------------------*/
    /*                                                       IAM Resources                                                                     */
    /*-----------------------------------------------------------------------------------------------------------------------------------------*/

    const lambdaExecutionRolePolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: [
            "arn:aws:logs:" + account.region + ":" + account.accountId + ":*"
          ],
          actions: [
            "logs:CreateLogGroup"
          ],
          effect: iam.Effect.ALLOW
        }),
        new iam.PolicyStatement({
          resources: [
            "arn:aws:logs:" + account.region + ":" + account.accountId + ":log-group:/aws/lambda/*"
          ],
          actions: [
            "logs:CreateLogStream",
            "logs:PutLogEvents"
          ]
        }),
        new iam.PolicyStatement({
          resources: [
            "arn:aws:s3:::" + account.accountId + "-" + account.code + "-ami-patching-templates-and-reports/*"
          ],
          actions: [
            "s3:PutObject"
          ]
        }),
        new iam.PolicyStatement({
          resources: [
            "*"
          ],
          actions: [
            "ec2:DescribeInstances",
            "ec2:DescribeInstanceAttribute",
            "ec2:DescribeImages",
            "ec2:DescribeImageAttribute",
            "ec2:DeregisterImage",
            "ec2:DeleteSnapshot"
          ]
        }),
        new iam.PolicyStatement({
          resources: [
            "*"
          ],
          actions: [
            "ssm:DescribeParameters",
            "ssm:GetParameter",
            "ssm:GetParameters"
          ]
        })
      ]
    })

    const lambdaExecutionRole = new iam.Role(this, 'lambdaExecutionRole', {
      roleName: 'amiPatchingComplianceLambdaRole',
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('lambda.amazonaws.com'),
        new iam.ServicePrincipal('ssm.amazonaws.com')
      ),
      description: 'This role is assumed by the buildDeprecatedInstances report to generate a report of all tomcat and apache instances using an outdated AMI',
      inlinePolicies: {
        lambdaExecutionRolePolicy
      }
    })

    lambdaExecutionRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonSSMMaintenanceWindowRole"))

    /*-----------------------------------------------------------------------------------------------------------------------------------------*/
    /*                                                       Lambda Resources                                                                  */
    /*-----------------------------------------------------------------------------------------------------------------------------------------*/

    const s3BucketParameter = ssm.StringParameter.valueForStringParameter(this, '/amiPatching/config/s3BucketName');

    const buildDeprecatedInstancesLambda = new lambda.Function(this, 'buildDeprecatedInstancesLambda', {
      runtime: lambda.Runtime.NODEJS_16_X,
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/buildDeprecatedInstancesReport/')),
      handler: 'buildDeprecatedInstancesReport.handler',
      functionName: account.deprecatedInstanceFunctionName,
      timeout: Duration.seconds(90),
      role: lambdaExecutionRole,
      logRetention: 7,
      environment: {
        's3Bucket': s3BucketParameter,
        'filterName': account.deprecatedInstanceFunctionFilterName,
        'tomcatFilterValue': account.deprecatedInstanceFunctionTomcatFilterValue,
        'apacheFilterValue': account.deprecatedInstanceFunctionApacheFilterValue
      },
      layers: [
        lambda.LayerVersion.fromLayerVersionArn(this, 'buildDeprecatedInstancesReportSdkLayer', account.lambdaSDKLayerVersionArn)
      ]
    });


    const removeDeprecatedAMIsLambda = new lambda.Function(this, 'removeDeprecatedAmisLambda', {
      runtime: lambda.Runtime.NODEJS_16_X,
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/removeDeprecatedAMIs/')),
      handler: 'removeDeprecatedAMIs.handler',
      functionName: account.removeDeprecatedAmisFunctionName,
      timeout: Duration.seconds(90),
      role: lambdaExecutionRole,
      logRetention: 7,
      environment: {
        's3Bucket': s3BucketParameter,
        'tagKey': account.removeDeprecatedAmisFunctionTagKey,
        'tomcatTagValue': account.removeDeprecatedAmisFunctionTomcatTagValue,
        'apacheTagValue': account.removeDeprecatedAmisFunctionApacheTagValue,
        'deleteAmiTagKey': account.removeDeprecatedAmisFunctionDeletionTagKey,
        'deleteAmiTagValue': account.removeDeprecatedAmisFunctionDeletionTagValue
      },
      layers: [
        lambda.LayerVersion.fromLayerVersionArn(this, 'removeDeprecatedInstancesSdkLayer', account.lambdaSDKLayerVersionArn)
      ]
    });


    /*-----------------------------------------------------------------------------------------------------------------------------------------*/
    /*                                                       SSM Resources                                                                     */
    /*-----------------------------------------------------------------------------------------------------------------------------------------*/

    // Create SSM Parameter Store for tomcat document
    const tomcatPatchScanDocumentNameParameter = new ssm.StringParameter(this, 'tomcatPatchScanDocumentNameParameter', {
      parameterName: '/amiPatching/compliance/tomcatPatchScanAutomationDocumentName',
      stringValue: account.tomcatPatchScanAutomationDocumentName,
      type: ssm.ParameterType.STRING
    });


    // Create SSM Parameter Store for apache document
    const apachePatchScanDocumentNameParameter = new ssm.StringParameter(this, 'apachePatchScanDocumentNameParameter', {
      parameterName: '/amiPatching/compliance/apachePatchScanAutomationDocumentName',
      stringValue: account.apachePatchScanAutomationDocumentName,
      type: ssm.ParameterType.STRING
    });

    // Create parent automation document that creates VPC endpoints and launches child automation documents
    const patchScanParentDocument = new ssm.CfnDocument(this, 'patchScanParentDocument', {
      content: yaml.load(fs.readFileSync(path.resolve('./documents/AWS-ExecutePatchScanDocuments.json'), 'utf8')),
      documentType: 'Automation',
      name: account.automationExecutionDocumentName
    });

    // Create tomcat automation document
    const tomcatScanForPatchesDocument = new ssm.CfnDocument(this, 'tomcatScanForPatchesDocument', {
      content: yaml.load(fs.readFileSync(path.resolve('./documents/AWS-ExecuteTomcatPatchScan.json'), 'utf8')),
      documentType: 'Automation',
      name: account.tomcatPatchScanAutomationDocumentName
    });


    // Create apache automation document
    const apacheScanForPatchesDocument = new ssm.CfnDocument(this, 'apacheScanForPatchesDocument', {
      content: yaml.load(fs.readFileSync(path.resolve('./documents/AWS-ExecuteApachePatchScan.json'), 'utf8')),
      documentType: 'Automation',
      name: account.apachePatchScanAutomationDocumentName
    });


    const maintenanceWindow = new ssm.CfnMaintenanceWindow(this, 'scanForPatchesMaintenanceWindow', {
      allowUnassociatedTargets: false,
      cutoff: 0,
      duration: 2,
      schedule: account.scanForPatchesWindowCronSchedule,
      name: account.scanForPatchesMaintenanceWindowName,
      description: 'Maintenance Window that launches an apache and tomcat instance, scans for patches, and generates a report uploaded to s3'
    });

    const automationDocumentExecutionRoleArn = ssm.StringParameter.valueForStringParameter(this, '/amiPatching/config/automationDocumentExecutionIamRoleArn');

    const maintenanceWindowTask = new ssm.CfnMaintenanceWindowTask(this, 'maintenanceWindowTask', {
      priority: 1,
      taskArn: account.automationExecutionDocumentName,
      taskType: 'AUTOMATION',
      windowId: maintenanceWindow.ref,
      description: 'Task that executes parent document to build resources necessary to generate CSV report with missing patches listed.',
      serviceRoleArn: automationDocumentExecutionRoleArn
    });


    const deprecatedInstanceScanMaintenanceWindow = new ssm.CfnMaintenanceWindow(this, 'deprecatedInstanceScanMaintenanceWindow', {
      allowUnassociatedTargets: false,
      cutoff: 0,
      duration: 2,
      schedule: account.scanForDeprecatedInstancesCronSchedule,
      name: account.scanForDeprecatedInstancesMaintenanceWindowName
    });

    const deprecatedInstanceMaintenanceWindowTask = new ssm.CfnMaintenanceWindowTask(this, 'deprecatedInstanceMaintenanceWindowTask', {
      priority: 1,
      taskArn: buildDeprecatedInstancesLambda.functionArn,
      taskType: 'LAMBDA',
      windowId: deprecatedInstanceScanMaintenanceWindow.ref,
      description: 'Generates a report containing all instances not using the latest Tomcat and Apache AMIs located in Parameter Store',
      serviceRoleArn: lambdaExecutionRole.roleArn
    });


    const removeDeprecatedAmisMaintenanceWindow = new ssm.CfnMaintenanceWindow(this, 'removeDeprecatedAmisMaintenanceWindow', {
      allowUnassociatedTargets: false,
      cutoff: 0,
      duration: 2,
      schedule: account.removeDeprecatedAmisCronSchedule,
      name: account.removeDeprecatedAmisMaintenanceWindowName
    });

    const removeDeprecatedAMIsMaintenanceWindowTask = new ssm.CfnMaintenanceWindowTask(this, 'removeDeprecatedAMIsMaintenanceWindowTask', {
      priority: 1,
      taskArn: removeDeprecatedAMIsLambda.functionArn,
      taskType: 'LAMBDA',
      windowId: removeDeprecatedAmisMaintenanceWindow.ref,
      description: 'executes Lambda function to delete AMIs and Snapshots with the amiType:tomcat or amiType:apache and markedForDeletion:true tags',
      serviceRoleArn: lambdaExecutionRole.roleArn
    })
  }
}