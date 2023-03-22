const { EC2Client, DescribeImagesCommand, DeregisterImageCommand, DeleteSnapshotCommand } = require("@aws-sdk/client-ec2");

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const ec2Client = new EC2Client();
const s3Client = new S3Client();

const s3Bucket = process.env.s3Bucket;
const tagKey = process.env.tagKey;
const tomcatTagValue = process.env.tomcatTagValue;
const apacheTagValue = process.env.apacheTagValue;
const deleteAmiTagKey = process.env.deleteAmiTagKey;
const deleteAmiTagValue = process.env.deleteAmiTagValue;

exports.handler = async (event) => {
    try{

        // Get Current date to append to CSV file
        var today = new Date();
        var dd = String(today.getDate()).padStart(2, '0');
        var mm = String(today.getMonth() + 1).padStart(2, '0');
        var yyyy = today.getFullYear();

        today = mm + '-' + dd + '-' + yyyy;
        
        // Define Parameters variable to lookup tomcat specific AMIs that are marked for deletion
        const tomcatAmiParams = {
            Filters: [
                {
                    Name: tagKey,
                    Values: [tomcatTagValue]
                },
                {
                    Name: deleteAmiTagKey,
                    Values: [deleteAmiTagValue]
                }
            ]
        };
        
        console.log("tomcat AMI Parameters:",tomcatAmiParams);
        console.log("tomcat key values:", tomcatAmiParams.Filters[0].Values);
        
        console.log("tomcat marked for deletion values:", tomcatAmiParams.Filters[1].Values);
        
        // Make our SDK Call to get the images that are filtered based on the Parameters based in through the tomcatAmiParams variable above.
        const tomcatAmis = await ec2Client.send(new DescribeImagesCommand(tomcatAmiParams));
        
        // Create an array to push our objects onto
        var tomcatAmiArray = [];
        
        // Build our objects that contain the AMI ID and Snapshot ID so we know which AMIs to deregister and which snapshots to delete.
        for (var x = 0; x < tomcatAmis.Images.length; x++){
            var tomcatAmiObj = {};
            tomcatAmiObj.imageId = tomcatAmis.Images[x].ImageId;
            tomcatAmiObj.snapshotId = tomcatAmis.Images[x].BlockDeviceMappings[0].Ebs.SnapshotId;
            tomcatAmiArray.push(tomcatAmiObj);
        }

        // Create CSV containing all AMIs that will be deleted.
        var tomcatCsvString = [
            [
                "AMI Id",
                "Snapshot Id"
            ], ...tomcatAmiArray.map(tomcatAmiInformation => [
                tomcatAmiInformation.imageId,
                tomcatAmiInformation.snapshotId
            ])
        ]
        .map(e => e.join(","))
        .join("\n");

        var tomcatBucketParams = ({
            Bucket: s3Bucket,
            Key: 'deleted-amis-report/tomcat/deleted-tomcat-amis-' + today + '.csv',
            ContentType: 'text/csv',
            Body: Buffer.from(tomcatCsvString, 'binary')
        });

        // Upload the report of deleted tomcat AMIs to the S3 bucket
        const uploadTomcatReport = await s3Client.send(new PutObjectCommand(tomcatBucketParams));
        
        // Loop through each object we pushed onto the tomcatAmiArray variable
        for (var y = 0; y < tomcatAmiArray.length; y++){
           
           // Get the value of the 'imageId' key from our tomcatAmiArray
            var deregisterTomcatAmiParams = {
                ImageId: tomcatAmiArray[y].imageId
            };
            
            // Make the SDK call to deregister the AMI based on the parameters passed in throug the 'deregisterTomcatAmiParams' variable above.
            const deregisterTomcatAmiCommand = await ec2Client.send(new DeregisterImageCommand(deregisterTomcatAmiParams));
            
            console.log("Deregister Tomcat Image Command Output:", deregisterTomcatAmiCommand);
            
            // Get the value of the 'snapshotId' key from our tomcatAmiArray
            var deleteTomcatSnapshotParams = {
                SnapshotId: tomcatAmiArray[y].snapshotId
            };
            
            // Make the SDK call to delete the snapshot that corresponded to the AMI in the object for the current interation of the for loop.
            const deleteTomcatSnapshotCommand = await ec2Client.send(new DeleteSnapshotCommand(deleteTomcatSnapshotParams));
            
            console.log("Delete Tomcat Snapshot Command Output", deleteTomcatSnapshotCommand);
        }
        
        // Define Parameters variable to lookup Apache specific AMIs that are marked for deletion
        const apacheAmiParams = {
            Filters: [
                {
                    Name: tagKey,
                    Values: [apacheTagValue]
                },
                {
                    Name: deleteAmiTagKey,
                    Values: [deleteAmiTagValue]
                }
            ]
        };
        
        // Make our SDK Call to get the images that are filtered based on the Parameters based in through the tomcatAmiParams variable above.
        const apacheAmis = await ec2Client.send(new DescribeImagesCommand(apacheAmiParams));
        
        // Create an array to push our objects onto
        var apacheAmiArray = [];
        
        // Build our objects that contain the AMI ID and Snapshot ID so we know which AMIs to deregister and which snapshots to delete.
        for (var x = 0; x < apacheAmis.Images.length; x++){
            var apacheAmiObj = {};
            apacheAmiObj.imageId = apacheAmis.Images[x].ImageId;
            apacheAmiObj.snapshotId = apacheAmis.Images[x].BlockDeviceMappings[0].Ebs.SnapshotId;
            apacheAmiArray.push(apacheAmiObj);
        }

        // Create CSV containing all AMIs that will be deleted.
        var apacheCsvString = [
            [
                "AMI Id",
                "Snapshot Id"
            ], ...apacheAmiArray.map(apacheAmiInformation => [
                apacheAmiInformation.imageId,
                apacheAmiInformation.snapshotId
            ])
        ]
        .map(e => e.join(","))
        .join("\n");

        var apacheBucketParams = ({
            Bucket: s3Bucket,
            Key: 'deleted-amis-report/apache/deleted-apache-amis-' + today + '.csv',
            ContentType: 'text/csv',
            Body: Buffer.from(apacheCsvString, 'binary')
        });

        // Upload the report of deleted apache AMIs to the S3 bucket
        const uploadApacheReport = await s3Client.send(new PutObjectCommand(apacheBucketParams));
        
        console.log("Apache AMI Array with Snapshot ID: ", apacheAmiArray);
        
        // Loop through each object we pushed onto the tomcatAmiArray variable
        for (var y = 0; y < apacheAmiArray.length; y++){
            
            // Get the value of the 'imageId' key from our tomcatAmiArray
            var deregisterApacheAmiParams = {
                ImageId: apacheAmiArray[y].imageId
            };
            
            // Make the SDK call to deregister the AMI based on the parameters passed in throug the 'deregisterTomcatAmiParams' variable above.
            const deregisterApacheAmiCommand = await ec2Client.send(new DeregisterImageCommand(deregisterApacheAmiParams));
            
            console.log("Deregister Apache Image Command Output:", deregisterApacheAmiCommand);
            
            // Get the value of the 'snapshotId' key from our tomcatAmiArray
            var deleteApacheSnapshotParams = {
                SnapshotId: apacheAmiArray[y].snapshotId
            };
            
            // Make the SDK call to delete the snapshot that corresponded to the AMI in the object for the current interation of the for loop.
            const deleteApacheSnapshotCommand = await ec2Client.send(new DeleteSnapshotCommand(deleteApacheSnapshotParams));
            
            console.log("Delete Apache Snapshot Command Output", deleteApacheSnapshotCommand);
        }
        
    } catch(err) {
        console.log('Error!');
        console.log(err, err.stack);
        return {
            statusCode: 200,
            body: []
        };
    }
};