import json
from typing import TypedDict
from langgraph.graph import StateGraph, END
from app.config import client, MODEL
from app.tools import TOOLS_SCHEMA, AVAILABLE_TOOLS, search_corpus

class AgentState(TypedDict):
    question: str
    plan: str
    gathered_context: str
    review_notes: str
    final_answer: str

def plan_node(state: AgentState):
    """Step 1: Decompose the question into sub-questions or steps."""
    prompt = f"Decompose the following pharmacology question into clear, atomic sub-questions or search steps needed to gather all clinical facts.\nQuestion: {state['question']}"
    res = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}]
    )
    return {"plan": res.choices[0].message.content}

def agent_tools_node(state: AgentState):
    """Step 2 & 3: Retrieve and Use Tools dynamically driven by the agent."""
    messages = [
        {
            "role": "system",
            "content": (
                "You are a pharmacological research agent. You MUST call the provided tools (`search_corpus` and/or `lookup_glossary`) "
                "to retrieve facts from the local corpus before answering. Never rely on prior training knowledge."
            )
        },
        {
            "role": "user",
            "content": f"Question: {state['question']}\n\nResearch Plan:\n{state['plan']}"
        }
    ]
    
    collected_outputs = []
    
    for _ in range(4):
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            tools=TOOLS_SCHEMA,
            tool_choice="auto"
        )
        msg = response.choices[0].message
        
        # Convert Pydantic message to clean dict for LiteLLM compatibility
        messages.append(msg.model_dump(exclude_none=True))
        
        if not msg.tool_calls:
            break
            
        for tool_call in msg.tool_calls:
            func_name = tool_call.function.name
            func_args = json.loads(tool_call.function.arguments)
            
            tool_fn = AVAILABLE_TOOLS.get(func_name)
            observation = tool_fn(**func_args) if tool_fn else f"Error: Tool {func_name} not found."
            
            collected_outputs.append(f"=== Tool: {func_name} | Args: {func_args} ===\n{observation}")
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": observation
            })

    # Safety fallback if the model skipped tool calling on turn 1
    if not collected_outputs:
        fallback_obs = search_corpus(state["question"])
        collected_outputs.append(f"=== Fallback Retrieval ===\n{fallback_obs}")
            
    return {"gathered_context": "\n\n".join(collected_outputs)}

def review_node(state: AgentState):
    """Step 4: Critic step to verify grounding and flag unsupported claims."""
    prompt = f"""You are a strict clinical reviewer. Audit the retrieved context against the user's question.
Question: {state['question']}

Retrieved Context:
{state['gathered_context']}

Instructions:
1. Verify if every aspect of the question is grounded in the retrieved text.
2. Flag any missing information, unsupported claims, or clinically ambiguous statements.
3. Keep your audit concise and factual."""
    res = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}]
    )
    return {"review_notes": res.choices[0].message.content}

def answer_node(state: AgentState):
    """Step 5: Produce the final cited response with the required medical disclaimer."""
    prompt = f"""Answer the user's question based strictly on the retrieved context and taking into account the clinical review notes.

Question: {state['question']}

Retrieved Context:
{state['gathered_context']}

Clinical Review Notes:
{state['review_notes']}

Mandatory Rules:
1. STRICT GROUNDING: Use ONLY facts explicitly present in the Retrieved Context. Never use outside or general knowledge. If the retrieved context is unrelated to the question or lacks the answer, refuse to answer by stating ONLY: "The provided corpus does not contain information to answer this question." followed by "Sources: None", and stop there.
2. Otherwise, cite the exact source file(s) shown in `[Source File: ...]` inline and in a 'Sources:' section at the end (e.g., dailymed-warfarin.md).
3. Address any clinical nuances or ambiguities flagged by the reviewer.
4. End the response with this exact disclaimer: "Disclaimer: This output is for informational purposes only and is not medical advice." """
    res = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}]
    )
    return {"final_answer": res.choices[0].message.content}

workflow = StateGraph(AgentState)
workflow.add_node("plan", plan_node)
workflow.add_node("use_tools", agent_tools_node)
workflow.add_node("review", review_node)
workflow.add_node("answer", answer_node)

workflow.set_entry_point("plan")
workflow.add_edge("plan", "use_tools")
workflow.add_edge("use_tools", "review")
workflow.add_edge("review", "answer")
workflow.add_edge("answer", END)

app_graph = workflow.compile()

def run_agent(question: str) -> str:
    initial_state = {
        "question": question,
        "plan": "",
        "gathered_context": "",
        "review_notes": "",
        "final_answer": ""
    }
    result = app_graph.invoke(initial_state)
    return result["final_answer"]

def stream_agent(question: str):
    """Yields workflow progress steps and streams the final answer token by token."""
    initial_state = {
        "question": question,
        "plan": "",
        "gathered_context": "",
        "review_notes": "",
        "final_answer": ""
    }
    
    # Stream intermediate LangGraph nodes (plan -> use_tools -> review)
    for event in app_graph.stream(initial_state):
        for node_name, state_update in event.items():
            if node_name == "plan":
                yield json.dumps({"type": "status", "content": "Planification de la recherche..."}) + "\n"
            elif node_name == "use_tools":
                yield json.dumps({"type": "status", "content": "Consultation des monographies et du glossaire..."}) + "\n"
            elif node_name == "review":
                yield json.dumps({"type": "status", "content": "Vérification clinique (Critic)..."}) + "\n"
            elif node_name == "answer":
                # Simulate smooth word-by-word streaming of the verified answer
                final_text = state_update.get("final_answer", "")
                words = final_text.split(" ")
                for i, word in enumerate(words):
                    chunk = word + (" " if i < len(words) - 1 else "")
                    yield json.dumps({"type": "token", "content": chunk}) + "\n"