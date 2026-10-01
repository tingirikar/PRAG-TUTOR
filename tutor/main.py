import os
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
# pyrefly: ignore [missing-import]
from sentence_transformers import SentenceTransformer

from document_processing import DocumentProcessor
from image_handler import ImageHandler
from response_generation import ResponseGenerator
from user_view import QueryProcessor

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))

# Project-wide shared uploads directory: prag_tutor/uploads
UPLOAD_DIR = os.path.join(PROJECT_ROOT, "uploads")
if not os.path.exists(UPLOAD_DIR) and os.path.exists(os.path.join(BASE_DIR, "uploads")):
    UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Load root .env first, then local .env
load_dotenv(os.path.join(PROJECT_ROOT, ".env"))
load_dotenv(os.path.join(BASE_DIR, ".env"))

PINECONE_API_KEY = os.environ.get("PINECONE_API_KEY", "").strip()
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "").strip()
HF_API_KEY = os.environ.get("HF_API_KEY", "").strip()
app = FastAPI(title="LPITutor Python RAG Service")


@app.get("/images/{image_path:path}")
def serve_image(image_path: str):
    """Serves isolated subject images (uploads/{subject}/images/...) as well as legacy image paths."""
    if ".." in image_path:
        raise HTTPException(status_code=400, detail="Invalid image path")

    # 1. Exact relative path inside UPLOAD_DIR (e.g. dsa/images/safe_name/img.png)
    candidate = os.path.join(UPLOAD_DIR, image_path)
    if os.path.isfile(candidate):
        return FileResponse(candidate)

    # 2. Check if path was formatted without 'images/' (e.g. dsa/safe_name/img.png -> dsa/images/safe_name/img.png)
    parts = image_path.strip("/").split("/")
    if len(parts) >= 2 and parts[1].lower() != "images":
        subj = parts[0]
        rest = parts[1:]
        candidate_with_images = os.path.join(UPLOAD_DIR, subj, "images", *rest)
        if os.path.isfile(candidate_with_images):
            return FileResponse(candidate_with_images)

    # 3. Legacy flat uploads/images/ candidate
    legacy_candidate = os.path.join(UPLOAD_DIR, "images", image_path)
    if os.path.isfile(legacy_candidate):
        return FileResponse(legacy_candidate)

    raise HTTPException(status_code=404, detail="Image not found")


class QueryRequest(BaseModel):
    query: str = Field(min_length=1)
    topic: Optional[str] = None
    subject: Optional[str] = "DSA"
    level: str = "beginner"
    history: List[Dict[str, str]] = Field(default_factory=list)
    include_image: bool = True
    image_mode: str = "notes"
    model: Optional[str] = None
    provider: Optional[str] = None


class ImageRequest(BaseModel):
    query: str = Field(min_length=1)
    topic: str = ""
    mode: str = "notes"
    subject: Optional[str] = "DSA"


class DocumentRequest(BaseModel):
    filename: str = Field(min_length=1)
    subject: Optional[str] = "DSA"


class IndexRequest(BaseModel):
    filenames: List[str] = Field(default_factory=list)
    subject: Optional[str] = "DSA"


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
        images_dir=UPLOAD_DIR,
        hf_api_key=HF_API_KEY,
    )
except Exception as error:
    print(f"[Warning] Failed to initialize image handler: {error}")
    image_handler = None




@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "embedding_model": embedding_model is not None,
        "response_generator": response_generator is not None,
        "multi_agent": False,
        "document_processor": document_processor is not None,
        "image_handler": image_handler is not None,
        "prerequisite_topics": len(response_generator.prerequisites_data) if response_generator else 0,
    }


@app.get("/rag/prerequisites")
def prerequisites(subject: Optional[str] = Query(default=None)) -> Dict[str, Any]:
    if not response_generator:
        raise HTTPException(status_code=503, detail="Response generator is unavailable.")
    data = response_generator.get_prerequisites_for_subject(subject)
    return {
        "subject": subject,
        "prerequisites": data,
        "count": len(data),
    }


@app.get("/rag/sample-questions")
def sample_questions(seed: str = Query(default=""), subject: Optional[str] = Query(default=None)) -> Dict[str, Any]:
    if not response_generator:
        raise HTTPException(status_code=503, detail="Response generator is unavailable.")
    return {"questions": response_generator.generate_sample_questions(seed, subject=subject)}


@app.post("/rag/query")
async def query(request: QueryRequest) -> Dict[str, Any]:
    if not embedding_model:
        raise HTTPException(
            status_code=503,
            detail="Embedding model is unavailable. Check server logs for details.",
        )
    if not response_generator:
        raise HTTPException(
            status_code=503,
            detail="Response generator is unavailable. Configure PINECONE_API_KEY and GROQ_API_KEY.",
        )

    try:
        processed = query_processor.process_query(request.query, request.level.lower())
        query_embedding = embedding_model.encode(processed["query"])
        result = response_generator.respond_to_user(
            query_embedding,
            processed["level"],
            user_question=request.query,
            topic=request.topic,
            conversation_history=request.history,
            preferred_model=request.model,
            provider=request.provider,
            subject=request.subject,
            image_mode=request.image_mode,
        )
        response_text = getattr(result, "response", str(result))

        # Multi-modal: fetch genuine PDF images only if requested and notes mode is active
        images = []
        if request.include_image and request.image_mode == "notes" and image_handler:
            matches = response_generator.fetch_answer(query_embedding, top_k=5, subject=request.subject)
            images = image_handler.get_images(
                matches=matches,
                user_question=request.query,
                topic=getattr(result, "topic", None),
                mode="notes",
                subject=request.subject,
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
        matches = response_generator.fetch_answer(query_embedding, top_k=5, subject=request.subject)
        result = image_handler.get_images(
            matches=matches,
            user_question=request.query,
            topic=request.topic or None,
            mode=request.mode,
            subject=request.subject,
        )
        return {"images": result}
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to load images: {error}") from error


@app.post("/rag/index")
def index_documents(request: IndexRequest = IndexRequest()) -> Dict[str, Any]:
    if not document_processor:
        raise HTTPException(status_code=503, detail="Document processor is unavailable.")
    try:
        # If specific filenames are provided, process those with subject namespace
        if request.filenames:
            for filename in request.filenames:
                filepath = os.path.join(UPLOAD_DIR, filename)
                if not os.path.exists(filepath) and request.subject:
                    subj_filepath = os.path.join(UPLOAD_DIR, request.subject.lower(), filename)
                    if os.path.exists(subj_filepath):
                        filepath = subj_filepath
                if os.path.exists(filepath):
                    document_processor.process_single_pdf(filepath, subject=request.subject)
        else:
            document_processor.upload_to_vector_db()
        
        return {
            "message": "Documents indexed successfully.",
            "subject": request.subject,
            "prerequisite_topics": len(response_generator.prerequisites_data) if response_generator else 0,
        }
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to index documents: {error}") from error


@app.post("/rag/index/stream")
def index_documents_stream(request: IndexRequest = IndexRequest()):
    if not document_processor:
        raise HTTPException(status_code=503, detail="Document processor is unavailable.")

    def event_stream():
        import queue
        import threading
        import json

        q = queue.Queue()

        def notify(pct, stage):
            q.put({"percent": pct, "stage": stage})

        def worker():
            try:
                if request.filenames:
                    total_files = len(request.filenames)
                    for f_idx, filename in enumerate(request.filenames):
                        filepath = os.path.join(UPLOAD_DIR, filename)
                        if not os.path.exists(filepath) and request.subject:
                            subj_filepath = os.path.join(UPLOAD_DIR, request.subject.lower(), filename)
                            if os.path.exists(subj_filepath):
                                filepath = subj_filepath
                        if os.path.exists(filepath):
                            file_base_pct = int((f_idx / total_files) * 100)
                            file_weight = 1.0 / total_files

                            def file_progress(pct, msg):
                                overall_pct = int(file_base_pct + (pct * file_weight))
                                stage_label = msg if total_files == 1 else f"[{filename}] {msg}"
                                notify(min(overall_pct, 98), stage_label)

                            document_processor.process_single_pdf(
                                filepath,
                                subject=request.subject,
                                progress_callback=file_progress,
                            )
                else:
                    notify(50, "Indexing all documents in vector database...")
                    document_processor.upload_to_vector_db()

                notify(100, "Documents indexed successfully.")
                q.put(None)
            except Exception as e:
                q.put({"error": str(e), "percent": -1})
                q.put(None)

        t = threading.Thread(target=worker, daemon=True)
        t.start()

        while True:
            item = q.get()
            if item is None:
                break
            yield f"data: {json.dumps(item)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/rag/delete")
def delete_document(request: DocumentRequest) -> Dict[str, Any]:
    if not document_processor:
        raise HTTPException(status_code=503, detail="Document processor is unavailable.")
    try:
        result = document_processor.delete_document(request.filename, subject=request.subject)
        return {
            "message": f"Document '{request.filename}' deleted successfully.",
            **result,
            "subject": request.subject,
            "prerequisite_topics": len(response_generator.prerequisites_data) if response_generator else 0,
        }
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {error}") from error
