"""
LLM Client — supports both Anthropic and OpenAI-compatible APIs.
Detects which provider to use based on the API key prefix.
"""

import json
import re
from typing import Optional, Dict, Any, List

from ..config import Config


class LLMClient:
    """Unified LLM client that auto-detects Anthropic vs OpenAI."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None
    ):
        self.api_key = api_key or Config.LLM_API_KEY
        self.base_url = base_url or Config.LLM_BASE_URL
        self.model = model or Config.LLM_MODEL_NAME

        if not self.api_key:
            raise ValueError("LLM_API_KEY not configured")

        # Auto-detect provider from API key
        self.is_anthropic = self.api_key.startswith('sk-ant-')

        # Some OpenAI-compatible gateways (e.g. Eliza Cloud, behind Cloudflare)
        # 403 "Your request was blocked" for non-browser User-Agents — including
        # the default OpenAI SDK UA. Send a browser UA so the edge lets us through.
        browser_ua = (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
        )

        if self.is_anthropic:
            from anthropic import Anthropic
            self.client = Anthropic(
                api_key=self.api_key,
                default_headers={"User-Agent": browser_ua},
            )
        else:
            from openai import OpenAI
            self.client = OpenAI(
                api_key=self.api_key,
                base_url=self.base_url,
                default_headers={"User-Agent": browser_ua},
            )

    def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 4096,
        response_format: Optional[Dict] = None
    ) -> str:
        """
        Send a chat request and return the response text.

        Args:
            messages: List of message dicts with 'role' and 'content'
            temperature: Temperature parameter
            max_tokens: Max tokens in response
            response_format: Response format hint (OpenAI only)

        Returns:
            Model response text
        """
        if self.is_anthropic:
            return self._chat_anthropic(messages, temperature, max_tokens, response_format)
        else:
            return self._chat_openai(messages, temperature, max_tokens, response_format)

    def _chat_anthropic(
        self,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int,
        response_format: Optional[Dict] = None
    ) -> str:
        # Extract system message if present
        system_msg = ""
        chat_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system_msg = msg["content"]
            else:
                chat_messages.append(msg)

        # If JSON format requested, add instruction to system prompt
        if response_format and response_format.get("type") == "json_object":
            json_instruction = "\n\nYou must respond with valid JSON only. No markdown code fences, no explanation — just the JSON object."
            system_msg += json_instruction

        kwargs = {
            "model": self.model,
            "messages": chat_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        if system_msg:
            kwargs["system"] = system_msg

        response = self.client.messages.create(**kwargs)
        content = response.content[0].text
        return content

    def _chat_openai(
        self,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int,
        response_format: Optional[Dict] = None
    ) -> str:
        kwargs = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        if response_format:
            kwargs["response_format"] = response_format

        response = self.client.chat.completions.create(**kwargs)
        content = response.choices[0].message.content
        # Strip <think> tags from reasoning models
        content = re.sub(r'<think>[\s\S]*?</think>', '', content).strip()
        return content

    def chat_json(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.3,
        max_tokens: int = 4096
    ) -> Dict[str, Any]:
        """
        Send a chat request and parse the response as JSON.

        Args:
            messages: List of message dicts
            temperature: Temperature parameter
            max_tokens: Max tokens

        Returns:
            Parsed JSON object
        """
        response = self.chat(
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format={"type": "json_object"}
        )

        # Clean markdown code block markers
        cleaned = response.strip()
        cleaned = re.sub(r'^```(?:json)?\s*\n?', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'\n?```\s*$', '', cleaned)
        cleaned = cleaned.strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            raise ValueError(f"LLM returned invalid JSON: {cleaned[:200]}")
