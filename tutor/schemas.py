"""Pydantic request models and response data classes for the FastAPI endpoints."""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


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


@dataclass
class ResponseResult:
    """Structured response from the RAG pipeline.

    Replaces the old ResponseResult(str) hack that subclassed str
    to carry metadata. Now it's a clean dataclass.
    """

    response: str
    topic: Optional[str] = None
    prerequisites: List[str] = field(default_factory=list)
    sources: List[Dict[str, Any]] = field(default_factory=list)
    model: Optional[str] = None
    provider: Optional[str] = None

    def __str__(self):
        return self.response
