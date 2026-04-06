"""Users endpoints — profile and GDPR deletion."""
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.security import get_current_user
from app.core.database import get_db

router = APIRouter()


@router.get("/users/me")
async def get_profile(current_user=Depends(get_current_user)):
    db = get_db()
    response = (
        db.table("users")
        .select("*")
        .eq("id", str(current_user.id))
        .single()
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="User not found")
    return response.data


@router.delete("/users/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(current_user=Depends(get_current_user)):
    """
    GDPR Right to Deletion — soft delete + PII wipe.
    Calls delete_user_data() SQL function.
    """
    db = get_db()
    db.rpc("delete_user_data", {"user_uuid": str(current_user.id)}).execute()
    db.auth.admin.delete_user(str(current_user.id))
