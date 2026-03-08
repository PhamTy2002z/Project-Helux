"""Worker handlers for asynchronous gateway activation tasks."""

from __future__ import annotations

from fastapi import HTTPException

from app.core.logging import get_logger
from app.core.time import utcnow
from app.db.session import async_session_maker
from app.models.gateways import Gateway
from app.services.openclaw.admin_service import GatewayAdminLifecycleService
from app.services.openclaw.gateway_activation_queue import decode_gateway_activation_task
from app.services.queue import QueuedTask

logger = get_logger(__name__)


async def process_gateway_activation_task(task: QueuedTask) -> None:
    """Run compatibility checks and main-agent provisioning for one gateway."""
    payload = decode_gateway_activation_task(task)

    async with async_session_maker() as session:
        gateway = await Gateway.objects.by_id(payload.gateway_id).first(session)
        if gateway is None:
            logger.info(
                "gateway.activation.skip_missing_gateway",
                extra={"gateway_id": str(payload.gateway_id)},
            )
            return

        gateway.activation_status = "activating"
        gateway.activation_attempts = int(gateway.activation_attempts or 0) + 1
        gateway.last_activation_at = utcnow()
        gateway.activation_error = None
        gateway.updated_at = utcnow()
        session.add(gateway)
        await session.commit()

        service = GatewayAdminLifecycleService(session)
        try:
            await service.assert_gateway_runtime_compatible(
                url=gateway.url,
                token=gateway.token,
                allow_insecure_tls=gateway.allow_insecure_tls,
                disable_device_pairing=gateway.disable_device_pairing,
            )
            await service.ensure_main_agent(gateway, auth=None, action=payload.action)
        except HTTPException as exc:
            gateway.activation_status = "degraded"
            gateway.activation_error = str(exc.detail)
            gateway.updated_at = utcnow()
            session.add(gateway)
            await session.commit()
            if exc.status_code >= 500:
                raise RuntimeError(str(exc.detail)) from exc
            return
        except Exception as exc:
            gateway.activation_status = "degraded"
            gateway.activation_error = str(exc)
            gateway.updated_at = utcnow()
            session.add(gateway)
            await session.commit()
            raise

        gateway.activation_status = "ready"
        gateway.activation_error = None
        gateway.updated_at = utcnow()
        session.add(gateway)
        await session.commit()

        logger.info(
            "gateway.activation.success",
            extra={
                "gateway_id": str(gateway.id),
                "action": payload.action,
                "attempt": gateway.activation_attempts,
            },
        )
