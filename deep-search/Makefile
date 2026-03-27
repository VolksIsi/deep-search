install:
	@command -v uv >/dev/null 2>&1 || { echo "uv is not installed. Installing uv..."; curl -LsSf https://astral.sh/uv/0.6.12/install.sh | sh; source $HOME/.local/bin/env; }
	uv sync && npm --prefix frontend install

dev:
	make dev-backend & make dev-frontend

dev-backend:
	uv run adk api_server app --allow_origins="*"

dev-frontend:
	npm --prefix frontend run dev

playground:
	uv run adk web --port 8501

lint:
	uv sync --dev --extra lint
	uv run codespell
	uv run ruff check . --diff
	uv run ruff format . --check --diff
	uv run mypy .

# --- Commands from Agent Starter Pack ---

backend: deploy

deploy:
	# Export dependencies to requirements file using uv export.
	(uv export --no-hashes --no-header --no-dev --no-emit-project --no-annotate > app/app_utils/.requirements.txt 2>/dev/null || \
	uv export --no-hashes --no-header --no-dev --no-emit-project > app/app_utils/.requirements.txt) && \
	uv run -m app.app_utils.deploy \
		--source-packages=./app \
		--entrypoint-module=app.agent_engine_app \
		--entrypoint-object=agent_engine \
		--requirements-file=app/app_utils/.requirements.txt \
		$(if $(AGENT_IDENTITY),--agent-identity)

eval:
	@echo "==============================================================================="
	@echo "| Running Agent Evaluation                                                    |"
	@echo "==============================================================================="
	uv sync --dev --extra eval
	uv run adk eval ./app $${EVALSET:-tests/eval/evalsets/basic.evalset.json} \
		$(if $(EVAL_CONFIG),--config_file_path=$(EVAL_CONFIG),$(if $(wildcard tests/eval/eval_config.json),--config_file_path=tests/eval/eval_config.json,))

eval-all:
	@echo "==============================================================================="
	@echo "| Running All Evalsets                                                        |"
	@echo "==============================================================================="
	@for evalset in tests/eval/evalsets/*.evalset.json; do \
		echo ""; \
		echo "▶ Running: $$evalset"; \
		$(MAKE) eval EVALSET=$$evalset || exit 1; \
	done
	@echo ""
	@echo "✅ All evalsets completed"

register-gemini-enterprise:
	@uvx agent-starter-pack@0.38.0 register-gemini-enterprise

test:
	uv sync --dev
	uv run pytest tests/unit && uv run pytest tests/integration

# --- Docker ---
docker-build:
	docker build -t allmighty-deep-search .

docker-run:
	docker run -p 8080:8080 \
		-e GOOGLE_API_KEY=$${GOOGLE_API_KEY} \
		-e ENABLE_SCHEDULER=true \
		-e ENABLE_COMPETITIVE_INTEL=true \
		-v $$(pwd)/data:/app/data \
		allmighty-deep-search

# --- Cloud Run Deployment ---
cloud-deploy:
	gcloud builds submit --config=cloudbuild.yaml .

cloud-run-direct:
	gcloud run deploy allmighty-deep-search \
		--source . \
		--region us-central1 \
		--allow-unauthenticated \
		--memory 2Gi \
		--cpu 2 \
		--timeout 3600 \
		--set-env-vars "GOOGLE_CLOUD_PROJECT=$${GOOGLE_CLOUD_PROJECT},ENABLE_SCHEDULER=true,ENABLE_COMPETITIVE_INTEL=true"
