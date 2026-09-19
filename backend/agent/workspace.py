"""Per-run filesystem context, inherited by LangGraph nodes and tools."""

from contextlib import contextmanager
from contextvars import ContextVar
from pathlib import Path

LEGACY_ROOT = Path(__file__).resolve().parents[2] / "generated_project"
_root: ContextVar[Path] = ContextVar("project_root", default=LEGACY_ROOT)


def project_root() -> Path:
    return _root.get().resolve()


@contextmanager
def project_workspace(root: Path):
    root.mkdir(parents=True, exist_ok=True)
    token = _root.set(root.resolve())
    try:
        yield
    finally:
        _root.reset(token)


def emit(event: dict) -> None:
    # Tools also remain usable outside a running graph (CLI, tests).
    from langgraph.config import get_stream_writer

    try:
        writer = get_stream_writer()
    except (RuntimeError, KeyError):
        return
    writer(event)
