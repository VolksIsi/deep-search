# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import datetime
import logging
import re
import asyncio
import json
import base64
from collections.abc import AsyncGenerator
from typing import Literal
from pathlib import Path

from google.adk.agents import BaseAgent, LlmAgent, LoopAgent, SequentialAgent
from google.adk.agents.callback_context import CallbackContext
from google.adk.agents.invocation_context import InvocationContext
from google.adk.apps.app import App
from google.adk.events import Event, EventActions
from google.adk.planners import BuiltInPlanner
from google.adk.tools.agent_tool import AgentTool
from google.genai import types as genai_types
from pydantic import BaseModel, Field
import requests
from bs4 import BeautifulSoup
import mcp.client.stdio as mcp_stdio
from mcp import ClientSession, StdioServerParameters

from .config import config
from .memory import (
    recall_memories, store_memory, save_session, save_report,
    get_recent_sessions
)


# --- Structured Output Models ---
class SearchQuery(BaseModel):
    """Model representing a specific search query for web search."""

    search_query: str = Field(
        description="A highly specific and targeted query for web search."
    )


class Feedback(BaseModel):
    """Model for providing evaluation feedback on research quality."""

    grade: Literal["pass", "fail"] = Field(
        description="Evaluation result. 'pass' if the research is sufficient, 'fail' if it needs revision."
    )
    comment: str = Field(
        description="Detailed explanation of the evaluation, highlighting strengths and/or weaknesses of the research."
    )
    follow_up_queries: list[SearchQuery] | None = Field(
        default=None,
        description="A list of specific, targeted follow-up search queries needed to fix research gaps. This should be null or empty if the grade is 'pass'.",
    )


# --- Callbacks ---
def collect_research_sources_callback(
    callback_context: CallbackContext,
) -> None:
    """Collects and organizes web-based research sources and their supported claims from agent events.

    This function processes the agent's `session.events` to extract web source details (URLs,
    titles, domains from `grounding_chunks`) and associated text segments with confidence scores
    (from `grounding_supports`). The aggregated source information and a mapping of URLs to short
    IDs are cumulatively stored in `callback_context.state`.

    Args:
        callback_context (CallbackContext): The context object providing access to the agent's
            session events and persistent state.
    """
    session = callback_context._invocation_context.session
    url_to_short_id = callback_context.state.get("url_to_short_id", {})
    sources = callback_context.state.get("sources", {})
    id_counter = len(url_to_short_id) + 1
    for event in session.events:
        if not (
            event.grounding_metadata
            and event.grounding_metadata.grounding_chunks
        ):
            continue
        chunks_info = {}
        for idx, chunk in enumerate(event.grounding_metadata.grounding_chunks):
            if not chunk.web:
                continue
            url = chunk.web.uri
            title = (
                chunk.web.title
                if chunk.web.title != chunk.web.domain
                else chunk.web.domain
            )
            if url not in url_to_short_id:
                short_id = f"src-{id_counter}"
                url_to_short_id[url] = short_id
                sources[short_id] = {
                    "short_id": short_id,
                    "title": title,
                    "url": url,
                    "domain": chunk.web.domain,
                    "supported_claims": [],
                }
                id_counter += 1
            chunks_info[idx] = url_to_short_id[url]
        if event.grounding_metadata.grounding_supports:
            for support in event.grounding_metadata.grounding_supports:
                confidence_scores = support.confidence_scores or []
                chunk_indices = support.grounding_chunk_indices or []
                for i, chunk_idx in enumerate(chunk_indices):
                    if chunk_idx in chunks_info:
                        short_id = chunks_info[chunk_idx]
                        confidence = (
                            confidence_scores[i]
                            if i < len(confidence_scores)
                            else 0.5
                        )
                        text_segment = (
                            support.segment.text if support.segment else ""
                        )
                        sources[short_id]["supported_claims"].append(
                            {
                                "text_segment": text_segment,
                                "confidence": confidence,
                            }
                        )
    callback_context.state["url_to_short_id"] = url_to_short_id

import time
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type

# --- New Tools ---
@retry(
    wait=wait_exponential(multiplier=1, min=2, max=10),
    stop=stop_after_attempt(3),
    retry=retry_if_exception_type(Exception), # Catch generic and resource exhausted
    reraise=True
)
def vertex_ai_search(query: str) -> str:
    """Searches the web using Vertex AI Discovery Engine (Grounded Generation API).
    
    Args:
        query (str): The search query to execute.
    """
    try:
        import os
        import google.auth
        from google.cloud import discoveryengine_v1 as discoveryengine
        
        credentials, project_id = google.auth.default()
        actual_project_id = config.gcp_project_id or project_id or os.environ.get("GOOGLE_CLOUD_PROJECT")
        
        if not actual_project_id:
            return "Error: Could not determine Google Cloud Project ID for Vertex AI Search."

        location = "global"
        engine_id = "deep-search-engine"
        
        # ABSOLUTELY FORCE GLOBAL ENDPOINT - This is required for Search Engines created as 'global'
        # The documentation states: discoveryengine.googleapis.com for global, but 
        # specifically for some projects 'global-discoveryengine.googleapis.com' helps.
        client_options = {"api_endpoint": "global-discoveryengine.googleapis.com"}
        client = discoveryengine.SearchServiceClient(credentials=credentials, client_options=client_options)
        
        # Re-derive project ID to be sure
        actual_project_id = config.gcp_project_id or project_id or os.environ.get("GOOGLE_CLOUD_PROJECT")
        
        serving_config = f"projects/{actual_project_id}/locations/{location}/collections/default_collection/engines/{engine_id}/servingConfigs/default_config"
        
        request = discoveryengine.SearchRequest(
            serving_config=serving_config,
            query=query,
            page_size=10,
            content_search_spec=discoveryengine.SearchRequest.ContentSearchSpec(
                summary_spec=discoveryengine.SearchRequest.ContentSearchSpec.SummarySpec(
                    summary_result_count=5,
                    include_citations=True,
                    ignore_adversarial_query=True,
                    model_spec=discoveryengine.SearchRequest.ContentSearchSpec.SummarySpec.ModelSpec(
                        version="stable"
                    )
                ),
                extractive_content_spec=discoveryengine.SearchRequest.ContentSearchSpec.ExtractiveContentSpec(
                    max_extractive_answer_count=3
                )
            )
        )

        # No fallback to us-central1 here, we must use GLOBAL for this engine
        response = client.search(request)
        
        output = [f"Vertex AI Summary:\n{response.summary.summary_text}\n"]
        
        output.append("Top Results Data:")
        for result in response.results:
            doc = result.document
            if doc.derived_struct_data:
                title = doc.derived_struct_data.get("title", "")
                link = doc.derived_struct_data.get("link", "")
                suffixes = doc.derived_struct_data.get("snippets", [])
                snippet_text = suffixes[0].get("snippet", "") if suffixes else ""
                output.append(f"- {title} ({link}): {snippet_text}")
        
        return "\n".join(output)
    except Exception as e:
        err_str = str(e).lower()
        if "429" in err_str or "exhausted" in err_str:
             print(f"Rate limit hit for query '{query}'. Retrying...")
             raise e
        return f"Vertex AI Search error: {str(e)}"

def web_scrape(url: str) -> str:
    """Scrapes the content of a web page and returns the text.
    
    Args:
        url (str): The URL of the web page to scrape.
    """
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove script and style elements
        for script_or_style in soup(["script", "style"]):
            script_or_style.decompose()
            
        # Get text and clean it
        text = soup.get_text(separator=' ')
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = ' '.join(chunk for chunk in chunks if chunk)
        
        return text[:10000] # Return first 10k characters
    except Exception as e:
        return f"Error scraping {url}: {str(e)}"

def search_uploaded_docs(query: str) -> str:
    """Searches through the content of uploaded documents in the local data directory.
    
    Args:
        query (str): The search query to match against documents.
    """
    data_dir = config.data_dir
    results = []
    
    if not data_dir.exists():
        return "No documents found."
        
    for file_path in data_dir.glob("*"):
        if file_path.suffix.lower() in [".txt", ".md", ".json", ".pdf", ".docx"]:
            try:
                content = ""
                if file_path.suffix == ".txt" or file_path.suffix == ".md":
                    content = file_path.read_text(encoding="utf-8")
                elif file_path.suffix == ".pdf":
                    from pypdf import PdfReader
                    reader = PdfReader(file_path)
                    for page in reader.pages:
                        content += page.extract_text()
                elif file_path.suffix == ".docx":
                    import docx
                    doc = docx.Document(file_path)
                    content = "\n".join([para.text for para in doc.paragraphs])
                elif file_path.suffix == ".json":
                    content = file_path.read_text(encoding="utf-8")
                
                # Simple keyword search for now (we can enhance this to semantic search later)
                if query.lower() in content.lower():
                    # Return a snippet
                    idx = content.lower().find(query.lower())
                    start = max(0, idx - 500)
                    end = min(len(content), idx + 1000)
                    results.append(f"--- Document: {file_path.name} ---\n{content[start:end]}...")
            except Exception as e:
                results.append(f"Error reading {file_path.name}: {str(e)}")
                
    if not results:
        return f"No results found for '{query}' in uploaded documents."
        
    return "\n\n".join(results)

async def mcp_query(query: str, server_params: str | None = None) -> str:
    """Queries an MCP server for specialized tools and data.
    
    Args:
        query (str): The query for the MCP server.
        server_params (str): JSON string of StdioServerParameters or server name from config.
    """
    if not config.mcp_servers and not server_params:
        return "No MCP servers configured. Connectivity is ready but no servers are active."
        
    try:
        # Use first configured server or the one provided
        server_cmd = config.mcp_servers[0] if config.mcp_servers else server_params
        
        # This is a simplified async client call
        # In a full-blown implementation, we'd manage sessions
        server_params = StdioServerParameters(command=server_cmd, args=[], env=None)
        
        async with mcp_stdio.stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                # List tools and find one that matches the query or just call a default 'query' tool
                tools = await session.list_tools()
                if tools.tools:
                    tool_name = tools.tools[0].name # Just use first tool for demo
                    result = await session.call_tool(tool_name, arguments={"query": query})
                    return f"MCP [{server_cmd}] Result: {str(result.content)}"
                
        return f"MCP [{server_cmd}] connected but no tools found."
    except Exception as e:
        return f"MCP connectivity error: {str(e)}"


def recall_past_research(query: str, user_id: str = "u_999") -> str:
    """Recalls relevant information from past research sessions.
    
    Args:
        query (str): The query to search past memories for.
        user_id (str): The user whose memory to search.
    """
    memories = recall_memories(user_id, query, limit=5)
    if not memories:
        return f"No past research found related to '{query}'."
    
    results = []
    for m in memories:
        results.append(
            f"--- Session: {m.get('topic', 'Unknown')} (Importance: {m['importance']}) ---\n"
            f"{m['content'][:500]}..."
        )
    return "\n\n".join(results)


def generate_chart(chart_type: str, data_json: str, title: str = "Chart") -> str:
    """Generates a chart/graph and returns it as a base64-encoded PNG.
    
    Args:
        chart_type (str): Type of chart: 'bar', 'line', 'pie', 'scatter', 'radar'.
        data_json (str): JSON string with keys 'labels' (list[str]) and 'values' (list[float]).
        title (str): Chart title.
    """
    try:
        import matplotlib
        matplotlib.use('Agg')  # Non-interactive backend
        import matplotlib.pyplot as plt
        import io
        
        data = json.loads(data_json)
        labels = data.get('labels', [])
        values = data.get('values', [])
        
        fig, ax = plt.subplots(figsize=(10, 6))
        fig.set_facecolor('#0a0a0f')
        ax.set_facecolor('#0a0a0f')
        
        colors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899']
        
        if chart_type == 'bar':
            bars = ax.bar(labels, values, color=colors[:len(labels)], edgecolor='none', width=0.6)
        elif chart_type == 'line':
            ax.plot(labels, values, color='#3b82f6', linewidth=2.5, marker='o', markersize=8, markerfacecolor='#8b5cf6')
            ax.fill_between(range(len(labels)), values, alpha=0.1, color='#3b82f6')
        elif chart_type == 'pie':
            ax.pie(values, labels=labels, colors=colors[:len(labels)], autopct='%1.1f%%',
                   textprops={'color': 'white', 'fontsize': 10})
        elif chart_type == 'scatter':
            ax.scatter(range(len(values)), values, c=colors[:len(values)], s=100, edgecolors='white', linewidth=0.5)
            for i, label in enumerate(labels):
                ax.annotate(label, (i, values[i]), textcoords="offset points", xytext=(0, 10),
                           ha='center', color='white', fontsize=8)
        
        ax.set_title(title, color='white', fontsize=16, fontweight='bold', pad=20)
        ax.tick_params(colors='#94a3b8')
        ax.spines['bottom'].set_color('#334155')
        ax.spines['left'].set_color('#334155')
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        
        if chart_type != 'pie':
            ax.set_axisbelow(True)
            ax.yaxis.grid(True, color='#1e293b', linestyle='--', alpha=0.5)
        
        plt.tight_layout()
        
        buf = io.BytesIO()
        fig.savefig(buf, format='png', dpi=150, bbox_inches='tight',
                    facecolor=fig.get_facecolor(), edgecolor='none')
        plt.close(fig)
        buf.seek(0)
        
        img_b64 = base64.b64encode(buf.read()).decode('utf-8')
        return f"Chart generated successfully. Base64 PNG data (first 50 chars): {img_b64[:50]}... Full chart stored for report embedding."
    except Exception as e:
        return f"Chart generation error: {str(e)}"


def citation_replacement_callback(
    callback_context: CallbackContext,
) -> genai_types.Content:
    """Replaces citation tags in a report with Markdown-formatted links.

    Processes 'final_cited_report' from context state, converting tags like
    `<cite source="src-N"/>` into hyperlinks using source information from
    `callback_context.state["sources"]`. Also fixes spacing around punctuation.

    Args:
        callback_context (CallbackContext): Contains the report and source information.

    Returns:
        genai_types.Content: The processed report with Markdown citation links.
    """
    final_report = callback_context.state.get("final_cited_report", "")
    sources = callback_context.state.get("sources", {})

    def tag_replacer(match: re.Match) -> str:
        short_id = match.group(1)
        if not (source_info := sources.get(short_id)):
            logging.warning(
                f"Invalid citation tag found and removed: {match.group(0)}"
            )
            return ""
        display_text = source_info.get(
            "title", source_info.get("domain", short_id)
        )
        return f" [{display_text}]({source_info['url']})"

    processed_report = re.sub(
        r'<cite\s+source\s*=\s*["\']?\s*(src-\d+)\s*["\']?\s*/>',
        tag_replacer,
        final_report,
    )
    processed_report = re.sub(r"\s+([.,;:])", r"\1", processed_report)
    callback_context.state["final_report_with_citations"] = processed_report
    
    # Persist report and key findings to memory
    try:
        session_id = str(callback_context._invocation_context.session.id)
        user_id = callback_context._invocation_context.session.user_id or "u_999"
        topic = callback_context.state.get("research_plan", "Unknown topic")[:200]
        
        save_report(session_id, user_id, topic, processed_report, sources)
        store_memory(session_id, user_id, f"Completed research on: {topic}", 
                     memory_type="report_completion", importance=0.9)
        
        # Store key findings as separate memories for future recall
        findings = callback_context.state.get("section_research_findings", "")
        if findings:
            store_memory(session_id, user_id, findings[:2000],
                         memory_type="research_findings", importance=0.7,
                         metadata={"topic": topic})
    except Exception as e:
        logging.warning(f"Memory persistence error: {e}")
    
    return genai_types.Content(parts=[genai_types.Part(text=processed_report)])


# --- Custom Agent for Loop Control ---
class EscalationChecker(BaseAgent):
    """Checks research evaluation and escalates to stop the loop if grade is 'pass'."""

    def __init__(self, name: str):
        super().__init__(name=name)

    async def _run_async_impl(
        self, ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:
        evaluation_result = ctx.session.state.get("research_evaluation")
        if evaluation_result and evaluation_result.get("grade") == "pass":
            logging.info(
                f"[{self.name}] Research evaluation passed. Escalating to stop loop."
            )
            yield Event(author=self.name, actions=EventActions(escalate=True))
        else:
            logging.info(
                f"[{self.name}] Research evaluation failed or not found. Loop will continue."
            )
            # Yielding an event without content or actions just lets the flow continue.
            yield Event(author=self.name)


# --- AGENT DEFINITIONS ---
plan_generator = LlmAgent(
    model=config.worker_model,
    name="plan_generator",
    description="Generates or refine the existing 5 line action-oriented research plan, using minimal search only for topic clarification.",
    instruction=f"""
    You are a research strategist. Your job is to create a high-level RESEARCH PLAN, not a summary. If there is already a RESEARCH PLAN in the session state,
    improve upon it based on the user feedback.

    RESEARCH PLAN(SO FAR):
    {{ research_plan? }}

    **GENERAL INSTRUCTION: CLASSIFY TASK TYPES**
    Your plan must clearly classify each goal for downstream execution. Each bullet point should start with a task type prefix:
    - **`[RESEARCH]`**: For goals that primarily involve information gathering, investigation, analysis, or data collection (these require search tool usage by a researcher).
    - **`[DELIVERABLE]`**: For goals that involve synthesizing collected information, creating structured outputs (e.g., tables, charts, summaries, reports), or compiling final output artifacts (these are executed AFTER research tasks, often without further search).

    **INITIAL RULE: Create a comprehensive roadmap. Your initial output MUST start with a bulleted list of 5-7 deep-dive research goals, followed by structurally-implied deliverables.**
    - All initial search-based goals will be classified as `[RESEARCH]` tasks.
    - Focus on multi-perspective analysis: Investigative, Comparative, Historical, and Futuristic views.
    - **Proactive Implied Deliverables (Initial):** Always suggest at least 2 structured outputs (e.g. Markdown tables, charts, or detailed executive summaries) prefixed with `[DELIVERABLE][IMPLIED]`.

    **REFINEMENT RULE**:
    - **Integrate Feedback & Mark Changes:** When incorporating user feedback, make targeted modifications to existing bullet points. Add `[MODIFIED]` to the existing task type and status prefix (e.g., `[RESEARCH][MODIFIED]`). If the feedback introduces new goals:
        - If it's an information gathering task, prefix it with `[RESEARCH][NEW]`.
        - If it's a synthesis or output creation task, prefix it with `[DELIVERABLE][NEW]`.
    - **Proactive Implied Deliverables (Refinement):** Beyond explicit user feedback, if the nature of an existing `[RESEARCH]` goal (e.g., requiring a structured comparison, deep dive analysis, or broad synthesis) or a `[DELIVERABLE]` goal inherently implies an additional, standard output or synthesis step (e.g., a detailed report following a summary, or a visual representation of complex data), proactively add this as a new goal. Phrase these as *synthesis or output creation actions* and prefix them with `[DELIVERABLE][IMPLIED]`.
    - **Maintain Order:** Strictly maintain the original sequential order of existing bullet points. New bullets, whether `[NEW]` or `[IMPLIED]`, should generally be appended to the list, unless the user explicitly instructs a specific insertion point.
    - **Flexible Length:** The refined plan is no longer constrained by the initial 5-bullet limit and may comprise more goals as needed to fully address the feedback and implied deliverables.

    **TOOL USE IS STRICTLY LIMITED:**
    Your goal is to create a generic, high-quality plan *without searching*.
    Only use `vertex_ai_search` if a topic is ambiguous or time-sensitive and you absolutely cannot create a plan without a key piece of identifying information.
    You are explicitly forbidden from researching the *content* or *themes* of the topic. That is the next agent's job. Your search is only to identify the subject, not to investigate it.
    Current date: {datetime.datetime.now().strftime("%Y-%m-%d")}
    """,
    tools=[vertex_ai_search, web_scrape, search_uploaded_docs, recall_past_research],
)


section_planner = LlmAgent(
    model=config.worker_model,
    name="section_planner",
    description="Breaks down the research plan into a structured markdown outline of report sections.",
    instruction="""
    You are an expert report architect. Using the research topic and the plan from the 'research_plan' state key, design a logical structure for the final report.
    Note: Ignore all the tag nanes ([MODIFIED], [NEW], [RESEARCH], [DELIVERABLE]) in the research plan.
    Your task is to create a markdown outline with 4-6 distinct sections that cover the topic comprehensively without overlap.
    You can use any markdown format you prefer, but here's a suggested structure:
    # Section Name
    A brief overview of what this section covers
    Feel free to add subsections or bullet points if needed to better organize the content.
    Make sure your outline is clear and easy to follow.
    Do not include a "References" or "Sources" section in your outline. Citations will be handled in-line.
    """,
    output_key="report_sections",
)


section_researcher = LlmAgent(
    model=config.worker_model,
    name="section_researcher",
    description="Performs the crucial first pass of web research.",
    planner=BuiltInPlanner(
        thinking_config=genai_types.ThinkingConfig(include_thoughts=True)
    ),
    instruction="""
    You are a highly capable and diligent research and synthesis agent. Your comprehensive task is to execute a provided research plan with **absolute fidelity**, first by gathering necessary information, and then by synthesizing that information into specified outputs.

    You will be provided with a sequential list of research plan goals, stored in the `research_plan` state key. Each goal will be clearly prefixed with its primary task type: `[RESEARCH]` or `[DELIVERABLE]`.

    Your execution process must strictly adhere to these two distinct and sequential phases:

    ---

    **Phase 1: Information Gathering (`[RESEARCH]` Tasks)**

    *   **Execution Directive:** You **MUST** systematically process every goal prefixed with `[RESEARCH]` before proceeding to Phase 2.
    *   For each `[RESEARCH]` goal:
        *   **Query Generation:** Formulate a comprehensive set of 4-5 targeted search queries. These queries must be expertly designed to broadly cover the specific intent of the `[RESEARCH]` goal from multiple angles.
        *   **Execution:** Utilize the `vertex_ai_search`, `web_scrape`, `search_uploaded_docs`, and `mcp_query` tools to execute **all** generated queries for the current `[RESEARCH]` goal. Use `search_uploaded_docs` if the goal specifically mentions local files or documents. Use `web_scrape` if you need detailed content from a specific URL. Use `mcp_query` for specialized domain knowledge if available.
        *   **Summarization:** Synthesize the search results into a detailed, coherent summary that directly addresses the objective of the `[RESEARCH]` goal.
        *   **Internal Storage:** Store this summary, clearly tagged or indexed by its corresponding `[RESEARCH]` goal, for later and exclusive use in Phase 2. You **MUST NOT** lose or discard any generated summaries.

    ---

    **Phase 2: Synthesis and Output Creation (`[DELIVERABLE]` Tasks)**

    *   **Execution Prerequisite:** This phase **MUST ONLY COMMENCE** once **ALL** `[RESEARCH]` goals from Phase 1 have been fully completed and their summaries are internally stored.
    *   **Execution Directive:** You **MUST** systematically process **every** goal prefixed with `[DELIVERABLE]`. For each `[DELIVERABLE]` goal, your directive is to **PRODUCE** the artifact as explicitly described.
    *   For each `[DELIVERABLE]` goal:
        *   **Instruction Interpretation:** You will interpret the goal's text (following the `[DELIVERABLE]` tag) as a **direct and non-negotiable instruction** to generate a specific output artifact.
            *   *If the instruction details a table (e.g., "Create a Detailed Comparison Table in Markdown format"), your output for this step **MUST** be a properly formatted Markdown table utilizing columns and rows as implied by the instruction and the prepared data.*
            *   *If the instruction states to prepare a summary, report, or any other structured output, your output for this step **MUST** be that precise artifact.*
        *   **Data Consolidation:** Access and utilize **ONLY** the summaries generated during Phase 1 (`[RESEARCH]` tasks`) to fulfill the requirements of the current `[DELIVERABLE]` goal. You **MUST NOT** perform new searches.
        *   **Output Generation:** Based on the specific instruction of the `[DELIVERABLE]` goal:
            *   Carefully extract, organize, and synthesize the relevant information from your previously gathered summaries.
            *   Must always produce the specified output artifact (e.g., a concise summary, a structured comparison table, a comprehensive report, a visual representation, etc.) with accuracy and completeness.
        *   **Output Accumulation:** Maintain and accumulate **all** the generated `[DELIVERABLE]` artifacts. These are your final outputs.

    ---

    **Final Output:** Your final output will comprise the complete set of processed summaries from `[RESEARCH]` tasks AND all the generated artifacts from `[DELIVERABLE]` tasks, presented clearly and distinctly.
    """,
    tools=[vertex_ai_search, web_scrape, search_uploaded_docs, mcp_query],
    output_key="section_research_findings",
    after_agent_callback=collect_research_sources_callback,
)

research_evaluator = LlmAgent(
    model=config.critic_model,
    name="research_evaluator",
    description="Critically evaluates research and generates follow-up queries.",
    instruction=f"""
    You are a meticulous quality assurance analyst evaluating the research findings in 'section_research_findings'.

    **CRITICAL RULES:**
    1. Assume the given research topic is correct. Do not question or try to verify the subject itself.
    2. Your ONLY job is to assess the quality, depth, and completeness of the research provided *for that topic*.
    3. Focus on evaluating: Comprehensiveness of coverage, logical flow and organization, use of credible sources, depth of analysis, and clarity of explanations.
    4. Do NOT fact-check or question the fundamental premise or timeline of the topic.
    5. If suggesting follow-up queries, they should dive deeper into the existing topic, not question its validity.

    Be very critical about the QUALITY of research. If you find significant gaps in depth or coverage, assign a grade of "fail",
    write a detailed comment about what's missing, and generate 5-7 specific follow-up queries to fill those gaps.
    If the research thoroughly covers the topic, grade "pass".

    Current date: {datetime.datetime.now().strftime("%Y-%m-%d")}
    Your response must be a single, raw JSON object validating against the 'Feedback' schema.
    """,
    output_schema=Feedback,
    disallow_transfer_to_parent=True,
    disallow_transfer_to_peers=True,
    output_key="research_evaluation",
)

enhanced_search_executor = LlmAgent(
    model=config.worker_model,
    name="enhanced_search_executor",
    description="Executes follow-up searches and integrates new findings.",
    planner=BuiltInPlanner(
        thinking_config=genai_types.ThinkingConfig(include_thoughts=True)
    ),
    instruction="""
    You are a specialist researcher executing a refinement pass.
    You have been activated because the previous research was graded as 'fail'.

    1.  Review the 'research_evaluation' state key to understand the feedback and required fixes.
    2.  Execute EVERY query listed in 'follow_up_queries' using the most appropriate tool (`vertex_ai_search`, `web_scrape`, `search_uploaded_docs`, or `mcp_query`).
    3.  Synthesize the new findings and COMBINE them with the existing information in 'section_research_findings'.
    4.  Your output MUST be the new, complete, and improved set of research findings.
    """,
    tools=[vertex_ai_search, web_scrape, search_uploaded_docs, mcp_query],
    output_key="section_research_findings",
    after_agent_callback=collect_research_sources_callback,
)

report_composer = LlmAgent(
    model=config.critic_model,
    name="report_composer_with_citations",
    include_contents="none",
    description="Transforms research data and a markdown outline into a final, cited report.",
    instruction="""
    Transform the provided data into a polished, professional, and meticulously cited research report.

    ---
    ### INPUT DATA
    *   Research Plan: `{research_plan}`
    *   Research Findings: `{section_research_findings}`
    *   Citation Sources: `{sources}`
    *   Report Structure: `{report_sections}`

    ---
    ### CRITICAL: Citation System
    To cite a source, you MUST insert a special citation tag directly after the claim it supports.

    **The only correct format is:** `<cite source="src-ID_NUMBER" />`

    ---
    ### Final Instructions
    Generate a comprehensive report using ONLY the `<cite source="src-ID_NUMBER" />` tag system for all citations.
    The final report must strictly follow the structure provided in the **Report Structure** markdown outline.
    Do not include a "References" or "Sources" section; all citations must be in-line.
    """,
    output_key="final_cited_report",
    after_agent_callback=citation_replacement_callback,
)

research_pipeline = SequentialAgent(
    name="research_pipeline",
    description="Executes a pre-approved research plan. It performs iterative research, evaluation, and composes a final, cited report.",
    sub_agents=[
        section_planner,
        section_researcher,
        LoopAgent(
            name="iterative_refinement_loop",
            max_iterations=config.max_search_iterations,
            sub_agents=[
                research_evaluator,
                EscalationChecker(name="escalation_checker"),
                enhanced_search_executor,
            ],
        ),
        report_composer,
    ],
)

interactive_planner_agent = LlmAgent(
    name="interactive_planner_agent",
    model=config.worker_model,
    description="The primary research assistant. It collaborates with the user to create a research plan, and then executes it upon approval.",
    instruction=f"""
    You are a research planning assistant. Your primary function is to convert ANY user request into a research plan.

    **CRITICAL RULE: Never answer a question directly or refuse a request.** Your one and only first step is to use the `plan_generator` tool to propose a research plan for the user's topic.
    If the user asks a question, you MUST immediately call `plan_generator` to create a plan to answer the question.

    Your workflow is:
    1.  **Plan:** Use `plan_generator` to create a draft plan and present it to the user.
    2.  **Refine:** Incorporate user feedback until the plan is approved.
    3.  **Execute:** Once the user gives EXPLICIT approval (e.g., "looks good, run it"), you MUST delegate the task to the `research_pipeline` agent, passing the approved plan.

    Current date: {datetime.datetime.now().strftime("%Y-%m-%d")}
    Do not perform any research yourself. Your job is to Plan, Refine, and Delegate.
    """,
    sub_agents=[research_pipeline],
    tools=[AgentTool(plan_generator)],
    output_key="research_plan",
)

root_agent = interactive_planner_agent
app = App(root_agent=root_agent, name="app")
