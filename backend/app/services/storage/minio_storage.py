"""MinIO implementation of the ObjectStorageService interface."""

from __future__ import annotations

import io
from urllib.parse import urlparse

from minio import Minio
from minio.error import S3Error

from app.core.config import settings
from app.core.logging import get_logger
from app.services.storage.object_storage import ObjectStorageService, PutResult

logger = get_logger(__name__)


class MinioObjectStorageService(ObjectStorageService):
    """S3-compatible object storage backed by MinIO."""

    def __init__(self) -> None:
        parsed = urlparse(settings.object_storage_endpoint)
        # Minio client expects host:port without scheme.
        endpoint = parsed.netloc or parsed.path
        self._client = Minio(
            endpoint,
            access_key=settings.object_storage_access_key,
            secret_key=settings.object_storage_secret_key,
            secure=settings.object_storage_use_ssl,
        )
        self._bucket = settings.object_storage_bucket

    def ensure_bucket(self) -> None:
        """Create the bucket if it does not already exist."""
        try:
            if not self._client.bucket_exists(self._bucket):
                self._client.make_bucket(self._bucket)
                logger.info("minio.bucket_created", extra={"bucket": self._bucket})
        except S3Error as exc:
            logger.error(
                "minio.ensure_bucket_failed",
                extra={"bucket": self._bucket, "error": str(exc)},
            )
            raise

    def put_object(self, key: str, data: bytes, content_type: str) -> PutResult:
        """Upload bytes to MinIO."""
        stream = io.BytesIO(data)
        result = self._client.put_object(
            self._bucket,
            key,
            stream,
            length=len(data),
            content_type=content_type,
        )
        logger.info(
            "minio.put_object",
            extra={"key": key, "size": len(data), "etag": result.etag},
        )
        return PutResult(key=key, size_bytes=len(data), etag=result.etag or "")

    def get_object(self, key: str) -> bytes:
        """Download an object from MinIO."""
        response = None
        try:
            response = self._client.get_object(self._bucket, key)
            return response.read()
        finally:
            if response is not None:
                response.close()
                response.release_conn()


def get_object_storage() -> MinioObjectStorageService:
    """Factory for the default MinIO storage service singleton."""
    return _default_storage


_default_storage = MinioObjectStorageService()
