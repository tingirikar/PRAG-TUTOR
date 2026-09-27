import os
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
# pyrefly: ignore [missing-import]
from sentence_transformers import SentenceTransformer

from document_processing import DocumentProcessor
from image_handler import ImageHandler
from response_generation import ResponseGenerator
from user_view import QueryProcessor
try:
    from agents import (
        CriticAgent,
        PedagogicalAgent,
        PrerequisiteAgent,
        RetrievalAgent,
        SupervisorAgent,
        TutorMultiAgentOrchestrator,
        VisualAgent,
    )
except ModuleNotFoundError:
    # Keep the core tutor available when the optional agent layer is absent.
    CriticAgent = None
    PedagogicalAgent = None
    PrerequisiteAgent = None
    RetrievalAgent = None
    SupervisorAgent = None
    TutorMultiAgentOrchestrator = None
    VisualAgent = None

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
load_dotenv(os.path.join(BASE_DIR, ".env"))

PINECONE_API_KEY = os.environ.get("PINECONE_API_KEY", "").strip()
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "").strip()
HF_API_KEY = os.environ.get("HF_API_KEY", "").strip()
IMAGES_DIR = os.path.join(UPLOAD_DIR, "images")
os.makedirs(IMAGES_DIR, exist_ok=True)

app = FastAPI(title="LPITutor Python RAG Service")

# Serve extracted and generated images as static files
app.mount("/images", StaticFiles(directory=IMAGES_DIR), name="images")


class QueryRequest(BaseModel):
    query: str = Field(min_length=1)
    subject: Optional[str] = "DSA"
    level: str = "beginner"
    history: List[Dict[str, str]] = Field(default_factory=list)
    include_image: bool = True
    model: Optional[str] = None
    provider: Optional[str] = None


class ImageRequest(BaseModel):
    query: str = Field(min_length=1)
    topic: str = ""
    mode: str = "notes"


class DocumentRequest(BaseModel):
    filename: str = Field(min_length=1)


class IndexRequest(BaseModel):
    filenames: List[str] = Field(default_factory=list)


print("Initializing Python RAG service...")
query_processor = QueryProcessor()

# Retry logic for embedding model loading
embedding_model = None
max_retries = 3
for attempt in range(max_retries):
    try:
        print(f"Loading embedding model (attempt {attempt + 1}/{max_retries})...")
        embedding_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
        print("Embedding model loaded successfully.")
        break
    except Exception as error:
        print(f"[Warning] Failed to load embedding model (attempt {attempt + 1}/{max_retries}): {error}")
        if attempt < max_retries - 1:
            print("Retrying in 5 seconds...")
            import time
            time.sleep(5)
        else:
            print("[Critical] Failed to load embedding model after all retries. The service will not function properly.")
            print("Possible causes: Insufficient memory, network issues, or corrupted model cache.")
            print("Try clearing the model cache or increasing available memory.")

try:
    document_processor = DocumentProcessor(
        pdf_dir=UPLOAD_DIR,
        vector_db_api_key=PINECONE_API_KEY,
        groq_api_key=GROQ_API_KEY,
    )
except Exception as error:
    print(f"[Warning] Failed to initialize document processor: {error}")
    document_processor = None

try:
    response_generator = ResponseGenerator(
        vector_db_api_key=PINECONE_API_KEY,
        llm_api_key=GROQ_API_KEY,
        documents_dir=UPLOAD_DIR,
    )
except Exception as error:
    print(f"[Warning] Failed to initialize response generator: {error}")
    response_generator = None

try:
    image_handler = ImageHandler(
        images_dir=IMAGES_DIR,
        hf_api_key=HF_API_KEY,
    )
except Exception as error:
    print(f"[Warning] Failed to initialize image handler: {error}")
    image_handler = None

orchestrator = None
try:
    supervisor = SupervisorAgent(
        groq_client=response_generator.groq_client if response_generator else None,
        documents_dir=UPLOAD_DIR,
    )
    prereq_agent = PrerequisiteAgent(
        prerequisites_data=response_generator.prerequisites_data if response_generator else {},
    )
    retrieval_agent = RetrievalAgent(
        pinecone_index=response_generator.index if response_generator else None,
        embedding_model=embedding_model,
        documents_dir=UPLOAD_DIR,
    )
    pedagogical_agent = PedagogicalAgent(
        groq_client=response_generator.groq_client if response_generator else None,
        model_name=getattr(response_generator, "model_name", "openai/gpt-oss-20b"),
    )
    visual_agent = VisualAgent(
        image_handler=image_handler,
    )
    critic_agent = CriticAgent(
        groq_client=response_generator.groq_client if response_generator else None,
        model_name=getattr(response_generator, "model_name", "openai/gpt-oss-20b"),
    )
    orchestrator = TutorMultiAgentOrchestrator(
        supervisor=supervisor,
        prerequisite_agent=prereq_agent,
        retrieval_agent=retrieval_agent,
        pedagogical_agent=pedagogical_agent,
        visual_agent=visual_agent,
        critic_agent=critic_agent,
    )
    print("Multi-Agent Orchestrator initialized successfully.")
except Exception as error:
    print(f"[Warning] Failed to initialize Multi-Agent Orchestrator: {error}")
    orchestrator = None


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "embedding_model": embedding_model is not None,
        "response_generator": response_generator is not None,
        "multi_agent": orchestrator is not None,
        "document_processor": document_processor is not None,
        "image_handler": image_handler is not None,
        "prerequisite_topics": len(response_generator.prerequisites_data) if response_generator else 0,
    }


@app.get("/rag/prerequisites")
def prerequisites() -> Dict[str, Any]:
    if not response_generator:
        raise HTTPException(status_code=503, detail="Response generator is unavailable.")
    return {
        "prerequisites": response_generator.prerequisites_data,
        "count": len(response_generator.prerequisites_data),
    }


@app.get("/rag/sample-questions")
def sample_questions(seed: str = Query(default="")) -> Dict[str, Any]:
    if not response_generator:
        raise HTTPException(status_code=503, detail="Response generator is unavailable.")
    return {"questions": response_generator.generate_sample_questions(seed)}


@app.post("/rag/query")
async def query(request: QueryRequest) -> Dict[str, Any]:
    if not embedding_model:
        raise HTTPException(
            status_code=503,
            detail="Embedding model is unavailable. Check server logs for details.",
        )
    if not response_generator and not orchestrator:
        raise HTTPException(
            status_code=503,
            detail="Response generator is unavailable. Configure PINECONE_API_KEY and GROQ_API_KEY.",
        )

    try:
        # Primary execution via Multi-Agent Orchestrator
        if orchestrator:
            return await orchestrator.run(
                query=request.query,
                level=request.level.lower(),
                history=request.history,
                include_image=request.include_image,
            )

        # Fallback to legacy single-pipeline response generator
        processed = query_processor.process_query(request.query, request.level.lower())
        query_embedding = embedding_model.encode(processed["query"])
        result = response_generator.respond_to_user(
            query_embedding,
            processed["level"],
            user_question=request.query,
            conversation_history=request.history,
            preferred_model=request.model,
            provider=request.provider,
            subject=request.subject,
        )
        response_text = getattr(result, "response", str(result))

        # Multi-modal: fetch images if requested
        images = []
        if request.include_image and image_handler:
            matches = response_generator.fetch_answer(query_embedding, top_k=5)
            images = image_handler.get_images(
                matches=matches,
                user_question=request.query,
                topic=getattr(result, "topic", None),
            )

        return {
            "response": response_text,
            "answer": response_text,
            "topic": getattr(result, "topic", None),
            "prerequisites": getattr(result, "prerequisites", []),
            "sources": getattr(result, "sources", []),
            "images": images,
            "model": getattr(result, "model", request.model or "openai/gpt-oss-20b"),
            "provider": getattr(result, "provider", request.provider or "groq"),
        }
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to generate response: {error}") from error


@app.get("/rag/models")
def get_available_models() -> Dict[str, Any]:
    """Return available online (Groq) and local (Ollama) LLM models."""
    cloud_models = [
        {"id": "openai/gpt-oss-20b", "name": "GPT-OSS 20B (Default)", "provider": "groq", "badge": "Cloud (Groq)"},
        {"id": "openai/gpt-oss-120b", "name": "GPT-OSS 120B", "provider": "groq", "badge": "Cloud (Groq)"},
        {"id": "qwen/qwen3.8-27b", "name": "Qwen 3.8 27B", "provider": "groq", "badge": "Cloud (Groq)"},
    ]

    local_models = []
    ollama_online = False
    if response_generator:
        try:
            import requests as req
            r = req.get(f"{response_generator.ollama_url}/api/tags", timeout=1.5)
            if r.status_code == 200:
                ollama_online = True
                for item in r.json().get("models", []):
                    m_name = item.get("name", "")
                    if m_name:
                        local_models.append({
                            "id": m_name,
                            "name": m_name,
                            "provider": "local",
                            "badge": "Local (Ollama)"
                        })
        except Exception:
            pass

    if not local_models:
        default_local = getattr(response_generator, "ollama_model", "llama3.2:3b") if response_generator else "llama3.2:3b"
        local_models.append({
            "id": default_local,
            "name": default_local,
            "provider": "local",
            "badge": "Local (Ollama)"
        })

    return {
        "cloud_models": cloud_models,
        "local_models": local_models,
        "ollama_online": ollama_online,
        "default": "openai/gpt-oss-20b",
        "default_provider": "groq"
    }


@app.post("/rag/images")
def images(request: ImageRequest) -> Dict[str, Any]:
    """Load diagrams separately so image verification never delays the answer."""
    if not embedding_model:
        raise HTTPException(status_code=503, detail="Embedding model is unavailable.")
    if not response_generator:
        raise HTTPException(status_code=503, detail="Response generator is unavailable.")
    if not image_handler:
        raise HTTPException(status_code=503, detail="Image handler is unavailable.")

    try:
        processed = query_processor.process_query(request.query, "beginner")
        query_embedding = embedding_model.encode(processed["query"])
        matches = response_generator.fetch_answer(query_embedding, top_k=5)
        result = image_handler.get_images(
            matches=matches,
            user_question=request.query,
            topic=request.topic or None,
            mode=request.mode,
        )
        return {"images": result}
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to load images: {error}") from error


@app.post("/rag/index")
def index_documents(request: IndexRequest = IndexRequest()) -> Dict[str, Any]:
    if not document_processor:
        raise HTTPException(status_code=503, detail="Document processor is unavailable.")
    try:
        # If specific filenames are provided, only process those
        if request.filenames:
            for filename in request.filenames:
                filepath = os.path.join(UPLOAD_DIR, filename)
                if os.path.exists(filepath):
                    document_processor.process_single_pdf(filepath)
        else:
            # Process all documents if no specific filenames provided
            document_processor.upload_to_vector_db()
        
        if response_generator:
            response_generator.reload_prerequisites()
            if orchestrator:
                orchestrator.reload_prerequisites(response_generator.prerequisites_data)
        return {
            "message": "Documents indexed successfully.",
            "prerequisite_topics": len(response_generator.prerequisites_data) if response_generator else 0,
        }
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to index documents: {error}") from error


@app.post("/rag/delete")
def delete_document(request: DocumentRequest) -> Dict[str, Any]:
    if not document_processor:
        raise HTTPException(status_code=503, detail="Document processor is unavailable.")
    try:
        result = document_processor.delete_document(request.filename)
        if response_generator:
            response_generator.reload_prerequisites()
            if orchestrator:
                orchestrator.reload_prerequisites(response_generator.prerequisites_data)
        return {
            "message": f"Document '{request.filename}' deleted successfully.",
            **result,
            "prerequisite_topics": len(response_generator.prerequisites_data) if response_generator else 0,
        }
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {error}") from error


@app.post("/rag/prerequisites/reload")
def reload_prerequisites() -> Dict[str, Any]:
    if not response_generator:
        raise HTTPException(status_code=503, detail="Response generator is unavailable.")
    prereqs = response_generator.reload_prerequisites()
    if orchestrator:
        orchestrator.reload_prerequisites(prereqs)
    return {
        "status": "ok",
        "count": len(prereqs),
        "prerequisites": prereqs,
    }
