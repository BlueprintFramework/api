CREATE VIEW "public"."telemetry_panels_with_latest" AS (select "telemetry_panels"."id", "telemetry_panels"."created", "telemetry_panels"."last_update", "latest"."panel_id", "latest_telemetry_data_id" from "telemetry_panels" left join (select "panel_id", max("id") as "latest_telemetry_data_id" from "telemetry_data" group by "telemetry_data"."panel_id") "latest" on "telemetry_panels"."id" = latest.panel_id);