import asyncio
from typing import Any


class EventBroker:
    """Single-process SSE broker. This broker is scoped to one running backend process."""
    def __init__(self) -> None:
        self._queues: set[asyncio.Queue] = set()
        self._loop: asyncio.AbstractEventLoop | None = None

    async def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._loop = asyncio.get_running_loop()
        self._queues.add(queue)
        return queue

    async def unsubscribe(self, queue: asyncio.Queue) -> None:
        self._queues.discard(queue)

    def publish(self, event_type: str, payload: dict[str, Any]) -> None:
        if not self._loop or not self._queues:
            return
        event = {"type": event_type, "payload": payload}
        self._loop.call_soon_threadsafe(self._broadcast, event)

    def _broadcast(self, event: dict[str, Any]) -> None:
        for queue in tuple(self._queues):
            if queue.full():
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                pass


event_broker = EventBroker()
