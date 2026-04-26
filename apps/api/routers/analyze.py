import logging

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from utils.dsp import analyze_audio, download_to_tempfile, delete_tempfile
from utils.supabase import get_supabase, verify_user, check_and_insert_milestones

logger = logging.getLogger(__name__)

router = APIRouter()


class AnalyzeRequest(BaseModel):
    recording_id: str
    storage_path: str


@router.post("/analyze")
def analyze(body: AnalyzeRequest, authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = authorization.removeprefix("Bearer ")

    sb = get_supabase()
    caller_user_id = verify_user(sb, token)

    recording_row = (
        sb.table("recordings")
        .select("user_id")
        .eq("id", body.recording_id)
        .single()
        .execute()
    )
    if not recording_row.data or recording_row.data["user_id"] != caller_user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    tmp_path = None
    try:
        audio_bytes = sb.storage.from_("recordings").download(body.storage_path)
        tmp_path = download_to_tempfile(audio_bytes)

        result = analyze_audio(tmp_path)

        if result is None:
            sb.table("metrics").update({"analysis_status": "failed"}).eq(
                "recording_id", body.recording_id
            ).execute()
            return {"status": "failed", "reason": "no voiced frames detected"}

        sb.table("metrics").update({
            "lowest_note": result["lowest_note"],
            "highest_note": result["highest_note"],
            "lowest_midi": result["lowest_midi"],
            "highest_midi": result["highest_midi"],
            "range_semitones": result["range_semitones"],
            "analysis_status": "complete",
        }).eq("recording_id", body.recording_id).execute()

        check_and_insert_milestones(sb, caller_user_id, result)

        return {
            "status": "complete",
            "lowest_note": result["lowest_note"],
            "highest_note": result["highest_note"],
            "range_semitones": result["range_semitones"],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Analysis failed for recording %s", body.recording_id)
        try:
            sb.table("metrics").update({"analysis_status": "failed"}).eq(
                "recording_id", body.recording_id
            ).execute()
        except Exception:
            pass
        return {"status": "failed", "reason": str(e)}

    finally:
        if tmp_path:
            delete_tempfile(tmp_path)
