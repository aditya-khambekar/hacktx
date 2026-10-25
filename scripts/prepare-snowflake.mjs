import nextEnv from "@next/env";
import { snowflakeQuery } from "../lib/snowflake.ts";

nextEnv.loadEnvConfig(process.cwd());
try {
  await snowflakeQuery(`CREATE TABLE IF NOT EXISTS UNLISTED_RESEARCH (
    PROPERTY_ID VARCHAR, PROFILE VARIANT, FETCHED_AT TIMESTAMP_LTZ
  )`);
  console.info("Snowflake research cache is ready. Existing data was kept.");
} catch (error) {
  const diagnostic = error instanceof Error && /^snowflake_[a-z_]+$/.test(error.message) ? error.message : "snowflake_setup_failed";
  console.error(diagnostic);
  console.error("Could not prepare the research cache. Check local SNOWFLAKE_* settings and CREATE TABLE permission on the configured schema.");
  process.exitCode = 1;
}
