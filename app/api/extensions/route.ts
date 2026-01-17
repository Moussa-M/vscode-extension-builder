import { docClient, TABLE_NAME, PK, PutCommand, ScanCommand } from "@/lib/dynamo-db"
import { NextResponse } from "next/server"
import type { UserExtension } from "@/lib/types"

// GET all extensions for a user
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 })
    }

    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "userId = :userId AND itemType = :itemType",
        ExpressionAttributeValues: {
          ":userId": userId,
          ":itemType": "extension",
        },
      }),
    )

    const extensions = (result.Items || []) as UserExtension[]
    return NextResponse.json(extensions.sort((a, b) => b.updatedAt - a.updatedAt))
  } catch (error) {
    console.error("Error fetching extensions:", error)
    return NextResponse.json({ error: "Failed to fetch extensions" }, { status: 500 })
  }
}

// POST create/update extension
export async function POST(request: Request) {
  try {
    const extension: UserExtension & { userId: string } = await request.json()

    if (!extension.userId || !extension.id) {
      return NextResponse.json({ error: "userId and id required" }, { status: 400 })
    }

    const item = {
      [PK]: `${extension.userId}#${extension.id}`,
      userId: extension.userId,
      itemType: "extension",
      ...extension,
      updatedAt: Date.now(),
    }

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      }),
    )

    return NextResponse.json(extension, { status: 201 })
  } catch (error) {
    console.error("Error saving extension:", error)
    return NextResponse.json({ error: "Failed to save extension" }, { status: 500 })
  }
}
