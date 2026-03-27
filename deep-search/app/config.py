# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

# Load environment variables from .env file in the app directory
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

# Authentication Configuration:
# By default, uses AI Studio with GOOGLE_API_KEY from .env file.
# To use Vertex AI instead, set GOOGLE_GENAI_USE_VERTEXAI=TRUE in your .env
# and ensure you have Google Cloud credentials configured.

if os.getenv("GOOGLE_API_KEY"):
    # AI Studio mode (default): Use API key authentication
    os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "False")
else:
    # Vertex AI mode: Fall back to Google Cloud credentials
    import google.auth

    _, project_id = google.auth.default()
    os.environ.setdefault("GOOGLE_CLOUD_PROJECT", project_id)
    os.environ["GOOGLE_CLOUD_LOCATION"] = "global"
    os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "True")


@dataclass
class ResearchConfiguration:
    """Configuration for the Allmighty Deep Search platform.

    Attributes:
        critic_model (str): Model for evaluation tasks.
        worker_model (str): Model for working/generation tasks.
        max_search_iterations (int): Maximum search iterations allowed.
        mcp_servers (list[str]): List of MCP server URLs or paths.
        data_dir (Path): Directory for uploaded documents (RAG).
        memory_db_path (Path): Path to the SQLite memory database.
        enable_scheduler (bool): Whether to enable the report scheduler.
        enable_competitive_intel (bool): Whether to enable competitive intelligence.
        max_parallel_workers (int): Number of parallel research workers.
        gcp_project_id (str): Google Cloud project ID for deployment.
        gcp_region (str): Google Cloud region for deployment.
    """

    critic_model: str = os.getenv("CRITIC_MODEL", "gemini-2.0-flash")
    worker_model: str = os.getenv("WORKER_MODEL", "gemini-2.0-flash")
    max_search_iterations: int = int(os.getenv("MAX_SEARCH_ITERATIONS", "5"))
    max_parallel_workers: int = int(os.getenv("MAX_PARALLEL_WORKERS", "3"))
    data_dir: Path = Path(os.getenv("DATA_DIR", "./data"))
    memory_db_path: Path = Path(os.getenv("MEMORY_DB_PATH", "./data/memory.db"))
    enable_scheduler: bool = os.getenv("ENABLE_SCHEDULER", "false").lower() == "true"
    enable_competitive_intel: bool = os.getenv("ENABLE_COMPETITIVE_INTEL", "false").lower() == "true"
    gcp_project_id: str = os.getenv("GCP_PROJECT_ID", "")
    gcp_region: str = os.getenv("GCP_REGION", "us-central1")

    def __post_init__(self) -> None:
        mcp_env = os.getenv("MCP_SERVERS", "")
        self.mcp_servers: list[str] = [s.strip() for s in mcp_env.split(",") if s.strip()] if mcp_env else []


# Create data directory if it doesn't exist
config = ResearchConfiguration()
config.data_dir.mkdir(parents=True, exist_ok=True)
