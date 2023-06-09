export interface amiPatchingConfig {
    readonly accountId: string,
    readonly region: string,
    readonly code: string,
    readonly vpcId: string,
    readonly subnetId: string,
    readonly subnetCidrBlock: string,
    readonly s3GatewayPrefixListId: string,
    readonly automationExecutionDocumentName: string,
    readonly tomcatPatchScanAutomationDocumentName: string,
    readonly apachePatchScanAutomationDocumentName: string,
    readonly automationDocumentIamRoleName: string,
    readonly maintenanceWindowIamRoleName: string,
    readonly scanForPatchesMaintenanceWindowName: string,
    readonly scanForPatchesWindowCronSchedule: string,
    readonly scanForDeprecatedInstancesMaintenanceWindowName: string,
    readonly scanForDeprecatedInstancesCronSchedule: string,
    readonly deprecatedInstanceFunctionName: string,
    readonly lambdaSDKLayerVersionArn: string,
    readonly removeDeprecatedAmisFunctionName: string,
    readonly removeDeprecatedAmisMaintenanceWindowName: string,
    readonly removeDeprecatedAmisCronSchedule: string,
    readonly removeDeprecatedAmisFunctionTagKey: string,
    readonly removeDeprecatedAmisFunctionTomcatTagValue: string,
    readonly removeDeprecatedAmisFunctionApacheTagValue: string,
    readonly deprecatedInstanceFunctionFilterName: string,
    readonly deprecatedInstanceFunctionTomcatFilterValue: string,
    readonly deprecatedInstanceFunctionApacheFilterValue: string,
    readonly removeDeprecatedAmisFunctionDeletionTagKey: string,
    readonly removeDeprecatedAmisFunctionDeletionTagValue: string
}