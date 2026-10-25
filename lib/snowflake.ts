import "server-only";

type Binding = { type: "TEXT" | "FIXED"; value: string };
export function snowflakeConfigured(): boolean { return Boolean(process.env.SNOWFLAKE_ACCOUNT_HOST && process.env.SNOWFLAKE_TOKEN); }
/** SQL is authored by the application. All external values belong in bindings. */
export async function snowflakeQuery(statement: string, values: Binding[] = []): Promise<unknown[][]> {
  const host = process.env.SNOWFLAKE_ACCOUNT_HOST ?? "";
  const token = process.env.SNOWFLAKE_TOKEN;
  if (!/^[a-z0-9][a-z0-9.-]*\.snowflakecomputing\.com$/i.test(host) || !token) throw new Error("snowflake_not_configured");
  const context: Record<string, string> = {};
  for (const key of ["database", "schema", "warehouse", "role"]) {
    const value = process.env[`SNOWFLAKE_${key.toUpperCase()}`];
    if (!value || !/^[A-Za-z_][A-Za-z0-9_$]{0,127}$/.test(value)) throw new Error("snowflake_invalid_configuration");
    context[key] = value;
  }
  const tokenType = process.env.SNOWFLAKE_TOKEN_TYPE ?? "PROGRAMMATIC_ACCESS_TOKEN";
  if (!["PROGRAMMATIC_ACCESS_TOKEN", "OAUTH", "KEYPAIR_JWT"].includes(tokenType)) throw new Error("snowflake_invalid_configuration");
  const headers = { Authorization: `Bearer ${token}`, "X-Snowflake-Authorization-Token-Type": tokenType, "Content-Type": "application/json", Accept: "application/json", "User-Agent": "Unlisted/1.0" };
  const signal = AbortSignal.timeout(15000);
  async function request(path: string, body?: unknown) {
    const response = await fetch(`https://${host}/api/v2/statements${path}`, { method: body ? "POST" : "GET", headers, signal, redirect: "error", cache: "no-store", ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new Error("snowflake_request_failed");
    return { status: response.status, payload: await response.json() };
  }
  let result = await request("?async=true", { statement, ...context, timeout: 12, bindings: Object.fromEntries(values.map((value, i) => [String(i + 1), value])) });
  const handle = result.payload.statementHandle;
  const validHandle = typeof handle === "string" && /^[a-zA-Z0-9-]{1,128}$/.test(handle);
  while (result.status === 202) {
    if (!validHandle || signal.aborted) throw new Error("snowflake_request_failed");
    await new Promise((resolve) => setTimeout(resolve, 250));
    result = await request(`/${handle}`);
  }
  const partitions = result.payload.resultSetMetaData?.partitionInfo;
  const count = Array.isArray(partitions) ? partitions.length : 1;
  if (count > 16) throw new Error("snowflake_result_too_large");
  const rows: unknown[][] = [];
  for (let i = 0; i < count; i++) {
    const page = i === 0 && Array.isArray(result.payload.data) ? result.payload : validHandle ? (await request(`/${handle}?partition=${i}`)).payload : null;
    if (!page || !Array.isArray(page.data) || page.data.some((row: unknown) => !Array.isArray(row))) throw new Error("snowflake_invalid_result");
    rows.push(...page.data);
    if (rows.length > 5000) throw new Error("snowflake_result_too_large");
  }
  return rows;
}
