import asyncio
import json
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from app.api.deps import get_current_user
from app.events.broker import event_broker
from app.models.user import User

router = APIRouter()


@router.get("/stream")
async def event_stream(request: Request, _: User = Depends(get_current_user)):
    queue = await event_broker.subscribe()

    async def generate():
        try:
            yield "event: connected\ndata: {}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=20)
                    yield f"event: {event['type']}\ndata: {json.dumps(event['payload'])}\n\n"
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            await event_broker.unsubscribe(queue)

    return StreamingResponse(generate(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no",
    })
