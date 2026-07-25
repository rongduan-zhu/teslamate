BEGIN;

CREATE TEMP TABLE repair_source_positions AS
WITH base AS (
  SELECT
    p.*,
    lag(p.date) OVER (PARTITION BY p.drive_id ORDER BY p.date, p.id) AS prev_date
  FROM positions p
  WHERE p.drive_id IN (1513, 1514)
),
marked AS (
  SELECT
    *,
    sum(
      CASE
        WHEN prev_date IS NULL OR date - prev_date > interval '5 minutes' THEN 1
        ELSE 0
      END
    ) OVER (PARTITION BY drive_id ORDER BY date, id) AS segment_no
  FROM base
)
SELECT * FROM marked;

CREATE TEMP TABLE repair_segments AS
WITH ranked AS (
  SELECT
    rsp.*,
    first_value(id) OVER w AS start_position_id,
    last_value(id) OVER w AS end_position_id,
    first_value(date) OVER w AS start_date,
    last_value(date) OVER w AS end_date,
    first_value(odometer) OVER w AS start_km,
    last_value(odometer) OVER w AS end_km,
    first_value(ideal_battery_range_km) OVER w AS start_ideal_range_km,
    last_value(ideal_battery_range_km) OVER w AS end_ideal_range_km,
    first_value(rated_battery_range_km) OVER w AS start_rated_range_km,
    last_value(rated_battery_range_km) OVER w AS end_rated_range_km,
    count(*) OVER w AS point_count,
    avg(outside_temp) OVER w AS outside_temp_avg,
    avg(inside_temp) OVER w AS inside_temp_avg,
    max(speed) OVER w AS speed_max,
    max(power) OVER w AS power_max,
    min(power) OVER w AS power_min
  FROM repair_source_positions rsp
  WINDOW w AS (
    PARTITION BY drive_id, segment_no
    ORDER BY date, id
    RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
  )
),
gps_distance AS (
  SELECT
    drive_id,
    segment_no,
    sum(
      CASE
        WHEN prev_latitude IS NULL THEN 0
        ELSE 2 * 6371 * asin(sqrt(
          power(sin(radians((latitude::float8 - prev_latitude::float8) / 2)), 2) +
          cos(radians(prev_latitude::float8)) *
          cos(radians(latitude::float8)) *
          power(sin(radians((longitude::float8 - prev_longitude::float8) / 2)), 2)
        ))
      END
    ) AS gps_km
  FROM (
    SELECT
      rsp.*,
      lag(latitude) OVER (PARTITION BY drive_id, segment_no ORDER BY date, id) AS prev_latitude,
      lag(longitude) OVER (PARTITION BY drive_id, segment_no ORDER BY date, id) AS prev_longitude
    FROM repair_source_positions rsp
  ) p
  GROUP BY drive_id, segment_no
)
SELECT DISTINCT
  r.drive_id AS source_drive_id,
  r.segment_no,
  r.car_id,
  r.start_position_id,
  r.end_position_id,
  r.start_date,
  r.end_date,
  r.outside_temp_avg::numeric(4,1) AS outside_temp_avg,
  r.inside_temp_avg::numeric(4,1) AS inside_temp_avg,
  r.speed_max,
  r.power_max,
  r.power_min,
  coalesce(r.start_ideal_range_km, -1) AS start_ideal_range_km,
  coalesce(r.end_ideal_range_km, -1) AS end_ideal_range_km,
  coalesce(r.start_rated_range_km, -1) AS start_rated_range_km,
  coalesce(r.end_rated_range_km, -1) AS end_rated_range_km,
  r.start_km,
  r.end_km,
  CASE
    WHEN r.start_km IS NOT NULL AND r.end_km IS NOT NULL AND r.end_km >= r.start_km
      THEN r.end_km - r.start_km
    ELSE gd.gps_km
  END AS distance,
  round(extract(epoch from (r.end_date - r.start_date)) / 60)::integer AS duration_min,
  r.point_count
FROM ranked r
JOIN gps_distance gd
  ON gd.drive_id = r.drive_id
 AND gd.segment_no = r.segment_no
WHERE r.point_count >= 2
  AND r.end_date > r.start_date
  AND (
    (r.start_km IS NOT NULL AND r.end_km IS NOT NULL AND r.end_km - r.start_km >= 0.01)
    OR gd.gps_km >= 0.01
  );

CREATE TEMP TABLE repair_drive_map (
  source_drive_id integer NOT NULL,
  segment_no integer NOT NULL,
  new_drive_id integer NOT NULL
);

INSERT INTO repair_drive_map (source_drive_id, segment_no, new_drive_id)
SELECT source_drive_id, segment_no, source_drive_id
FROM repair_segments
WHERE segment_no = 1;

WITH inserted AS (
  INSERT INTO drives (
    start_date,
    end_date,
    outside_temp_avg,
    inside_temp_avg,
    speed_max,
    power_max,
    power_min,
    start_ideal_range_km,
    end_ideal_range_km,
    start_rated_range_km,
    end_rated_range_km,
    start_km,
    end_km,
    distance,
    duration_min,
    ascent,
    descent,
    car_id,
    start_position_id,
    end_position_id,
    notes
  )
  SELECT
    start_date,
    end_date,
    outside_temp_avg,
    inside_temp_avg,
    speed_max,
    power_max,
    power_min,
    start_ideal_range_km,
    end_ideal_range_km,
    start_rated_range_km,
    end_rated_range_km,
    start_km,
    end_km,
    distance,
    duration_min,
    0,
    0,
    car_id,
    start_position_id,
    end_position_id,
    ''
  FROM repair_segments
  WHERE segment_no > 1
  ORDER BY source_drive_id, segment_no
  RETURNING id, start_date
)
INSERT INTO repair_drive_map (source_drive_id, segment_no, new_drive_id)
SELECT rs.source_drive_id, rs.segment_no, inserted.id
FROM inserted
JOIN repair_segments rs USING (start_date);

UPDATE drives d
SET
  start_date = rs.start_date,
  end_date = rs.end_date,
  outside_temp_avg = rs.outside_temp_avg,
  inside_temp_avg = rs.inside_temp_avg,
  speed_max = rs.speed_max,
  power_max = rs.power_max,
  power_min = rs.power_min,
  start_ideal_range_km = rs.start_ideal_range_km,
  end_ideal_range_km = rs.end_ideal_range_km,
  start_rated_range_km = rs.start_rated_range_km,
  end_rated_range_km = rs.end_rated_range_km,
  start_km = rs.start_km,
  end_km = rs.end_km,
  distance = rs.distance,
  duration_min = rs.duration_min,
  ascent = 0,
  descent = 0,
  start_position_id = rs.start_position_id,
  end_position_id = rs.end_position_id
FROM repair_segments rs
WHERE d.id = rs.source_drive_id
  AND rs.segment_no = 1;

UPDATE positions p
SET drive_id = rdm.new_drive_id
FROM repair_source_positions rsp
JOIN repair_drive_map rdm
  ON rdm.source_drive_id = rsp.drive_id
 AND rdm.segment_no = rsp.segment_no
WHERE p.id = rsp.id
  AND p.drive_id <> rdm.new_drive_id;

SELECT
  source_drive_id,
  count(*) AS repaired_segments,
  min(new_drive_id) AS first_drive_id,
  max(new_drive_id) AS last_drive_id
FROM repair_drive_map
GROUP BY source_drive_id
ORDER BY source_drive_id;

COMMIT;
