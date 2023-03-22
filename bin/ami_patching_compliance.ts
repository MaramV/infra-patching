#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AmiPatchingComplianceStack } from '../lib/ami_patching_compliance-stack';
import * as fs from 'fs';
import * as path from 'path';
const yaml = require('js-yaml');
const app = new cdk.App();

const ctx = app.node.tryGetContext('config');
if (!ctx){
    throw new Error("Context variable missing on CDK command. Pass in as '-c config=otc{Environment}'");
}

const account = yaml.load(fs.readFileSync(path.resolve(`./accounts/${ctx}.yaml`), 'utf8')); 


new AmiPatchingComplianceStack(app, 'AmiPatchingComplianceStack', account, {
  env: {
    account: account.accountId,
    region: account.region
  }
});