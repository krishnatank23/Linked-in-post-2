from typing import Any
from PyPDF2 import PdfReader
from docx import Document
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from dotenv import load_dotenv

load_dotenv()

RESUME_PARSER_PROMPT = """You are an expert resume and LinkedIn profile analyzer. 
Your job is to extract ALL structured information from the given resume/profile text.

Extract the following information in a structured JSON format:

{{
    "personal_info": {{
        "full_name": "...",
        "email": "...",
        "phone": "...",
        "location": "...",
        "linkedin_url": "...",
        "portfolio_url": "..."
    }},
    "professional_summary": "A brief professional summary from the resume",
    "experience": [
        {{
            "company": "...",
            "role": "...",
            "duration": "...",
            "description": "...",
            "key_achievements": ["..."]
        }}
    ],
    "education": [
        {{
            "institution": "...",
            "degree": "...",
            "field_of_study": "...",
            "year": "..."
        }}
    ],
    "skills": {{
        "technical_skills": ["..."],
        "soft_skills": ["..."],
        "tools_and_technologies": ["..."],
        "languages": ["..."]
    }},
    "certifications": ["..."],
    "projects": [
        {{
            "name": "...",
            "description": "...",
            "technologies_used": ["..."]
        }}
    ],
    "achievements_and_awards": ["..."],
    "interests": ["..."],
    "total_years_of_experience": "...",
    "current_role": "...",
    "industry": "...",
    "expertise_areas": ["..."]
}}

If any field is not found in the resume, use null or an empty array.
Be thorough and extract every possible detail.

Resume Text:
{resume_text}

Return ONLY the JSON object, no markdown fences, no extra text.
"""


def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from a PDF file."""
    reader = PdfReader(file_path)
    text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"
    return text.strip()


def extract_text_from_docx(file_path: str) -> str:
    """Extract text from a DOCX file."""
    doc = Document(file_path)
    text = ""
    for paragraph in doc.paragraphs:
        text += paragraph.text + "\n"
    # Also extract from tables
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                text += cell.text + "\n"
    return text.strip()


def extract_resume_text(file_path: str) -> str:
    """Extract text from resume file based on extension."""
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".pdf":
        return extract_text_from_pdf(file_path)
    elif ext in [".docx", ".doc"]:
        return extract_text_from_docx(file_path)
    else:
        raise ValueError(f"Unsupported file format: {ext}")


async def run_resume_parser(file_path: str) -> dict[str, Any]:
    """
    Agent 1: Parse resume and extract structured data using Groq LLM.
    Returns a dict with status, output, and optional error.
    """
    try:
        # Step 1: Extract raw text from resume file
        resume_text = extract_resume_text(file_path)

        if not resume_text or len(resume_text.strip()) < 50:
            return {
                "status": "error",
                "output": None,
                "error": "Could not extract sufficient text from the resume. Please upload a valid PDF or DOCX file.",
            }

        # Step 2: Use Groq LLM to parse and structure the resume
        llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            temperature=0.1,
            api_key=os.getenv("GROQ_API_KEY"),
        )

        prompt = ChatPromptTemplate.from_template(RESUME_PARSER_PROMPT)
        chain = prompt | llm

        response = await chain.ainvoke({"resume_text": resume_text})

        # Parse the JSON response
        import json
        content = response.content.strip()
        # Clean up potential markdown fences
        if content.startswith("```"):
            content = content.split("\n", 1)[1] if "\n" in content else content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        if content.startswith("json"):
            content = content[4:].strip()

        parsed_data = json.loads(content)

        return {
            "status": "success",
            "output": {
                "raw_text_length": len(resume_text),
                "parsed_profile": parsed_data,
            },
            "error": None,
        }

    except json.JSONDecodeError as e:
        return {
            "status": "error",
            "output": {"raw_response": content if 'content' in dir() else "N/A"},
            "error": f"Failed to parse LLM response as JSON: {str(e)}",
        }
    except Exception as e:
        return {
            "status": "error",
            "output": None,
            "error": f"Resume parser failed: {str(e)}\n{traceback.format_exc()}",
        }
