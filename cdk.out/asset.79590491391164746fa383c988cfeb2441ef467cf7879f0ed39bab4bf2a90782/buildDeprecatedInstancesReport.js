const { EC2Client, DescribeInstancesCommand, DescribInstanceAttributeCommand } = require("@aws-sdk/client-ec2");
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const ec2Client = new EC2Client();
const ssmClient = new SSMClient();
const s3Client = new S3Client();

const s3Bucket = process.env.s3Bucket;
const filterName = process.env.filterName;
const tomcatFilterValue = process.env.deprecatedInstanceFunctionTomcatFilterValue;
const apacheFilterValue = process.env.deprecatedInstanceFunctionApacheFilterValue;

exports.handler = async (event, context, callback) => {
    try{
        
        // Get Current date to append to CSV file
        var today = new Date();
        var dd = String(today.getDate()).padStart(2, '0');
        var mm = String(today.getMonth() + 1).padStart(2, '0');
        var yyyy = today.getFullYear();

        today = mm + '-' + dd + '-' + yyyy;
        
        const tomcatAmiIdParameterParams = {
            Name: "/amiPatching/tomcat/tomcatAmiId"
        };
        
        const tomcatAmiId = await ssmClient.send(new GetParameterCommand(tomcatAmiIdParameterParams));
        
        const tomcatInstanceIdParams = {
            DryRun: false,
            Filters: [
                {
                    Name: filterName,
                    Values: [
                        tomcatFilterValue
                    ]
                }
            ],
        };
        
        // Get a list of all existing instances in the account.
        const describeTomcatInstances = await ec2Client.send(new DescribeInstancesCommand(tomcatInstanceIdParams));
        
        var deprecatedTomcatInstancesArray = [];
        
        // Loop through the returned instances and compare the ImageId to the Tomcat AMI ID in Parameter Store.
        for (var x = 0; x < describeTomcatInstances.Reservations.length; x++){
            
            var deprecatedTomcatInstanceObj = {};
            // If the Image Id doesn't match what the Tomcat AMI ID value is in Parameter Store, build the object containing information on the deprecated instance.
            if (describeTomcatInstances.Reservations[x].Instances[0].ImageId != tomcatAmiId.Parameter.Value){
                deprecatedTomcatInstanceObj.instanceId = describeTomcatInstances.Reservations[x].Instances[0].InstanceId;
                deprecatedTomcatInstanceObj.amiId = describeTomcatInstances.Reservations[x].Instances[0].ImageId;
                deprecatedTomcatInstanceObj.launchTime = describeTomcatInstances.Reservations[x].Instances[0].LaunchTime;
                
                // Loop through the tags to get the friendly name of the instance.
                for(var j = 0; j < describeTomcatInstances.Reservations[x].Instances[0].Tags.length; j++){
                    if (describeTomcatInstances.Reservations[x].Instances[0].Tags[j].Key == 'Name'){
                        deprecatedTomcatInstanceObj.instanceName = describeTomcatInstances.Reservations[x].Instances[0].Tags[j].Value;
                    }
                }
            } else{
                continue;
            }
            
            
            deprecatedTomcatInstancesArray.push(deprecatedTomcatInstanceObj);
        }
        
        const tomcatCsvString = [
            [
                "Instance Name",
                "Instance Id",
                "Image Id",
                "Launch Time"
            ],
            ...deprecatedTomcatInstancesArray.map(instanceInformation => [
                instanceInformation.instanceName,
                instanceInformation.instanceId,
                instanceInformation.amiId,
                instanceInformation.launchTime
            ])
        ]
        .map(e => e.join(","))
        .join("\n");
        
        
        var tomcatBucketParams = ({
            Bucket: s3Bucket,
            Key: 'deprecated-instance-reports/tomcat/deprecated-tomcat-instances-' + today + '.csv',
            ContentType: 'text/csv',
            Body: Buffer.from(tomcatCsvString, 'binary')
        });
        
        const uploadTomcatReportToBucket = await s3Client.send(new PutObjectCommand(tomcatBucketParams));
        
        const apacheAmiIdParameterParams = {
            Name: "/amiPatching/apache/apacheAmiId"
        };
        
        const apacheAmiId = await ssmClient.send(new GetParameterCommand(apacheAmiIdParameterParams));
        
        const apacheInstanceIdParams = {
            DryRun: false,
            Filters: [
                {
                    Name: filterName,
                    Values: [
                        apacheFilterValue
                    ]
                }
            ],
        };
    
        // Get a list of all existing instances in the account.
        const describeApacheInstances = await ec2Client.send(new DescribeInstancesCommand(apacheInstanceIdParams));
        
        var deprecatedApacheInstancesArray = [];
        
        // Loop through the returned instances and compare the ImageId to the Apache AMI ID in Parameter Store.
        for (var x = 0; x < describeApacheInstances.Reservations.length; x++){
            
            var deprecatedApacheInstanceObj = {};
            // If the Image Id doesn't match what the Apache AMI ID value is in Parameter Store, build the object containing information on the deprecated instance.
            if (describeApacheInstances.Reservations[x].Instances[0].ImageId != apacheAmiId.Parameter.Value){
                deprecatedApacheInstanceObj.instanceId = describeApacheInstances.Reservations[x].Instances[0].InstanceId;
                deprecatedApacheInstanceObj.amiId = describeApacheInstances.Reservations[x].Instances[0].ImageId;
                deprecatedApacheInstanceObj.launchTime = describeApacheInstances.Reservations[x].Instances[0].LaunchTime;
                
                // Loop through the tags to get the friendly name of the instance.
                for(var k = 0; k < describeApacheInstances.Reservations[x].Instances[0].Tags.length; k++){
                    if (describeApacheInstances.Reservations[x].Instances[0].Tags[k].Key == 'Name'){
                        deprecatedApacheInstanceObj.instanceName = describeApacheInstances.Reservations[x].Instances[0].Tags[k].Value;
                    }
                }
            } else{
                continue;
            }
            
            deprecatedApacheInstancesArray.push(deprecatedApacheInstanceObj);
        }
        
        const apacheCsvString = [
            [
                "Instance Name",
                "Instance Id",
                "Image Id",
                "Launch Time"
            ],
            ...deprecatedApacheInstancesArray.map(instanceInformation => [
                instanceInformation.instanceName,
                instanceInformation.instanceId,
                instanceInformation.amiId,
                instanceInformation.launchTime
            ])
        ]
        .map(e => e.join(","))
        .join("\n");
        
        
        var apacheBucketParams = ({
            Bucket: s3Bucket,
            Key: 'deprecated-instance-reports/apache/deprecated-apache-instances-' + today + '.csv',
            ContentType: 'text/csv',
            Body: Buffer.from(apacheCsvString, 'binary')
        });
        
        const uploadApacheReportToBucket = await s3Client.send(new PutObjectCommand(apacheBucketParams));
        
        
    } catch(err) {
        console.log('Whole Error!');
        console.log(err, err.stack);
        return {
            statusCode: 200,
            body: []
        };
    }
};