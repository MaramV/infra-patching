"use strict";Object.defineProperty(exports,"__esModule",{value:!0}),exports.handler=void 0;const AWS=require("aws-sdk");async function createLogGroupSafe(logGroupName,region,options){let retryCount=options?.maxRetries==null?10:options.maxRetries;const delay=options?.retryOptions?.base==null?10:options.retryOptions.base;do try{await new AWS.CloudWatchLogs({apiVersion:"2014-03-28",region,...options}).createLogGroup({logGroupName}).promise();return}catch(error){if(error.code==="ResourceAlreadyExistsException")return;if(error.code==="OperationAbortedException")if(retryCount>0){retryCount--,await new Promise(resolve=>setTimeout(resolve,delay));continue}else throw new Error("Out of attempts to create a logGroup");throw error}while(!0)}async function setRetentionPolicy(logGroupName,region,options,retentionInDays){let retryCount=options?.maxRetries==null?10:options.maxRetries;const delay=options?.retryOptions?.base==null?10:options.retryOptions.base;do try{const cloudwatchlogs=new AWS.CloudWatchLogs({apiVersion:"2014-03-28",region,...options});retentionInDays?await cloudwatchlogs.putRetentionPolicy({logGroupName,retentionInDays}).promise():await cloudwatchlogs.deleteRetentionPolicy({logGroupName}).promise();return}catch(error){if(error.code==="OperationAbortedException")if(retryCount>0){retryCount--,await new Promise(resolve=>setTimeout(resolve,delay));continue}else throw new Error("Out of attempts to create a logGroup");throw error}while(!0)}async function handler(event,context){try{console.log(JSON.stringify({...event,ResponseURL:"..."}));const logGroupName=event.ResourceProperties.LogGroupName,logGroupRegion=event.ResourceProperties.LogGroupRegion,retryOptions=parseRetryOptions(event.ResourceProperties.SdkRetry);if((event.RequestType==="Create"||event.RequestType==="Update")&&(await createLogGroupSafe(logGroupName,logGroupRegion,retryOptions),await setRetentionPolicy(logGroupName,logGroupRegion,retryOptions,parseInt(event.ResourceProperties.RetentionInDays,10)),event.RequestType==="Create")){const region=process.env.AWS_REGION;await createLogGroupSafe(`/aws/lambda/${context.functionName}`,region,retryOptions),await setRetentionPolicy(`/aws/lambda/${context.functionName}`,region,retryOptions,1)}await respond("SUCCESS","OK",logGroupName)}catch(e){console.log(e),await respond("FAILED",e.message,event.ResourceProperties.LogGroupName)}function respond(responseStatus,reason,physicalResourceId){const responseBody=JSON.stringify({Status:responseStatus,Reason:reason,PhysicalResourceId:physicalResourceId,StackId:event.StackId,RequestId:event.RequestId,LogicalResourceId:event.LogicalResourceId,Data:{LogGroupName:event.ResourceProperties.LogGroupName}});console.log("Responding",responseBody);const parsedUrl=require("url").parse(event.ResponseURL),requestOptions={hostname:parsedUrl.hostname,path:parsedUrl.path,method:"PUT",headers:{"content-type":"","content-length":responseBody.length}};return new Promise((resolve,reject)=>{try{const request=require("https").request(requestOptions,resolve);request.on("error",reject),request.write(responseBody),request.end()}catch(e){reject(e)}})}function parseRetryOptions(rawOptions){const retryOptions={};return rawOptions&&(rawOptions.maxRetries&&(retryOptions.maxRetries=parseInt(rawOptions.maxRetries,10)),rawOptions.base&&(retryOptions.retryOptions={base:parseInt(rawOptions.base,10)})),retryOptions}}exports.handler=handler;
//# sourceMappingURL=index.js.map
