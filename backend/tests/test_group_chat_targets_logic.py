"""Test group chat target routing logic for board group memory mentions."""

from uuid import uuid4

import pytest

from app.api.board_group_memory import _group_chat_targets
from app.api.deps import ActorContext
from app.models.agents import Agent
from app.models.users import User


def _board_id() -> str:
    return str(uuid4())


def _org_id() -> str:
    return str(uuid4())


def _gateway_id() -> str:
    return str(uuid4())


def _agent(name: str, *, is_board_lead: bool = False, has_session: bool = True) -> Agent:
    return Agent(
        id=uuid4(),
        board_id=_board_id(),
        name=name,
        is_board_lead=is_board_lead,
        gateway_id=_gateway_id(),
        organization_id=_org_id(),
        openclaw_session_id="test-session" if has_session else None,
    )


def _user_actor() -> ActorContext:
    return ActorContext(
        actor_type="user",
        user=User(
            clerk_user_id="user_123",
            email="user@example.com",
            name="User",
            preferred_name="User",
        ),
    )


def test_group_chat_targets_broadcast_includes_all_with_sessions() -> None:
    """Broadcast messages go to all agents with OpenClaw sessions."""
    lead = _agent("Ava", is_board_lead=True)
    alice = _agent("Alice")
    bob = _agent("Bob", has_session=False)  # No session

    targets = _group_chat_targets(
        agents=[lead, alice, bob],
        mentions=set(),
        is_broadcast=True,
        actor=_user_actor(),
    )

    assert len(targets) == 2
    assert str(lead.id) in targets
    assert str(alice.id) in targets
    assert str(bob.id) not in targets  # No session


def test_group_chat_targets_non_broadcast_no_mentions_only_lead() -> None:
    """Non-broadcast with no mentions only includes lead."""
    lead = _agent("Ava", is_board_lead=True)
    alice = _agent("Alice")
    bob = _agent("Bob")

    targets = _group_chat_targets(
        agents=[lead, alice, bob],
        mentions=set(),
        is_broadcast=False,
        actor=_user_actor(),
    )

    assert len(targets) == 1
    assert str(lead.id) in targets
    assert str(alice.id) not in targets
    assert str(bob.id) not in targets


def test_group_chat_targets_excludes_lead_when_non_lead_mentioned() -> None:
    """When a non-lead member is mentioned, lead is NOT included."""
    lead = _agent("Ava", is_board_lead=True)
    alice = _agent("Alice")
    bob = _agent("Bob")

    targets = _group_chat_targets(
        agents=[lead, alice, bob],
        mentions={"alice"},
        is_broadcast=False,
        actor=_user_actor(),
    )

    assert len(targets) == 1
    assert str(alice.id) in targets
    assert str(lead.id) not in targets
    assert str(bob.id) not in targets


def test_group_chat_targets_includes_lead_when_explicitly_mentioned() -> None:
    """When lead is explicitly mentioned, lead is included."""
    lead = _agent("Ava", is_board_lead=True)
    alice = _agent("Alice")

    targets = _group_chat_targets(
        agents=[lead, alice],
        mentions={"lead"},
        is_broadcast=False,
        actor=_user_actor(),
    )

    assert len(targets) == 1
    assert str(lead.id) in targets
    assert str(alice.id) not in targets


def test_group_chat_targets_excludes_actor_agent() -> None:
    """The agent actor is always excluded from targets."""
    lead = _agent("Ava", is_board_lead=True)
    alice = _agent("Alice")

    actor = ActorContext(
        actor_type="agent",
        agent=alice,
    )

    targets = _group_chat_targets(
        agents=[lead, alice],
        mentions={"alice"},
        is_broadcast=False,
        actor=actor,
    )

    # Alice mentioned but is the actor, so excluded
    assert len(targets) == 0
    assert str(alice.id) not in targets


def test_group_chat_targets_skips_agents_without_openclaw_session() -> None:
    """Agents without OpenClaw sessions are never included."""
    lead = _agent("Ava", is_board_lead=True, has_session=False)
    alice = _agent("Alice")

    targets = _group_chat_targets(
        agents=[lead, alice],
        mentions=set(),
        is_broadcast=True,
        actor=_user_actor(),
    )

    # Lead has no session, so even in broadcast it's excluded
    assert len(targets) == 1
    assert str(alice.id) in targets
    assert str(lead.id) not in targets


def test_group_chat_targets_lead_explicit_mention_with_others() -> None:
    """When lead is explicitly mentioned along with others, lead is included."""
    lead = _agent("Ava", is_board_lead=True)
    alice = _agent("Alice")
    bob = _agent("Bob")

    targets = _group_chat_targets(
        agents=[lead, alice, bob],
        mentions={"alice", "lead"},
        is_broadcast=False,
        actor=_user_actor(),
    )

    assert len(targets) == 2
    assert str(lead.id) in targets
    assert str(alice.id) in targets
    assert str(bob.id) not in targets


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
