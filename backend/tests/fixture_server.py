"""Deterministic backend for browser tests. Never calls an external model."""

import asyncio
import json
import os
from pathlib import Path

os.environ["OPENAI_API_KEY"] = "browser-test-only"
os.environ["LANGSMITH_TRACING"] = "false"
os.environ["LANGCHAIN_TRACING_V2"] = "false"

from langchain_core.messages import AIMessageChunk
from backend import main, projects
from backend.agent.workspace import project_root

HTML = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><link rel="stylesheet" href="styles.css"></head><body><h1>Bonjour café</h1><p>Votre site prend vie.</p><button id="counter">Compteur : 0</button><script src="script.js" defer></script></body></html>'
CSS = 'body { background: #f5ebdf; color: #673f2d; padding: 40px; font-family: sans-serif; } h1 { font-size: 46px; } button { padding: 14px; border-radius: 9px; border: 0; background: #744730; color: white; }'
JS = 'let count = 0; document.querySelector("#counter").addEventListener("click", () => { document.querySelector("#counter").textContent = "Compteur : " + ++count; });'


class FixtureGraph:
    async def astream(self, state, *args, **kwargs):
        async def pause():
            await asyncio.sleep(1 if "lent" in state["user_prompt"] else 0.12)

        def event(data):
            return {"type": "custom", "ns": (), "data": data}

        yield event({"type": "stage", "stage": "planning", "message": "Je prépare votre site."})
        await pause()
        files = {"index.html": HTML, "styles.css": CSS, "script.js": JS}
        yield event({"type": "plan", "plan": {"name": "Maison Moka", "description": "Un café de quartier", "techstack": "HTML/CSS/JS", "features": ["Accueil", "Compteur interactif"], "files": [{"path": path, "purpose": "Site"} for path in files]}})
        yield event({"type": "tasks", "tasks": [{"filepath": path, "task_description": "Créer le fichier"} for path in files]})
        for index, (path, content) in enumerate(files.items()):
            yield event({"type": "stage", "stage": "coding", "message": f"Création de {path}", "path": path, "step": index + 1, "total": 3})
            args = json.dumps({"path": path, "content": content}, ensure_ascii=False)
            for offset in range(0, len(args), 60):
                message = AIMessageChunk(content="", id=f"msg-{index}", tool_call_chunks=[{"name": "write_file" if offset == 0 else None, "args": args[offset:offset + 60], "id": f"call-{index}" if offset == 0 else None, "index": 0}])
                yield {"type": "messages", "ns": ("coder",), "data": (message, {})}
                await pause()
            (project_root() / path).write_text(content, encoding="utf-8")
            yield event({"type": "file", "path": path, "content": content})
            yield event({"type": "task_done", "path": path, "step": index + 1, "total": 3})


projects.PROJECTS_ROOT = Path(__file__).resolve().parents[2] / ".test-artifacts" / "browser-projects"
main.get_agent = lambda: FixtureGraph()
app = main.app
