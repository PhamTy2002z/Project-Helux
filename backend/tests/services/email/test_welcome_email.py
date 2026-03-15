# ruff: noqa: INP001, S101
"""Tests for welcome email message builder."""

from __future__ import annotations

import pytest

from app.services.email.welcome_email import (
    WelcomeEmailRenderInput,
    _display_name,
    build_welcome_email,
)


class TestDisplayName:
    """Tests for _display_name helper function."""

    def test_returns_name_when_provided(self) -> None:
        assert _display_name("Alice") == "Alice"

    def test_strips_whitespace(self) -> None:
        assert _display_name("  Bob  ") == "Bob"

    def test_returns_there_when_empty(self) -> None:
        assert _display_name("") == "there"

    def test_returns_there_when_only_whitespace(self) -> None:
        assert _display_name("   ") == "there"


class TestBuildWelcomeEmail:
    """Tests for build_welcome_email function."""

    def test_returns_valid_welcome_email_content(self) -> None:
        payload = WelcomeEmailRenderInput(
            first_name="Alice",
            dashboard_url="https://example.com/dashboard",
        )
        content = build_welcome_email(payload)

        assert content.subject is not None
        assert content.text is not None
        assert content.html is not None
        assert len(content.subject) > 0
        assert len(content.text) > 0
        assert len(content.html) > 0

    def test_subject_contains_first_name(self) -> None:
        payload = WelcomeEmailRenderInput(
            first_name="Charlie",
            dashboard_url="https://example.com/dashboard",
        )
        content = build_welcome_email(payload)

        assert "Charlie" in content.subject
        assert "Welcome to FlowGrid" in content.subject

    def test_subject_fallback_to_there_when_empty(self) -> None:
        payload = WelcomeEmailRenderInput(
            first_name="",
            dashboard_url="https://example.com/dashboard",
        )
        content = build_welcome_email(payload)

        assert "there" in content.subject
        assert "Welcome to FlowGrid, there!" in content.subject

    def test_text_contains_greeting(self) -> None:
        payload = WelcomeEmailRenderInput(
            first_name="David",
            dashboard_url="https://example.com/dashboard",
        )
        content = build_welcome_email(payload)

        assert "Hi David," in content.text
        assert "Welcome to FlowGrid" in content.text

    def test_text_contains_dashboard_url(self) -> None:
        dashboard_url = "https://example.com/dashboard"
        payload = WelcomeEmailRenderInput(
            first_name="Eve",
            dashboard_url=dashboard_url,
        )
        content = build_welcome_email(payload)

        assert dashboard_url in content.text

    def test_html_is_valid_html(self) -> None:
        payload = WelcomeEmailRenderInput(
            first_name="Frank",
            dashboard_url="https://example.com/dashboard",
        )
        content = build_welcome_email(payload)

        assert content.html.startswith("<!DOCTYPE html>")
        assert "<html" in content.html
        assert "</html>" in content.html
        assert "<body" in content.html
        assert "</body>" in content.html

    def test_html_contains_cta_button_with_dashboard_url(self) -> None:
        dashboard_url = "https://example.com/dashboard"
        payload = WelcomeEmailRenderInput(
            first_name="Grace",
            dashboard_url=dashboard_url,
        )
        content = build_welcome_email(payload)

        assert "Go to Dashboard" in content.html
        assert dashboard_url in content.html
        assert f'href="{dashboard_url}"' in content.html

    def test_html_contains_fallback_link_to_dashboard(self) -> None:
        dashboard_url = "https://example.com/dashboard"
        payload = WelcomeEmailRenderInput(
            first_name="Henry",
            dashboard_url=dashboard_url,
        )
        content = build_welcome_email(payload)

        assert "If the button doesn't work" in content.html
        assert dashboard_url in content.html

    def test_html_escapes_first_name_for_xss_safety(self) -> None:
        payload = WelcomeEmailRenderInput(
            first_name="<script>alert('xss')</script>",
            dashboard_url="https://example.com/dashboard",
        )
        content = build_welcome_email(payload)

        # HTML-escaped version should not contain the raw script tag
        assert "<script>" not in content.html
        assert "&lt;script&gt;" in content.html

    def test_html_escapes_dashboard_url_for_xss_safety(self) -> None:
        payload = WelcomeEmailRenderInput(
            first_name="Ivan",
            dashboard_url='https://example.com/dashboard?param="bad"',
        )
        content = build_welcome_email(payload)

        # URL should be properly escaped in href attributes
        assert '&quot;' in content.html
        assert 'href="https://example.com/dashboard?param=&quot;bad&quot;"' in content.html

    def test_html_contains_flowgrid_branding(self) -> None:
        payload = WelcomeEmailRenderInput(
            first_name="Jack",
            dashboard_url="https://example.com/dashboard",
        )
        content = build_welcome_email(payload)

        assert "FlowGrid" in content.html
        assert "Welcome aboard" in content.html

    def test_html_has_responsive_structure(self) -> None:
        payload = WelcomeEmailRenderInput(
            first_name="Karen",
            dashboard_url="https://example.com/dashboard",
        )
        content = build_welcome_email(payload)

        assert 'role="presentation"' in content.html
        assert 'name="viewport"' in content.html
        assert "width=device-width" in content.html

    def test_html_contains_footer_disclaimer(self) -> None:
        payload = WelcomeEmailRenderInput(
            first_name="Larry",
            dashboard_url="https://example.com/dashboard",
        )
        content = build_welcome_email(payload)

        assert "You received this because you signed up" in content.html
        assert "safely ignore" in content.html
