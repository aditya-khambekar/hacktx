import { snowflakeQuery } from '../lib/snowflake.ts';
import { curatedApartmentData } from '../lib/curated-apartment-data.ts';

// Only the bundled public catalog is uploaded. No conversations, users, labels or boards.
await snowflakeQuery(`CREATE TABLE IF NOT EXISTS UNLISTED_FLOORPLANS (
  PROPERTY_ID VARCHAR, PLAN_ID VARCHAR, BEDS NUMBER, BATHS FLOAT,
  BASE_RENT NUMBER(12,2), RENT_BASIS VARCHAR, CATALOG_ROW VARIANT,
  UPDATED_AT TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
)`);
await snowflakeQuery(`CREATE TABLE IF NOT EXISTS UNLISTED_RESEARCH (
  PROPERTY_ID VARCHAR, PROFILE VARIANT, FETCHED_AT TIMESTAMP_LTZ
)`);
const rows = curatedApartmentData.flatMap(({ floorplans, ...property }) => floorplans.map(plan => ({ propertyId: property.id, planId: plan.id, beds: plan.beds, baths: plan.baths, baseRent: plan.baseRent, rentBasis: plan.rentBasis, property, plan })));
await snowflakeQuery(`MERGE INTO UNLISTED_FLOORPLANS target USING (
  SELECT value:propertyId::VARCHAR AS PROPERTY_ID, value:planId::VARCHAR AS PLAN_ID,
  value:beds::NUMBER AS BEDS, value:baths::FLOAT AS BATHS, value:baseRent::NUMBER(12,2) AS BASE_RENT,
  value:rentBasis::VARCHAR AS RENT_BASIS, value AS CATALOG_ROW
  FROM TABLE(FLATTEN(INPUT => PARSE_JSON(?)))
) source ON target.PROPERTY_ID = source.PROPERTY_ID AND target.PLAN_ID = source.PLAN_ID
WHEN MATCHED THEN UPDATE SET BEDS=source.BEDS, BATHS=source.BATHS, BASE_RENT=source.BASE_RENT,
RENT_BASIS=source.RENT_BASIS, CATALOG_ROW=source.CATALOG_ROW, UPDATED_AT=CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN INSERT (PROPERTY_ID,PLAN_ID,BEDS,BATHS,BASE_RENT,RENT_BASIS,CATALOG_ROW)
VALUES (source.PROPERTY_ID,source.PLAN_ID,source.BEDS,source.BATHS,source.BASE_RENT,source.RENT_BASIS,source.CATALOG_ROW)`, [{ type: 'TEXT', value: JSON.stringify(rows) }]);
console.log(`Seeded ${rows.length} floorplans from ${curatedApartmentData.length} public properties. Restart the app to load configuration.`);
