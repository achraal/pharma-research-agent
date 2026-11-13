import sys
import time
import requests

# Local API endpoints
API_URL = "http://127.0.0.1:8000/ask"
HEALTH_URL = "http://127.0.0.1:8000/health"

# The 4 public evaluation questions
QUESTIONS = [
    "What are the main contraindications for warfarin?",
    "Compare the contraindications of warfarin and apixaban. What conditions are shared and which are unique to each drug?",
    "A patient currently on warfarin is prescribed sertraline. What is the risk of bleeding and what monitoring is recommended?",
    "A patient with an eGFR of 25 mL/min is being considered for metformin. Is metformin contraindicated at this level of renal function, and what is the threshold?"
]

def check_api_health():
    """Verify that the FastAPI server is running before executing tests."""
    try:
        response = requests.get(HEALTH_URL)
        if response.status_code == 200:
            print("FastAPI server detected online (GET /health -> 200).")
            return True
    except requests.exceptions.ConnectionError:
        print("API is unreachable.")
        print("Please start the server with: uv run uvicorn main:app --reload")
        sys.exit(1)

def run_tests():
    print("=" * 60)
    print("STARTING EVALUATION TESTS")
    print("=" * 60 + "\n")

    for i, question in enumerate(QUESTIONS, 1):
        print(f"QUESTION {i}/{len(QUESTIONS)}:\n{question}")
        print("-" * 40)
        
        start_time = time.time()
        
        try:
            # Call the POST /ask endpoint
            response = requests.post(API_URL, json={"question": question})
            
            if response.status_code == 200:
                answer = response.json().get("answer", "")
                elapsed = time.time() - start_time
                print(f"Response time: {elapsed:.2f} seconds\n")
                print(f"AGENT RESPONSE:\n{answer}\n")
            else:
                print(f"API Error (Status {response.status_code}): {response.text}\n")
                
        except Exception as e:
            print(f"Request Error: {e}\n")
            
        print("=" * 60 + "\n")

if __name__ == "__main__":
    if check_api_health():
        run_tests()