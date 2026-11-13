import os
import time
from pathlib import Path
import chromadb
from openai import RateLimitError
from app.config import client, EMBEDDING_MODEL

# Resolve absolute path to the 'corpus' folder regardless of where uvicorn is launched
BASE_DIR = Path(__file__).resolve().parent.parent
CORPUS_DIR = BASE_DIR / "corpus"

# Strict in-memory ChromaDB client as required by the specification
chroma_client = chromadb.Client()
collection = chroma_client.get_or_create_collection(name="pharma_corpus")


def get_embeddings_with_retry(texts: list[str], retries: int = 5, delay: float = 3.0) -> list[list[float]]:
    """Calls the embedding API in a single batch with automatic retry on 429 RateLimitError."""
    for attempt in range(retries):
        try:
            response = client.embeddings.create(input=texts, model=EMBEDDING_MODEL)
            return [item.embedding for item in response.data]
        except RateLimitError:
            if attempt == retries - 1:
                raise
            print(f"[RATE LIMIT] Proxy in cooldown, retrying in {delay}s... ({attempt + 1}/{retries})")
            time.sleep(delay)
    return []


def ingest_corpus():
    """Indexes the .md files in memory upon startup with drug context preserved in every chunk."""
    if collection.count() > 0:
        return

    md_files = list(CORPUS_DIR.glob("*.md"))
    if not md_files:
        print(f"WARNING: No .md files found in {CORPUS_DIR}!")
        return

    all_chunks = []
    all_metadatas = []
    all_ids = []
    chunk_id = 0

    for file_path in md_files:
        filename = file_path.name
        content = file_path.read_text(encoding="utf-8")

        # Extract the main document title (first line, e.g., "# Warfarin (DailyMed label)")
        first_line = content.splitlines()[0].strip() if content.splitlines() else filename

        # Split by H2 headers
        sections = content.split("\n## ")
        for section in sections:
            if not section.strip():
                continue

            section_text = section if section.startswith("#") else f"## {section}"
            # Prepend document title & filename so every chunk retains the drug name for semantic search
            enriched_chunk = f"Document: {filename} | {first_line}\n{section_text.strip()}"

            all_chunks.append(enriched_chunk)
            all_metadatas.append({"source": filename})
            all_ids.append(f"chunk_{chunk_id}")
            chunk_id += 1

    if all_chunks:
        # Single batched request instead of 1 request per chunk
        all_embeddings = get_embeddings_with_retry(all_chunks)
        collection.add(
            documents=all_chunks,
            embeddings=all_embeddings,
            metadatas=all_metadatas,
            ids=all_ids
        )

    print(f"Indexed {chunk_id} chunks in memory from {len(md_files)} files in {CORPUS_DIR}")


# Run ingestion at startup
ingest_corpus()


def search_corpus(query: str) -> str:
    """Semantic search in the local pharmacology corpus."""
    print(f"[TOOL CALL] search_corpus(query='{query}')")
    query_emb = get_embeddings_with_retry([query])[0]
    results = collection.query(query_embeddings=[query_emb], n_results=5)

    docs = results.get("documents", [[]])[0]
    metas = results.get("metadatas", [[]])[0]

    passages = []
    for doc, meta in zip(docs, metas):
        passages.append(f"[Source File: {meta['source']}]\n{doc}")

    return "\n\n====================\n\n".join(passages) if passages else "No relevant documents found."


def lookup_glossary(term: str) -> str:
    """Look up the exact definition of a medical term in GLOSSARY.md."""
    print(f"📖 [TOOL CALL] lookup_glossary(term='{term}')")
    glossary_path = CORPUS_DIR / "GLOSSARY.md"
    if not glossary_path.exists():
        return "GLOSSARY.md file not found."

    content = glossary_path.read_text(encoding="utf-8")
    for section in content.split("\n\n"):
        if term.lower() in section.lower():
            return f"[Source File: GLOSSARY.md]\n{section.strip()}"
    return f"Term '{term}' not found in GLOSSARY.md."


TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "search_corpus",
            "description": "Search the local pharmacology corpus (DailyMed and MedlinePlus drug monographs) using semantic similarity.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The search query (e.g., 'warfarin contraindications' or 'metformin renal eGFR')."}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "lookup_glossary",
            "description": "Look up exact clinical or pharmacological terminology definitions in GLOSSARY.md.",
            "parameters": {
                "type": "object",
                "properties": {
                    "term": {"type": "string", "description": "The medical term or acronym to define."}
                },
                "required": ["term"]
            }
        }
    }
]

AVAILABLE_TOOLS = {
    "search_corpus": search_corpus,
    "lookup_glossary": lookup_glossary
}