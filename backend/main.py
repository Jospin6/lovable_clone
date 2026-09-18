from dotenv import load_dotenv
from langchain_groq import ChatGroq

load_dotenv()
from backend.agent.prompts import planner_prompt
from backend.agent.state import Plan

llm = ChatGroq(model="openai/gpt-oss-120b")

structured_llm = llm.with_structured_output(Plan)

users_prompt = "create a simple calculator web application"

result = structured_llm.invoke(
    planner_prompt(users_prompt)
)

print(result)