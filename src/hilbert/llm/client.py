"""LiteLLM wrapper for Hilbert with retry, streaming, and error handling."""

import asyncio
import os
import time
from typing import Any, AsyncGenerator, Dict, List, Optional
from pydantic import BaseModel

import litellm
from litellm import acompletion
from litellm.utils import ModelResponse


class LLMResponse(BaseModel):
    """Response from LLM."""

    content: str
    model: str
    usage: Dict[str, int]


class TokenUsage(BaseModel):
    """Token usage tracking."""

    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    cost_usd: float = 0.0


LLMError = litellm.APIError
RateLimitError = litellm.RateLimitError
AuthenticationError = litellm.AuthenticationError


class LLMClient:
    """Async LLM client using LiteLLM with retry logic."""

    MAX_RETRIES = 3
    BASE_DELAY = 1.0

    def __init__(
        self,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        max_retries: int = 3,
    ):
        self.model = model or os.getenv("HILBERT_MODEL", "openai/gpt-4o")
        self.api_key = api_key or os.getenv("HILBERT_API_KEY") or os.getenv("OPENAI_API_KEY")
        self.base_url = base_url
        self.max_retries = max_retries
        
        litellm.drop_params = True
        litellm.set_verbose = False
        litellm.suppress_debug_info = True

    def _build_params(self, messages: List[Dict], temperature: float = 0.7,
                   max_tokens: Optional[int] = None, stream: bool = False,
                   **kwargs) -> Dict[str, Any]:
        """Build request parameters."""
        params = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
        }

        if self.api_key:
            params["api_key"] = self.api_key
        if self.base_url:
            params["base_url"] = self.base_url
        if max_tokens:
            params["max_tokens"] = max_tokens
        if stream:
            params["stream"] = True

        params.update(kwargs)
        return params

    async def _attempt_completion(self, params: Dict[str, Any]) -> ModelResponse:
        """Attempt a single completion request."""
        return await acompletion(**params)

    async def _retry_complete(
        self,
        messages: List[Dict],
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        stream: bool = False,
        **kwargs,
    ) -> LLMResponse:
        """Complete with exponential backoff retry."""
        params = self._build_params(messages, temperature, max_tokens, stream, **kwargs)
        last_error = None

        for attempt in range(self.max_retries):
            try:
                response = await self._attempt_completion(params)

                if stream:
                    return response

                return LLMResponse(
                    content=response.choices[0].message.content or "",
                    model=response.model,
                    usage={
                        "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
                        "completion_tokens": response.usage.completion_tokens if response.usage else 0,
                        "total_tokens": response.usage.total_tokens if response.usage else 0,
                    },
                )

            except litellm.RateLimitError as e:
                last_error = e
                delay = self.BASE_DELAY * (2 ** attempt)
                await asyncio.sleep(delay)
                continue

            except litellm.APIError as e:
                last_error = e
                if attempt < self.max_retries - 1 and e.status_code in (429, 500, 502, 503):
                    delay = self.BASE_DELAY * (2 ** attempt)
                    await asyncio.sleep(delay)
                    continue
                raise LLMError(str(e)) from e

            except Exception as e:
                raise LLMError(f"Unexpected error: {e}") from e

        raise LLMError(f"Max retries ({self.max_retries}) exceeded: {last_error}")

    async def complete(
        self,
        messages: List[Dict],
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        stream: bool = False,
    ) -> LLMResponse:
        """Complete with retry logic."""
        return await self._retry_complete(messages, temperature, max_tokens, stream)

    async def complete_text(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        **kwargs,
    ) -> str:
        """Simple text completion."""
        messages: List[Dict] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = await self.complete(messages, **kwargs)
        return response.content

    async def complete_json(
        self,
        messages: List[Dict],
        **kwargs,
    ) -> Dict[str, Any]:
        """Complete and parse JSON response."""
        response = await self.complete(messages, **kwargs)

        try:
            import json
            return json.loads(response.content)
        except json.JSONDecodeError as e:
            raise LLMError(f"Failed to parse JSON: {e}") from e

    async def stream_complete(
        self,
        messages: List[Dict],
        **kwargs,
    ) -> AsyncGenerator[str, None]:
        """Stream completion as async generator."""
        params = self._build_params(messages, stream=True, **kwargs)

        response = await acompletion(**params)

        async for chunk in response:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


_client: Optional[LLMClient] = None


def get_client(model: Optional[str] = None) -> LLMClient:
    """Get LLM client singleton."""
    global _client
    if _client is None:
        _client = LLMClient(model=model)
    return _client


def set_client(client: LLMClient) -> None:
    """Set LLM client singleton."""
    global _client
    _client = client