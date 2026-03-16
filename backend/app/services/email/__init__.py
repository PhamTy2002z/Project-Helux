"""Organization invite and welcome email queue and provider services."""

from app.services.email.queue import (
    TASK_TYPE,
    QueuedOrganizationInviteEmail,
    decode_invite_email_task,
    enqueue_invite_email_send,
    requeue_invite_email_task,
)
from app.services.email.welcome_email_queue import TASK_TYPE as WELCOME_EMAIL_TASK_TYPE
from app.services.email.welcome_email_queue import (
    QueuedWelcomeEmail,
    decode_welcome_email_task,
    enqueue_welcome_email_send,
    requeue_welcome_email_task,
)
from app.services.email.billing_email_queue import TASK_TYPE as BILLING_EMAIL_TASK_TYPE
from app.services.email.billing_email_queue import (
    QueuedBillingEmail,
    decode_billing_email_task,
    enqueue_billing_email,
    requeue_billing_email_task,
)
from app.services.email.billing_email_worker import process_billing_email_task
from app.services.email.welcome_email_worker import process_welcome_email_task
from app.services.email.worker import process_invite_email_task

__all__ = [
    "TASK_TYPE",
    "QueuedOrganizationInviteEmail",
    "decode_invite_email_task",
    "enqueue_invite_email_send",
    "requeue_invite_email_task",
    "process_invite_email_task",
    "WELCOME_EMAIL_TASK_TYPE",
    "QueuedWelcomeEmail",
    "decode_welcome_email_task",
    "enqueue_welcome_email_send",
    "requeue_welcome_email_task",
    "process_welcome_email_task",
    "BILLING_EMAIL_TASK_TYPE",
    "QueuedBillingEmail",
    "decode_billing_email_task",
    "enqueue_billing_email",
    "requeue_billing_email_task",
    "process_billing_email_task",
]
