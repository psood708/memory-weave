import os

from memoryweave.api.app import app as app  # noqa: F401 — re-exported for uvicorn auto-discovery (Railway nixpacks)

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("memoryweave.api.app:app", host="0.0.0.0", port=port)
