from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph
from langchain.agents import create_agent

from backend.agent.prompts import (
    architect_prompt,
    coder_system_prompt,
    planner_prompt,
)
from backend.agent.state import (
    AgentState,
    CoderState,
    Plan,
    TaskPlan,
)
from backend.agent.tools import (
    get_current_directory,
    list_files,
    read_file,
    write_file,
    safe_read_file,
)


load_dotenv()


llm = ChatOpenAI(
    model="gpt-4o",
    temperature=0.3,
)


# Utilise le JSON Schema natif au lieu du tool calling.
planner_llm = llm.with_structured_output(
    Plan,
    method="json_schema",
)

architect_llm = llm.with_structured_output(
    TaskPlan,
    method="json_schema",
)


def planner_agent(state: AgentState) -> dict:
    user_prompt = state["user_prompt"]

    response = planner_llm.invoke(
        planner_prompt(user_prompt)
    )

    if response is None:
        raise ValueError(
            "Planner agent failed to generate a plan."
        )

    return {
        "plan": response,
    }


def architect_agent(state: AgentState) -> dict:
    plan = state["plan"]

    response = architect_llm.invoke(
        architect_prompt(plan)
    )

    if response is None:
        raise ValueError(
            "Architect agent failed to generate a task plan."
        )

    return {
        "task_plan": response,
    }



def coder_agent(state: AgentState) -> dict:
    coder_state = state.get("coder_state")

    if coder_state is None:
        coder_state = CoderState(
            task_plan=state["task_plan"],
            current_step_idx=0,
            current_file_content=None,
        )

    steps = coder_state.task_plan.implementation_steps

    if coder_state.current_step_idx >= len(steps):
        return {
            "coder_state": coder_state,
            "status": "DONE",
        }

    current_task = steps[coder_state.current_step_idx]

    existing_content = safe_read_file(
        current_task.filepath
    )

    coder_state.current_file_content = existing_content

    user_prompt = f"""
        GLOBAL PROJECT PLAN:
        {state['plan'].model_dump_json(indent=2)}

        ALL IMPLEMENTATION STEPS:
        {steps}

        CURRENT STEP INDEX:
        {coder_state.current_step_idx}

        CURRENT TARGET FILE:
        {current_task.filepath}

        CURRENT TASK:
        {current_task.task_description}

        EXISTING TARGET FILE CONTENT:
        {existing_content if existing_content else "[The file does not exist yet]"}

        INSTRUCTIONS:
        - Implement the current task as part of the complete application.
        - Inspect related existing files using read_file before making assumptions.
        - Check the available project structure using list_files.
        - Make sure this file is connected to the other project files.
        - Use exactly the paths, imports, selectors, exports, and interfaces specified
        by the architecture.
        - If an existing related file is missing a required import or reference, update
        that file as well while preserving its useful content.
        - Write complete final file contents using write_file.
        - Do not only describe the changes.
    """

    coder_tools = [
        write_file,
        read_file,
        list_files,
        get_current_directory,
    ]

    react_agent = create_agent(
        model=llm,
        tools=coder_tools,
    )

    # La clé correcte est "messages", avec un s.
    result = react_agent.invoke(
        {
            "messages": [
                {
                    "role": "system",
                    "content": coder_system_prompt(),
                },
                {
                    "role": "user",
                    "content": user_prompt,
                },
            ]
        }
    )

    if not result:
        raise ValueError(
            f"Coder failed while implementing: "
            f"{current_task.filepath}"
        )

    coder_state.current_step_idx += 1
    coder_state.current_file_content = None

    is_finished = (
        coder_state.current_step_idx >= len(steps)
    )

    return {
        "coder_state": coder_state,
        "status": "DONE" if is_finished else "CODING",
    }


def coder_router(state: AgentState) -> str:
    if state.get("status") == "DONE":
        return "END"

    return "coder"


graph = StateGraph(AgentState)

graph.add_node("planner", planner_agent)
graph.add_node("architect", architect_agent)
graph.add_node("coder", coder_agent)

graph.add_edge("planner", "architect")
graph.add_edge("architect", "coder")

graph.add_conditional_edges(
    "coder",
    coder_router,
    {
        "END": END,
        "coder": "coder",
    },
)

graph.set_entry_point("planner")

agent = graph.compile()


if __name__ == "__main__":
    initial_state: AgentState = {
        "user_prompt": (
            "Create a simple calculator web application well functioning"
        )
    }

    result = agent.invoke(
        initial_state,
        {
            "recursion_limit": 100,
        },
    )

    print(result)