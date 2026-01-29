import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb"
import { awsCredentialsProvider } from "@vercel/functions/oidc"

export const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME
const PK = process.env.DYNAMODB_TABLE_PARTITION_KEY || "id"

// Lazy-initialize the client to avoid crashes during server startup
let _docClient: DynamoDBDocumentClient | null = null

function getDocClient(): DynamoDBDocumentClient {
  if (!_docClient) {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION,
      credentials: awsCredentialsProvider({
        roleArn: process.env.AWS_ROLE_ARN!,
        clientConfig: { region: process.env.AWS_REGION },
      }),
    })

    _docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: {
        removeUndefinedValues: true,
      },
    })
  }
  return _docClient
}

export const docClient = {
  send: <T>(command: T extends Parameters<DynamoDBDocumentClient["send"]>[0] ? T : never) => {
    return getDocClient().send(command)
  },
}

export { PutCommand, GetCommand, ScanCommand, DeleteCommand, QueryCommand, PK }
