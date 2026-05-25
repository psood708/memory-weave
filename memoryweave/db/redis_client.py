import redis.asyncio as aioredis

from memoryweave.core.config import settings

_redis: aioredis.Redis | None = None


async def init_redis() -> None:
    global _redis
    if settings.redis_url:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)


async def close_redis() -> None:
    if _redis:
        await _redis.aclose()


def get_redis() -> aioredis.Redis | None:
    return _redis
