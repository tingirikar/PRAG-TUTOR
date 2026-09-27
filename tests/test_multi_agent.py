import asyncio
import os
import sys
import pytest

# Ensure backend directory is in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from agents.state import TutorState
from agents.supervisor_agent import SupervisorAgent
from agents.prerequisite_agent import PrerequisiteAgent
from agents.retrieval_agent import RetrievalAgent
from agents.pedagogical_agent import PedagogicalAgent
from agents.visual_agent import VisualAgent
from agents.critic_agent import CriticAgent
from agents.orchestrator import TutorMultiAgentOrchestrator


@pytest.mark.asyncio
async def test_supervisor_intent_classification():
    supervisor = SupervisorAgent()

    # Test greeting
    state_greeting = TutorState(query="Hello there!")
    intent = await supervisor.classify(state_greeting)
    assert intent == "greeting"

    # Test quiz
    state_quiz = TutorState(query="Give me a quiz on CNNs")
    intent = await supervisor.classify(state_quiz)
    assert intent == "quiz"

    # Test standard question
    state_question = TutorState(query="Explain how gradient descent works")
    intent = await supervisor.classify(state_question)
    assert intent == "question"


@pytest.mark.asyncio
async def test_supervisor_topic_identification():
    supervisor = SupervisorAgent()
    known = ["Convolutional Neural Networks", "Backpropagation", "Gradient Descent"]

    state = TutorState(query="Can you explain Convolutional Neural Networks?")
    topic = await supervisor.identify_topic(state, known_topics=known)
    assert topic == "Convolutional Neural Networks"

    # Fallback to regex stripping
    state_generic = TutorState(query="What is a learning rate?")
    topic_generic = await supervisor.identify_topic(state_generic, known_topics=[])
    assert topic_generic.lower() == "a learning rate" or "learning rate" in topic_generic.lower()


def test_prerequisite_agent():
    prereqs = {
        "Backpropagation": ["Gradient Descent", "Chain Rule"],
        "Convolutional Neural Networks": ["Feedforward Networks", "Matrix Multiplication"]
    }
    agent = PrerequisiteAgent(prereqs)

    # Exact match
    assert agent.get_prerequisites("Backpropagation") == ["Gradient Descent", "Chain Rule"]

    # Case-insensitive match
    assert agent.get_prerequisites("backpropagation") == ["Gradient Descent", "Chain Rule"]

    # Partial / substring match
    res = agent.get_prerequisites("convolutional neural network")
    assert "Feedforward Networks" in res

    # Unknown topic
    assert agent.get_prerequisites("Unknown Alien Concept") == []


def test_pedagogical_agent_prompt_building():
    agent = PedagogicalAgent()
    state = TutorState(
        query="What is Backpropagation?",
        level="beginner",
        topic="Backpropagation",
        prerequisites=["Gradient Descent", "Chain Rule"],
        critique_feedback="Simplify the chain rule analogy."
    )
    prompt = agent._build_prompt(state)

    assert "Backpropagation" in prompt
    assert "beginner" in prompt
    assert "Gradient Descent, Chain Rule" in prompt
    assert "CRITICAL REVISION INSTRUCTIONS" in prompt
    assert "Simplify the chain rule analogy" in prompt


@pytest.mark.asyncio
async def test_critic_agent_default_approval():
    critic = CriticAgent()
    state = TutorState(query="Hello", draft_response="Hello! I am your tutor.")
    result = await critic.evaluate(state)
    assert result["approved"] is True


@pytest.mark.asyncio
async def test_orchestrator_greeting_flow():
    supervisor = SupervisorAgent()
    prereq_agent = PrerequisiteAgent({"Topic A": ["Prereq 1"]})
    retrieval_agent = RetrievalAgent(pinecone_index=None, embedding_model=None)
    pedagogical_agent = PedagogicalAgent()
    visual_agent = VisualAgent(image_handler=None)
    critic_agent = CriticAgent()

    orchestrator = TutorMultiAgentOrchestrator(
        supervisor=supervisor,
        prerequisite_agent=prereq_agent,
        retrieval_agent=retrieval_agent,
        pedagogical_agent=pedagogical_agent,
        visual_agent=visual_agent,
        critic_agent=critic_agent,
    )

    result = await orchestrator.run("Hello!", level="beginner")
    assert "LPI Intelligent Course Tutor" in result["response"]
    assert result["topic"] is None
    assert result["sources"] == []


@pytest.mark.asyncio
async def test_orchestrator_full_workflow():
    class DummyGroqMessage:
        content = "Convolutional Neural Networks process image grids through filters."

    class DummyChoice:
        message = DummyGroqMessage()

    class DummyGroqResponse:
        choices = [DummyChoice()]

    class DummyGroqClient:
        class chat:
            class completions:
                @staticmethod
                def create(*args, **kwargs):
                    return DummyGroqResponse()

    supervisor = SupervisorAgent()
    prereq_agent = PrerequisiteAgent({"CNN": ["Linear Algebra", "Perceptrons"]})
    retrieval_agent = RetrievalAgent(pinecone_index=None, embedding_model=None)
    pedagogical_agent = PedagogicalAgent(groq_client=DummyGroqClient())
    visual_agent = VisualAgent(image_handler=None)
    critic_agent = CriticAgent(groq_client=DummyGroqClient())

    orchestrator = TutorMultiAgentOrchestrator(
        supervisor=supervisor,
        prerequisite_agent=prereq_agent,
        retrieval_agent=retrieval_agent,
        pedagogical_agent=pedagogical_agent,
        visual_agent=visual_agent,
        critic_agent=critic_agent,
    )

    output = await orchestrator.run("Tell me about CNN", level="beginner")

    assert output["topic"] == "CNN"
    assert output["prerequisites"] == ["Linear Algebra", "Perceptrons"]
    assert "Convolutional Neural Networks" in output["response"]
    assert isinstance(output["sources"], list)
    assert isinstance(output["images"], list)
