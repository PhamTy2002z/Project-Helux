from __future__ import annotations

from app.services.board_chat_sessions import (
    derive_chat_session_title_from_message,
    is_meaningful_chat_message,
    normalize_chat_session_title,
)


def test_is_meaningful_chat_message_filters_blank_command_and_mentions() -> None:
    assert is_meaningful_chat_message("  ") is False
    assert is_meaningful_chat_message("/pause") is False
    assert is_meaningful_chat_message("@lead @ops") is False
    assert is_meaningful_chat_message("Ship the rollout today") is True


def test_derive_chat_session_title_from_message_strips_leading_mentions() -> None:
    assert (
        derive_chat_session_title_from_message(
            "@lead @ops please finalize rollout checklist",
        )
        == "please finalize rollout checklist"
    )


def test_derive_chat_session_title_from_message_truncates_long_text() -> None:
    content = "A" * 120
    title = derive_chat_session_title_from_message(content)
    assert title is not None
    assert title.endswith("...")
    assert len(title) == 80


def test_normalize_chat_session_title_compacts_whitespace() -> None:
    assert normalize_chat_session_title("   Incident   room   ") == "Incident room"
