const crypto = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = process.env.TABLE_NAME;
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 5);
const RATE_LIMIT_WINDOW_SECONDS = Number(process.env.RATE_LIMIT_WINDOW_SECONDS || 3600);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

const response = (statusCode, body, origin) => {
  const headers = { "content-type": "application/json" };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers["vary"] = "Origin";
  }
  return { statusCode, headers, body: JSON.stringify(body) };
};

const getOrigin = (event) => event?.headers?.origin || event?.headers?.Origin || "";
const getPath = (event) => event?.rawPath || event?.path || event?.requestContext?.http?.path || "";
const getIp = (event) => {
  const forwarded = event?.headers?.["x-forwarded-for"] || event?.headers?.["X-Forwarded-For"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return event?.requestContext?.http?.sourceIp || event?.requestContext?.identity?.sourceIp || "";
};

const normalizeHandle = (handle) => {
  const normalized = String(handle || "").trim().replace(/^@/, "").toLowerCase();
  return /^[a-z0-9_]{1,15}$/.test(normalized) ? normalized : "";
};

const rateLimit = async (hash, now) => {
  if (!hash) return;
  const key = { pk: `ip#${hash}`, sk: "limit" };
  const existing = await client.send(new GetCommand({ TableName: TABLE_NAME, Key: key }));
  const item = existing.Item;
  if (item && item.ttl > now && item.count >= RATE_LIMIT_MAX) {
    const err = new Error("rate");
    err.code = 429;
    err.retry = item.ttl - now;
    throw err;
  }
  const withinWindow = item && item.ttl > now;
  const ttl = withinWindow ? item.ttl : now + RATE_LIMIT_WINDOW_SECONDS;
  const count = withinWindow ? (item.count || 0) + 1 : 1;
  await client.send(new PutCommand({ TableName: TABLE_NAME, Item: { ...key, count, ttl } }));
};

const listEntries = async () => {
  const result = await client.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: "begins_with(#pk, :p)",
      ExpressionAttributeNames: {
        "#pk": "pk",
        "#handle": "handle",
        "#submittedAt": "submittedAt",
        "#updatedAt": "updatedAt",
      },
      ExpressionAttributeValues: { ":p": "handle#" },
      ProjectionExpression: "#pk, #handle, #submittedAt, #updatedAt",
    })
  );
  const items = result.Items || [];
  return items
    .map((item) => ({
      handle: item.handle || String(item.pk || "").replace("handle#", ""),
      submittedAt: item.submittedAt,
      updatedAt: item.updatedAt,
    }))
    .sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
};

exports.handler = async (event) => {
  const origin = getOrigin(event);
  const path = getPath(event);
  const method = event?.requestContext?.http?.method || event?.httpMethod || "GET";

  try {
    if (!TABLE_NAME) {
      return response(500, { error: "Guestbook unavailable." }, origin);
    }
    if (path && !/\/guestbook$/.test(path)) {
      return response(404, { error: "Not found." }, origin);
    }
    if (method === "OPTIONS") return response(200, { ok: true }, origin);
    if (method === "GET") {
      const items = await listEntries();
      return response(200, { items, total: items.length }, origin);
    }
    if (method !== "POST") return response(405, { error: "Method not allowed" }, origin);

    let payload = {};
    if (event?.body) {
      const text = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
      try {
        payload = JSON.parse(text || "{}");
      } catch (error) {
        return response(400, { error: "Invalid JSON" }, origin);
      }
    }

    if (payload.company) return response(200, { ok: true }, origin);

    const handle = normalizeHandle(payload.handle);
    if (!handle) return response(400, { error: "Invalid handle" }, origin);

    const ipAddress = getIp(event);
    const hash = ipAddress ? crypto.createHash("sha256").update(ipAddress).digest("hex") : "";
    const now = Math.floor(Date.now() / 1000);

    try {
      await rateLimit(hash, now);
    } catch (error) {
      if (error.code === 429) {
        return response(429, { error: "Rate limited", retryAfter: Math.max(error.retry, 1) }, origin);
      }
      throw error;
    }

    const iso = new Date().toISOString();
    const key = { pk: `handle#${handle}`, sk: "profile" };
    let deduped = false;

    try {
      await client.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: { ...key, handle, submittedAt: iso, updatedAt: iso },
          ConditionExpression: "attribute_not_exists(pk)",
        })
      );
    } catch (error) {
      if (error.name !== "ConditionalCheckFailedException") {
        throw error;
      }
      deduped = true;
      await client.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: key,
          UpdateExpression: "set updatedAt = :u",
          ExpressionAttributeValues: { ":u": iso },
        })
      );
    }

    return response(200, { ok: true, handle, deduped }, origin);
  } catch (error) {
    console.error("Guestbook error", error);
    return response(500, { error: "Guestbook unavailable." }, origin);
  }
};
