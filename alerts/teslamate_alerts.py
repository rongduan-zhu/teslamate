import os
import time
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras
import requests


CHECK_INTERVAL_SECONDS = int(os.getenv("CHECK_INTERVAL_SECONDS", "300"))
STALE_OPEN_DRIVE_MINUTES = int(os.getenv("STALE_OPEN_DRIVE_MINUTES", "15"))
STALE_ONLINE_POSITION_MINUTES = int(os.getenv("STALE_ONLINE_POSITION_MINUTES", "180"))
ALERT_REPEAT_SECONDS = int(os.getenv("ALERT_REPEAT_SECONDS", "3600"))

NtfyUrl = os.getenv("ALERT_NTFY_URL", "").strip()
WebhookUrl = os.getenv("ALERT_WEBHOOK_URL", "").strip()
TeslaMateUrl = os.getenv("TESLAMATE_URL", "http://teslamate:4000").rstrip("/")

DB = {
    "host": os.environ["DATABASE_HOST"],
    "port": int(os.getenv("DATABASE_PORT", "5432")),
    "dbname": os.environ["DATABASE_NAME"],
    "user": os.environ["DATABASE_USER"],
    "password": os.environ["DATABASE_PASS"],
    "sslmode": os.getenv("DATABASE_SSL_MODE", "require"),
}

last_sent = {}


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def get_conn():
    return psycopg2.connect(**DB)


def query_rows(sql, params=None):
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params or {})
            return cur.fetchall()


def active_car_filter():
    return "coalesce(nullif(c.name, ''), 'car ' || c.id::text)"


def check_open_drive_stale():
    sql = f"""
    with open_drives as (
      select
        d.id,
        d.car_id,
        d.start_date,
        max(p.date) as last_position
      from drives d
      left join positions p on p.drive_id = d.id
      where d.end_date is null
        and d.start_date > now() - interval '24 hours'
      group by d.id, d.car_id, d.start_date
    )
    select
      {active_car_filter()} as car_name,
      od.id as drive_id,
      od.start_date,
      od.last_position,
      extract(epoch from (now() - coalesce(od.last_position, od.start_date))) / 60 as stale_minutes
    from open_drives od
    join cars c on c.id = od.car_id
    where coalesce(od.last_position, od.start_date)
          < now() - (%(minutes)s || ' minutes')::interval
    order by stale_minutes desc;
    """
    return query_rows(sql, {"minutes": STALE_OPEN_DRIVE_MINUTES})


def check_online_position_stale():
    sql = f"""
    with current_states as (
      select distinct on (s.car_id)
        s.car_id,
        s.state,
        s.start_date
      from states s
      order by s.car_id, s.start_date desc
    ),
    last_positions as (
      select car_id, max(date) as last_position
      from positions
      group by car_id
    )
    select
      {active_car_filter()} as car_name,
      cs.state,
      cs.start_date as state_since,
      lp.last_position,
      extract(epoch from (now() - coalesce(lp.last_position, cs.start_date))) / 60 as stale_minutes
    from current_states cs
    join cars c on c.id = cs.car_id
    left join last_positions lp on lp.car_id = cs.car_id
    left join car_settings settings on settings.id = c.settings_id
    where coalesce(settings.enabled, true)
      and nullif(c.name, '') is not null
      and cs.state = 'online'
      and coalesce(lp.last_position, cs.start_date)
          < now() - (%(minutes)s || ' minutes')::interval
    order by stale_minutes desc;
    """
    return query_rows(sql, {"minutes": STALE_ONLINE_POSITION_MINUTES})


def check_web_health_badge():
    try:
        response = requests.get(f"{TeslaMateUrl}/", timeout=20)
        response.raise_for_status()
    except Exception as exc:
        return [f"TeslaMate web health check failed: {exc}"]

    if "Health check failed" in response.text:
        return ["TeslaMate reports at least one car with failed API health"]

    return []


def send_alert(key, title, lines):
    if not lines:
        return

    now = time.time()
    if now - last_sent.get(key, 0) < ALERT_REPEAT_SECONDS:
        return

    body = "\n".join(lines)
    print(f"[{now_iso()}] ALERT {title}\n{body}", flush=True)

    if NtfyUrl:
        requests.post(
            NtfyUrl,
            data=body.encode("utf-8"),
            headers={
                "Title": title,
                "Priority": "high",
                "Tags": "warning,car",
            },
            timeout=20,
        ).raise_for_status()

    if WebhookUrl:
        requests.post(
            WebhookUrl,
            json={"title": title, "message": body, "timestamp": now_iso()},
            timeout=20,
        ).raise_for_status()

    last_sent[key] = now


def main():
    print(f"[{now_iso()}] TeslaMate alert sidecar started", flush=True)

    while True:
        try:
            drive_rows = check_open_drive_stale()
            send_alert(
                "open_drive_stale",
                "TeslaMate drive data may be stalled",
                [
                    (
                        f"{r['car_name']}: open drive #{r['drive_id']} has no position "
                        f"updates for {int(r['stale_minutes'])} minutes"
                    )
                    for r in drive_rows
                ],
            )

            online_rows = check_online_position_stale()
            send_alert(
                "online_position_stale",
                "TeslaMate vehicle data is stale",
                [
                    (
                        f"{r['car_name']}: state={r['state']}, last position "
                        f"{r['last_position']}, stale for {int(r['stale_minutes'])} minutes"
                    )
                    for r in online_rows
                ],
            )

            web_health = check_web_health_badge()
            send_alert(
                "teslamate_health_badge",
                "TeslaMate API health check failed",
                web_health,
            )
        except Exception as exc:
            print(f"[{now_iso()}] alert check failed: {exc}", flush=True)

        time.sleep(CHECK_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
