# LLM Prompt Tuning

**Contributor:** Vivek  
**Project:** LPI Intelligent Tutor

## Scope

My task is to improve the output produced by the existing LLM through prompt
engineering. I did not train new model weights. I improved the instructions
sent to the LLM through the Groq API.

## Improvements Completed

### 1. Better tutor responses

The tutor prompt now asks the LLM to:

- Use the retrieved course material for factual answers.
- Avoid inventing information.
- Say when the answer is not available in the course material.
- Explain the topic according to the student's selected level.
- Give a direct explanation, a useful example, and a short question for the
  student.

### 2. Clear separation of course content

Retrieved content is placed inside `<course_material>` tags. The prompt tells
the LLM to treat this text as study material, not as instructions. This helps
prevent unrelated instructions inside a document from changing the response.

### 3. Prerequisite-aware explanations

When a topic has prerequisites, the LLM first gives a short overview of those
prerequisites and then explains the requested topic.

### 4. Improved prerequisite generation

The prerequisite prompt now tells the LLM to:

- Use only topics supplied by the application.
- Include every topic exactly once.
- Preserve topic names.
- Avoid self-dependencies and circular dependencies.
- Return no more than four prerequisites for one topic.

### 5. Prompt versioning and tests

The tutor prompt is identified as `v2-grounded-tutor`. Tests verify that the
important instructions are present and that prerequisites appear before the
main explanation.

## Files Related To My Task

- `backend/response_generation.py` - tutor prompt improvements.
- `backend/prerequisite_generator.py` - prerequisite prompt improvements.
- `tests/test_response_generation.py` - prompt tests.

## Validation

- Python compilation passed.
- Prompt smoke test passed without requiring an API call.
- No diagnostics were reported in the edited files.

## Simple Explanation For Review

> My contribution was prompt tuning. I improved the LLM instructions so the
> tutor gives course-grounded, level-appropriate, structured answers. I also
> improved prerequisite generation and added tests to verify the prompt rules.
