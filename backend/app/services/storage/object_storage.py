"""Abstract interface for S3-compatible object storage."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class PutResult:
    """Result of a successful object put operation."""

    key: str
    size_bytes: int
    etag: str


class ObjectStorageService(ABC):
    """Interface for S3-compatible object storage operations."""

    @abstractmethod
    def put_object(self, key: str, data: bytes, content_type: str) -> PutResult:
        """Upload bytes to the object store under the given key."""

    @abstractmethod
    def get_object(self, key: str) -> bytes:
        """Download an object by key and return its contents."""

    @abstractmethod
    def ensure_bucket(self) -> None:
        """Create the bucket if it does not exist."""
