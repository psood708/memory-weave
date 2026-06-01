from dotenv import load_dotenv
load_dotenv(override=False)  # override=False: real env vars (prod/Docker/CI) take precedence over .env

import os
import uvicorn

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("memoryweave.api.app:app", host="0.0.0.0", port=port)
