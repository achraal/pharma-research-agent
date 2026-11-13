# Pharma Research Agent

Agentic assistant answering compound questions over a local pharmacology corpus (DailyMed / MedlinePlus).
**Technical exercise, not medical advice.**

## Architecture
```
Question -> Planner (JSON sub-questions)
         -> Agent loop (LLM + function calling, max N steps)
              tools: list_documents, search_corpus, get_section, lookup_glossary, compare_numeric
         -> Critic (checks grounding, rewrites answer, flags unsupported / ambiguous claims)
         -> Cited answer + disclaimer
```
Retrieval: heading-aware chunks, OpenAI embeddings, numpy cosine similarity in memory.

## Run
```bash
cp .env.example .env        # fill in the credentials
docker build -t agent .
docker run -p 8000:8000 --env-file .env agent
```
Open http://localhost:8000 (UI), `GET /health`, `POST /ask {"question": "..."}`.

## Local dev
```bash
pip install -r requirements-dev.txt
pytest
python scripts/evaluate.py
uvicorn app.main:app --reload
```
