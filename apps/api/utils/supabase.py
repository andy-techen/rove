import os

from fastapi import HTTPException
from supabase import create_client, Client


def get_supabase() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    return create_client(url, key)


def verify_user(sb: Client, token: str) -> str:
    """Returns user_id if token is valid, raises 401 otherwise."""
    try:
        result = sb.auth.get_user(token)
        return result.user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def check_and_insert_milestones(sb: Client, user_id: str, result: dict) -> None:
    existing = (
        sb.table("milestones")
        .select("type, value")
        .eq("user_id", user_id)
        .execute()
    )
    milestones_by_type = {m["type"]: m["value"] for m in (existing.data or [])}

    new_milestones = []

    if not milestones_by_type:
        new_milestones.append({"user_id": user_id, "type": "first_session", "value": "1"})

    current_highest = int(milestones_by_type.get("highest_note", "0") or "0")
    if result["highest_midi"] > current_highest:
        new_milestones.append({
            "user_id": user_id,
            "type": "highest_note",
            "value": str(result["highest_midi"]),
        })

    current_lowest = int(milestones_by_type.get("lowest_note", "999") or "999")
    if result["lowest_midi"] < current_lowest:
        new_milestones.append({
            "user_id": user_id,
            "type": "lowest_note",
            "value": str(result["lowest_midi"]),
        })

    current_range = int(milestones_by_type.get("range_record", "0") or "0")
    if result["range_semitones"] > current_range:
        new_milestones.append({
            "user_id": user_id,
            "type": "range_record",
            "value": str(result["range_semitones"]),
        })

    if new_milestones:
        sb.table("milestones").insert(new_milestones).execute()
