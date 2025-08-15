import argparse
import io
import os
import re
import threading
import time
import uuid
from typing import List, Optional

import fitz  # PyMuPDF
from dotenv import load_dotenv
from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .models.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    DocumentItem,
    DocumentSearchRequest,
    DocumentSearchResponse,
    EnhancedPodcastRequest,
    EnhancedPodcastResponse,
    InsightsRequest,
    InsightsResponse,
    PodcastRequest,
    PodcastResponse,
    TextSelectionRequest,
    TextSelectionResponse,
)
from .services import (
    analyzer,
    document_index,
    enhanced_podcast,
    extractor,
    related,
    storage,
    summarizer,
    text_selection,
    tts,
)
from .services.llm import get_llm_service

# Directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
FILES_DIR = os.path.join(ROOT_DIR, "files")  # uploaded PDFs
STATIC_DIR = os.path.join(ROOT_DIR, "static")  # audio & other assets

# Load .env at import time so env vars are available in any run mode
env_path = os.path.join(ROOT_DIR, ".env")
print(f"🔍 Looking for .env file at: {env_path}")
print(f"🔍 .env file exists: {os.path.exists(env_path)}")

if os.path.exists(env_path):
    load_dotenv(env_path)
    print(f"✅ .env file loaded successfully")
    print(f"🔑 GOOGLE_API_KEY loaded: {'Yes' if os.getenv('GOOGLE_API_KEY') else 'No'}")
    print(
        f"🔑 AZURE_SPEECH_KEY loaded: {'Yes' if os.getenv('AZURE_SPEECH_KEY') else 'No'}"
    )
else:
    print(f"❌ .env file not found at: {env_path}")
    # Try alternative paths
    alt_paths = [
        os.path.join(BASE_DIR, ".env"),
        os.path.join(os.getcwd(), ".env"),
        ".env",
    ]
    for alt_path in alt_paths:
        if os.path.exists(alt_path):
            print(f"🔍 Found .env at alternative path: {alt_path}")
            load_dotenv(alt_path)
            break


os.makedirs(FILES_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)

app = FastAPI(title="Adobe Hackathon Finale API")

# CORS open for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static mounts
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/files", StaticFiles(directory=FILES_DIR), name="files")


@app.get("/", response_class=HTMLResponse)
def index_page():
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if not os.path.exists(index_path):
        return HTMLResponse("<h1>Adobe Hackathon Finale</h1><p>Frontend not found.</p>")
    with open(index_path, "r", encoding="utf-8") as f:
        return HTMLResponse(f.read())


@app.get("/favicon.ico")
def favicon():
    # Avoid 404 noise in console
    return Response(status_code=204)


@app.get("/api/config")
def get_config():
    # Surface Adobe Embed API key to frontend.
    adobe_key = os.getenv("ADOBE_EMBED_API_KEY", "")
    return {"adobe_embed_api_key": adobe_key}


@app.get("/.well-known/appspecific/com.chrome.devtools.json")
async def chrome_devtools():
    """Handle Chrome DevTools request to prevent 404 errors"""
    return {"status": "ok", "message": "Chrome DevTools endpoint"}


@app.get("/api/health")
def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "llm_provider": os.getenv("LLM_PROVIDER", "not_set"),
        "tts_provider": os.getenv("TTS_PROVIDER", "not_set"),
        "google_api_key": "set" if os.getenv("GOOGLE_API_KEY") else "not_set",
        "azure_speech_key": "set" if os.getenv("AZURE_SPEECH_KEY") else "not_set",
        "azure_speech_voice": os.getenv("AZURE_SPEECH_VOICE", "not_set"),
        "azure_speech_voice_2": os.getenv("AZURE_SPEECH_VOICE_2", "not_set"),
        "azure_speech_voice_3": os.getenv("AZURE_SPEECH_VOICE_3", "not_set"),
        "env_file_path": os.path.join(ROOT_DIR, ".env"),
        "env_file_exists": os.path.exists(os.path.join(ROOT_DIR, ".env")),
        "current_working_dir": os.getcwd(),
        "base_dir": BASE_DIR,
        "root_dir": ROOT_DIR,
    }


@app.post("/api/upload", response_model=List[DocumentItem])
async def upload(files: List[UploadFile] = File(...)):
    saved: List[DocumentItem] = []
    uploaded_filenames = []

    for f in files:
        if not f.filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=400, detail=f"Only PDF allowed: {f.filename}"
            )
        content = await f.read()
        item = storage.save_pdf_bytes(FILES_DIR, f.filename, content)
        saved.append(item)
        uploaded_filenames.append(f.filename)

    # Index the uploaded documents in the background
    try:
        # Start indexing in a background thread
        def index_uploaded_docs():
            try:
                print(
                    f"Starting to index {len(uploaded_filenames)} uploaded documents..."
                )
                results = document_index.index_documents(FILES_DIR, uploaded_filenames)
                print(f"Indexing completed for uploaded documents: {results}")

                # Also trigger a full index rebuild to ensure consistency
                try:
                    all_docs = [doc.filename for doc in storage.list_pdfs(FILES_DIR)]
                    rebuild_results = document_index.index_documents(
                        FILES_DIR, all_docs
                    )
                    print(f"Full index rebuild completed: {rebuild_results}")
                except Exception as rebuild_error:
                    print(f"Warning: Full index rebuild failed: {rebuild_error}")

            except Exception as e:
                print(f"Error indexing uploaded documents: {e}")

        threading.Thread(target=index_uploaded_docs, daemon=True).start()
    except Exception as e:
        print(f"Error starting document indexing: {e}")

    return saved


@app.get("/api/documents", response_model=List[DocumentItem])
def list_documents():
    return storage.list_pdfs(FILES_DIR)


@app.delete("/api/documents/{filename}")
def delete_document(filename: str):
    """Delete a PDF document and remove it from the index."""
    try:
        # Check if file exists
        file_path = os.path.join(FILES_DIR, filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"File not found: {filename}")

        # Remove from document index first
        try:
            success = document_index.remove_document_from_index(filename)
            if success:
                print(f"Removed {filename} from document index")
            else:
                print(f"Warning: Failed to remove {filename} from index")
        except Exception as e:
            print(f"Error removing from index: {e}")

        # Delete the physical file
        os.remove(file_path)

        return {"message": f"Document {filename} deleted successfully"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {e}")


@app.get("/api/index/stats")
def get_index_stats():
    """Get statistics about the document index."""
    try:
        stats = document_index.get_index_stats()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get index stats: {e}")


@app.post("/api/index/rebuild")
def rebuild_index():
    """Rebuild the entire document index."""
    try:
        # Get all documents
        documents = [doc.filename for doc in storage.list_pdfs(FILES_DIR)]

        # Rebuild index in background
        def rebuild():
            try:
                results = document_index.index_documents(FILES_DIR, documents)
                print(f"Index rebuild results: {results}")
            except Exception as e:
                print(f"Error rebuilding index: {e}")

        threading.Thread(target=rebuild, daemon=True).start()

        return {
            "status": "rebuilding",
            "message": f"Started rebuilding index for {len(documents)} documents",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to rebuild index: {e}")


@app.get("/api/index/clusters")
def get_document_clusters(
    n_clusters: int = Query(5, description="Number of clusters to create")
):
    """Get automatically clustered document groups."""
    try:
        clusters = document_index.get_document_index().cluster_documents(n_clusters)
        return clusters
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cluster documents: {e}")


@app.get("/api/index/recommendations/{filename}")
def get_document_recommendations(
    filename: str, top_k: int = Query(5, description="Number of recommendations")
):
    """Get document recommendations based on current document."""
    try:
        result = document_index.get_document_index().get_document_recommendations(
            filename, top_k
        )
        # Return the result directly since it already has the correct structure
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get recommendations: {e}"
        )


@app.get("/api/index/incremental-status")
def get_incremental_update_status():
    """Check which documents need re-indexing."""
    try:
        status = document_index.get_document_index().get_incremental_update_status()
        return status
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get incremental status: {e}"
        )


@app.post("/api/index/incremental-update")
def update_index_incremental():
    """Update only changed documents."""
    try:
        results = document_index.get_document_index().update_index_incremental(
            FILES_DIR
        )
        return results
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to update index incrementally: {e}"
        )


class AnalyzeQuery(BaseModel):
    persona: str
    job: str
    documents: List[str]  # filenames
    approach: Optional[str] = "nlp"  # nlp or llm
    method: Optional[str] = "auto"  # auto|keyword|embedding
    top_k: Optional[int] = 5


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze_documents(req: AnalyzeQuery):
    # Load and extract sections from selected PDFs
    sections = []
    for fname in req.documents:
        pdf_path = os.path.join(FILES_DIR, fname)
        if not os.path.exists(pdf_path):
            raise HTTPException(status_code=404, detail=f"File not found: {fname}")
        try:
            doc_sections = extractor.extract_sections_from_pdf(pdf_path)
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to process {fname}: {e}"
            )
        for s in doc_sections:
            s["document"] = fname
        sections.extend(doc_sections)

    if not sections:
        return AnalyzeResponse(
            extracted_sections=[], snippets=[], related_map={}, method="none"
        )

    ranked, actual_method = analyzer.rank_sections_by_relevance(
        sections, req.persona, req.job, approach=req.approach, method=req.method
    )
    ranked = ranked[: max(1, req.top_k or 5)]

    # Generate short snippets (1-2 sentences)
    summaries = summarizer.summarize_sections(
        ranked, req.persona, req.job, approach="nlp"
    )

    # Build related sections map (per selected item find related across all)
    rel_map = related.find_related_sections(ranked, sections)

    # Response models
    return AnalyzeResponse(
        extracted_sections=[
            {
                "document": s["document"],
                "section_title": s.get("section_title", ""),
                "importance_rank": s.get("importance_rank", i + 1),
                "page_number": s.get("page_number", 1),
                "relevance_score": s.get("relevance_score", 0.0),
            }
            for i, s in enumerate(ranked)
        ],
        snippets=[
            {
                "document": ss["document"],
                "refined_text": ss["refined_text"],
                "page_number": ss["page_number"],
            }
            for ss in summaries
        ],
        related_map=rel_map,
        method=actual_method,
    )


@app.post("/api/insights", response_model=InsightsResponse)
def insights(req: InsightsRequest):
    # Compose a prompt based on persona, job, current snippet and related snippets
    system = {
        "role": "system",
        "content": (
            "You are an expert research analyst. Analyze the provided content and generate actionable insights. "
            "DO NOT repeat or echo the input prompts. Focus on extracting meaningful insights from the content itself. "
            "Return ONLY the insights in this exact format:\n\n"
            "Key Insights:\n"
            "- <insight 1, <= 20 words>\n"
            "- <insight 2>\n"
            "- <insight 3>\n\n"
            "Did You Know?:\n"
            "- <interesting fact, <= 20 words>\n"
            "- <another fact>\n\n"
            "Contradictions and Connections:\n"
            "- <note contradictions or connections>\n"
            "- <another observation>\n\n"
            "Rules: Be concise, focus on the content, do not mention 'current section' or 'related sections' in your response."
        ),
    }
    user = {
        "role": "user",
        "content": (
            f"Analyze this content for insights:\n\n"
            f"Main content: {req.current_text}\n\n"
            f"Related content:\n"
            + "\n".join([f"- {r}" for r in (req.related_texts or [])])
            + f"\n\nContext: Persona={req.persona}, Job={req.job}"
        ),
    }

    try:
        llm_service = get_llm_service()
        content = llm_service.get_llm_response([system, user])
        if not content or content.strip() == "":
            raise Exception("Empty response from LLM")
    except Exception as e:
        print(f"LLM insights generation failed: {e}")
        # Generate more meaningful fallback insights based on available data
        if req.current_text and req.related_texts:
            content = (
                "Key Insights:\n"
                f"- Content focuses on: {req.current_text[:50]}{'...' if len(req.current_text) > 50 else ''}\n"
                f"- {len(req.related_texts)} related sections found across documents\n"
                f"- Consider cross-referencing for deeper understanding\n\n"
                "Did You Know?:\n"
                f"- Related content spans multiple documents and pages\n"
                f"- Use text selection to discover more connections\n\n"
                "Contradictions and Connections:\n"
                f"- Compare findings across different sources\n"
                f"- Look for supporting or contrasting evidence"
            )
        else:
            content = (
                "Key Insights:\n"
                "- Run document analysis first to extract sections and snippets\n"
                "- Use text selection in PDFs to find cross-document connections\n"
                "- Check document clusters for related content\n\n"
                "Did You Know?:\n"
                "- The system can analyze multiple PDFs simultaneously\n"
                "- Text selection triggers semantic search across all documents\n\n"
                "Contradictions and Connections:\n"
                "- Upload more documents to discover patterns and contradictions\n"
                "- Use the clustering feature to group similar documents"
            )

    # Light post-processing to ensure section headers exist for consistent rendering
    text = (content or "").strip()

    # If the model accidentally echoed our prompt (Persona/Job/Current/Related), strip those lines
    lines = [
        ln
        for ln in text.splitlines()
        if not ln.strip()
        .lower()
        .startswith(
            ("persona:", "job:", "current:", "related:", "main content:", "context:")
        )
    ]
    text = "\n".join(lines).strip()

    low = text.lower()
    if (
        "key insights:" not in low
        and "did you know?" not in low
        and "contradictions" not in low
    ):
        bullets = [
            f"- {line.strip('- ').strip()}"
            for line in text.splitlines()
            if line.strip()
        ]
        text = "Key Insights:\n" + ("\n".join(bullets) or "- No insights available.")
    return InsightsResponse(content=text)


@app.post("/api/podcast", response_model=PodcastResponse)
def podcast(req: PodcastRequest):
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty text")

    # Generate mp3 in STATIC_DIR
    out_name = req.output_name or "podcast.mp3"
    out_path = os.path.join(STATIC_DIR, out_name)

    try:
        url = tts.generate_audio_to_file(text=text, output_file=out_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS failed: {e}")

    # Return URL for frontend to play
    rel = f"/static/{os.path.basename(out_path)}"
    return PodcastResponse(url=rel)


# New API endpoints for text selection functionality


@app.post("/api/text-selection", response_model=TextSelectionResponse)
def process_text_selection(req: TextSelectionRequest):
    """
    Process text selection and generate cross-PDF insights.
    """
    if not req.selected_text.strip():
        raise HTTPException(status_code=400, detail="Empty selected text")

    # Get all uploaded documents
    all_documents = [doc.filename for doc in storage.list_pdfs(FILES_DIR)]

    if not all_documents:
        raise HTTPException(status_code=400, detail="No documents uploaded")

    try:
        response = text_selection.process_text_selection(
            selected_text=req.selected_text,
            document=req.document,
            page_number=req.page_number,
            all_documents=all_documents,
            files_dir=FILES_DIR,
            persona=req.persona,
            job=req.job,
        )
        return response
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Text selection processing failed: {e}"
        )


@app.post("/api/enhanced-podcast", response_model=EnhancedPodcastResponse)
def create_enhanced_podcast(req: EnhancedPodcastRequest):
    """
    Create an enhanced podcast with two-person conversation about selected text and related insights.
    """
    # Allow empty selected_text if we have other context (persona, job, or related insights)
    has_context = (
        req.persona
        or req.job
        or (req.related_insights and len(req.related_insights) > 0)
    )

    if not req.selected_text.strip() and not has_context:
        raise HTTPException(
            status_code=400,
            detail="Need either selected text or context (persona/job/related insights) for podcast generation",
        )

    # Generate unique filename
    timestamp = int(time.time())
    out_name = f"enhanced_podcast_{timestamp}.mp3"
    out_path = os.path.join(STATIC_DIR, out_name)

    try:
        response = enhanced_podcast.create_enhanced_podcast(
            request=req, output_file=out_path, static_dir=STATIC_DIR
        )
        return response
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Enhanced podcast generation failed: {e}"
        )


@app.post("/api/document-search", response_model=DocumentSearchResponse)
def search_documents(req: DocumentSearchRequest):
    """
    Search across all uploaded documents for relevant content.
    """
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Empty search query")

    start_time = time.time()

    # Get all documents to search
    all_documents = (
        req.documents
        if req.documents
        else [doc.filename for doc in storage.list_pdfs(FILES_DIR)]
    )

    if not all_documents:
        raise HTTPException(status_code=400, detail="No documents to search")

    try:
        # Use document index for fast semantic search
        matches = document_index.search_documents(
            query=req.query, top_k=req.top_k or 10, documents=all_documents
        )

        # Convert to response format
        results = []
        for match in matches:
            results.append(
                {
                    "document": match["document"],
                    "page_number": match["page_number"],
                    "text": (
                        match["text"][:300] + "..."
                        if len(match["text"]) > 300
                        else match["text"]
                    ),
                    "similarity_score": match["similarity_score"],
                    "jump_url": f"/files/{match['document']}#page={match['page_number']}",
                }
            )

        search_time = time.time() - start_time

        return DocumentSearchResponse(
            results=results, total_found=len(results), search_time=search_time
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Document search failed: {e}")


@app.get("/api/search_count")
def search_count(
    file: str = Query(..., description="PDF filename in /files"),
    q: str = Query(..., description="Search query"),
):
    pdf_path = os.path.join(FILES_DIR, file)
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail=f"File not found: {file}")

    # Build a case-insensitive pattern that counts overlapping matches
    # Example: for 'as', matches 'as' within words as requested
    try:
        pattern = re.compile(r"(?=" + re.escape(q) + r")", re.IGNORECASE)
    except re.error:
        raise HTTPException(status_code=400, detail="Invalid search pattern")

    doc = fitz.open(pdf_path)
    per_page = []
    total = 0
    for i, page in enumerate(doc, 1):
        text = page.get_text("text") or ""
        count = len(pattern.findall(text))
        per_page.append({"page": i, "count": count})
        total += count

    return {"file": file, "query": q, "total": total, "per_page": per_page}


# Serve frontend assets
@app.get("/app.js", response_class=HTMLResponse)
def js_bundle():
    path = os.path.join(FRONTEND_DIR, "app.js")
    if not os.path.exists(path):
        raise HTTPException(status_code=404)
    with open(path, "r", encoding="utf-8") as f:
        return HTMLResponse(f.read(), media_type="application/javascript")


@app.get("/styles.css", response_class=HTMLResponse)
def css_bundle():
    path = os.path.join(FRONTEND_DIR, "styles.css")
    if not os.path.exists(path):
        raise HTTPException(status_code=404)
    with open(path, "r", encoding="utf-8") as f:
        return HTMLResponse(f.read(), media_type="text/css")


JOBS: dict[str, dict] = {}


@app.post("/api/analyze_async")
def analyze_async(req: AnalyzeQuery):
    job_id = str(uuid.uuid4())
    JOBS[job_id] = {
        "status": "queued",
        "progress": 0,
        "current_file": None,
        "total_files": len(req.documents or []),
        "processed_files": 0,
        "file_progress": {},  # Track individual file progress
        "result": None,
        "error": None,
        "cancelled": False,
    }

    def worker():
        try:
            JOBS[job_id]["status"] = "running"
            sections = []
            total = len(req.documents or [])

            for idx, fname in enumerate(req.documents or [], start=1):
                # Check for cancellation
                if JOBS[job_id]["cancelled"]:
                    JOBS[job_id]["status"] = "cancelled"
                    return

                JOBS[job_id]["current_file"] = fname
                JOBS[job_id]["processed_files"] = idx - 1

                # Initialize file progress
                JOBS[job_id]["file_progress"][fname] = {
                    "status": "processing",
                    "progress": 0,
                }

                pdf_path = os.path.join(FILES_DIR, fname)
                if not os.path.exists(pdf_path):
                    JOBS[job_id]["file_progress"][fname] = {
                        "status": "error",
                        "progress": 0,
                        "error": f"File not found: {fname}",
                    }
                    continue

                # Extract sections for this file
                try:
                    doc_sections = extractor.extract_sections_from_pdf(pdf_path)
                    for s in doc_sections:
                        s["document"] = fname
                    sections.extend(doc_sections)

                    # Mark file as completed
                    JOBS[job_id]["file_progress"][fname] = {
                        "status": "completed",
                        "progress": 100,
                    }
                except Exception as e:
                    JOBS[job_id]["file_progress"][fname] = {
                        "status": "error",
                        "progress": 0,
                        "error": str(e),
                    }
                    continue

                # Rough progress by files first (80%), remainder after ranking
                JOBS[job_id]["progress"] = int((idx / max(1, total)) * 80)

            # Check for cancellation before ranking
            if JOBS[job_id]["cancelled"]:
                JOBS[job_id]["status"] = "cancelled"
                return

            if not sections:
                JOBS[job_id]["result"] = AnalyzeResponse(
                    extracted_sections=[], snippets=[], related_map={}, method="none"
                ).dict()
                JOBS[job_id]["progress"] = 100
                JOBS[job_id]["status"] = "done"
                return

            # Ranking and summarization (split into two steps for progress)
            ranked, actual_method = analyzer.rank_sections_by_relevance(
                sections, req.persona, req.job, approach=req.approach, method=req.method
            )
            ranked = ranked[: max(1, req.top_k or 5)]
            JOBS[job_id]["progress"] = 90

            # Check for cancellation before summarization
            if JOBS[job_id]["cancelled"]:
                JOBS[job_id]["status"] = "cancelled"
                return

            summaries = summarizer.summarize_sections(
                ranked, req.persona, req.job, approach="nlp"
            )
            JOBS[job_id]["progress"] = 95

            # Check for cancellation before final processing
            if JOBS[job_id]["cancelled"]:
                JOBS[job_id]["status"] = "cancelled"
                return

            rel_map = related.find_related_sections(ranked, sections)

            result = AnalyzeResponse(
                extracted_sections=[
                    {
                        "document": s["document"],
                        "section_title": s.get("section_title", ""),
                        "importance_rank": s.get("importance_rank", i + 1),
                        "page_number": s.get("page_number", 1),
                        "relevance_score": s.get("relevance_score", 0.0),
                    }
                    for i, s in enumerate(ranked)
                ],
                snippets=[
                    {
                        "document": ss["document"],
                        "refined_text": ss["refined_text"],
                        "page_number": ss["page_number"],
                    }
                    for ss in summaries
                ],
                related_map=rel_map,
                method=actual_method,
            ).dict()

            JOBS[job_id]["result"] = result
            JOBS[job_id]["progress"] = 100
            JOBS[job_id]["status"] = "done"
        except Exception as e:
            JOBS[job_id]["status"] = "error"
            JOBS[job_id]["error"] = str(e)

    threading.Thread(target=worker, daemon=True).start()
    return {"job_id": job_id}


@app.post("/api/analyze_cancel")
def analyze_cancel(id: str = Query(...)):
    job = JOBS.get(id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")

    if job["status"] in ["done", "error", "cancelled"]:
        return {"status": "already_finished", "message": f"Job already {job['status']}"}

    job["cancelled"] = True
    return {"status": "cancelling", "message": "Cancellation requested"}


@app.get("/api/analyze_progress")
def analyze_progress(id: str = Query(...)):
    job = JOBS.get(id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    return {
        "status": job["status"],
        "progress": job["progress"],
        "current_file": job["current_file"],
        "processed_files": job["processed_files"],
        "total_files": job["total_files"],
        "file_progress": job.get("file_progress", {}),
        "error": job.get("error"),
    }


@app.get("/api/analyze_result")
def analyze_result(id: str = Query(...)):
    job = JOBS.get(id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    if job["status"] != "done":
        return JSONResponse({"status": job["status"]}, status_code=202)
    return job["result"]


if __name__ == "__main__":
    # Load .env before parsing
    load_dotenv(os.path.join(ROOT_DIR, ".env"))

    parser = argparse.ArgumentParser(
        description="Run Adobe Hackathon Finale API server"
    )
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--reload", action="store_true", help="Enable reload")
    parser.add_argument(
        "--llm",
        choices=["gemini", "ollama"],
        default=os.getenv("LLM_PROVIDER", "gemini"),
        help="LLM provider",
    )
    parser.add_argument(
        "--gemini-model", default=os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    )
    parser.add_argument(
        "--ollama-model", default=os.getenv("OLLAMA_MODEL", "gemma3:1b")
    )
    args = parser.parse_args()

    # Export provider choices to env so services pick them up
    os.environ["LLM_PROVIDER"] = args.llm
    if args.llm == "gemini":
        os.environ["GEMINI_MODEL"] = args.gemini_model
    elif args.llm == "ollama":
        os.environ["OLLAMA_MODEL"] = args.ollama_model

    import uvicorn

    uvicorn.run("app.main:app", host=args.host, port=args.port, reload=args.reload)
