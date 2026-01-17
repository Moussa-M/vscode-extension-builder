import { docClient, TABLE_NAME, PK, GetCommand, DeleteCommand } from "@/lib/dynamo-db"
import { NextResponse } from "next/server"

// GET single extension
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 })
    }

    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { [PK]: `${userId}#${id}` },
      }),
    )

    if (!result.Item) {
      return NextResponse.json({ error: "Extension not found" }, { status: 404 })
    }

    return NextResponse.json(result.Item)
  } catch (error) {
    console.error("Error fetching extension:", error)
    return NextResponse.json({ error: "Failed to fetch extension" }, { status: 500 })
  }
}

// DELETE extension
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 })
    }

    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { [PK]: `${userId}#${id}` },
      }),
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting extension:", error)
    return NextResponse.json({ error: "Failed to delete extension" }, { status: 500 })
  }
}
