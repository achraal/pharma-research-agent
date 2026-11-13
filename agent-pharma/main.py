import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from app.agent import run_agent, stream_agent

app = FastAPI(
    title="Agentic Research Assistant - Pharma",
    description="API pour interroger le corpus pharmacologique local."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AskRequest(BaseModel):
    question: str

@app.get("/health")
def health_check():
    """Route exigée : vérifie que l'API est en ligne."""
    return {"status": "ok"}

@app.post("/ask")
def ask_question(request: AskRequest):
    """Route exigée : reçoit la question et retourne la réponse de l'agent."""
    try:
        answer = run_agent(request.question)
        return {"answer": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ask/stream")
def ask_question_stream(request: AskRequest):
    """Route dédiée au frontend React pour l'affichage en temps réel."""
    return StreamingResponse(
        stream_agent(request.question),
        media_type="application/x-ndjson"
    )

# Sert ton application React compilée dans Docker
if os.path.exists("frontend_dist"):
    app.mount("/", StaticFiles(directory="frontend_dist", html=True), name="frontend")