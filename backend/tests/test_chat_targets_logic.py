"""Test chat target routing logic for board memory mentions."""

from uuid import uuid4

import pytest

from app.api.board_memory import _chat_targets
from app.api.deps import ActorContext
from app.models.agents import Agent
from app.models.users import User


def _board_id() -> str:
    return str(uuid4())


def _org_id() -> str:
    return str(uuid4())


def _gateway_id() -> str:
    return str(uuid4())


def _agent(name: str, *, is_board_lead: bool = False) -> Agent:
    return Agent(
        id=uuid4(),
        board_id=_board_id(),
        name=name,
        is_board_lead=is_board_lead,
        gateway_id=_gateway_id(),
        organization_id=_org_id(),
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


def test_chat_targets_includes_lead_when_no_mentions() -> None:
    """When no mentions, only the lead agent receives the message."""
    lead = _agent("Ava", is_board_lead=True)
    member = _agent("Bob")

    targets = _chat_targets(
        agents=[lead, member],
        mentions=set(),
        actor=_user_actor(),
    )

    assert len(targets) == 1
    assert str(lead.id) in targets
    assert str(member.id) not in targets


def test_chat_targets_includes_lead_when_lead_explicitly_mentioned() -> None:
    """When @lead is mentioned, the lead agent receives the message."""
    lead = _agent("Ava", is_board_lead=True)
    member = _agent("Bob")

    targets = _chat_targets(
        agents=[lead, member],
        mentions={"lead"},
        actor=_user_actor(),
    )

    assert len(targets) == 1
    assert str(lead.id) in targets
    assert str(member.id) not in targets


def test_chat_targets_excludes_lead_when_non_lead_mentioned() -> None:
    """When a non-lead member is mentioned, the lead is NOT included."""
    lead = _agent("Ava", is_board_lead=True)
    alice = _agent("Alice")
    bob = _agent("Bob")

    targets = _chat_targets(
        agents=[lead, alice, bob],
        mentions={"alice"},
        actor=_user_actor(),
    )

    assert len(targets) == 1
    assert str(alice.id) in targets
    assert str(lead.id) not in targets
    assert str(bob.id) not in targets


def test_chat_targets_excludes_lead_when_multiple_non_leads_mentioned() -> None:
    """When multiple non-lead members are mentioned, the lead is NOT included."""
    lead = _agent("Ava", is_board_lead=True)
    alice = _agent("Alice")
    bob = _agent("Bob")

    targets = _chat_targets(
        agents=[lead, alice, bob],
        mentions={"alice", "bob"},
        actor=_user_actor(),
    )

    assert len(targets) == 2
    assert str(alice.id) in targets
    assert str(bob.id) in targets
    assert str(lead.id) not in targets


def test_chat_targets_includes_lead_when_explicitly_mentioned_with_others() -> None:
    """When lead is explicitly mentioned along with others, lead is included."""
    lead = _agent("Ava", is_board_lead=True)
    alice = _agent("Alice")
    bob = _agent("Bob")

    targets = _chat_targets(
        agents=[lead, alice, bob],
        mentions={"alice", "lead"},
        actor=_user_actor(),
    )

    assert len(targets) == 2
    assert str(lead.id) in targets
    assert str(alice.id) in targets
    assert str(bob.id) not in targets


def test_chat_targets_excludes_actor_agent() -> None:
    """The agent actor is always excluded from targets."""
    lead = _agent("Ava", is_board_lead=True)
    alice = _agent("Alice")
    bob = _agent("Bob")

    actor = ActorContext(
        actor_type="agent",
        agent=alice,
    )

    targets = _chat_targets(
        agents=[lead, alice, bob],
        mentions={"alice"},
        actor=actor,
    )

    # Alice mentioned but is the actor, so excluded
    assert len(targets) == 0
    assert str(alice.id) not in targets


def test_chat_targets_no_mention_excludes_non_lead_members() -> None:
    """When no mentions and no broadcast, only lead receives messages."""
    lead = _agent("Ava", is_board_lead=True)
    alice = _agent("Alice")
    bob = _agent("Bob")

    targets = _chat_targets(
        agents=[lead, alice, bob],
        mentions=set(),
        actor=_user_actor(),
    )

    assert len(targets) == 1
    assert str(lead.id) in targets


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
