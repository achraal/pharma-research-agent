import requests, time, sys

# URL de l'API locale
API_URL = "http://127.0.0.1:8000/ask"
HEALTH_URL = "http://127.0.0.1:8000/health"

# Les 4 questions d'évaluation publiques
QUESTIONS = [
    "What are the main contraindications for warfarin?",
    "Compare the contraindications of warfarin and apixaban. What conditions are shared and which are unique to each drug?",
    "A patient currently on warfarin is prescribed sertraline. What is the risk of bleeding and what monitoring is recommended?",
    "A patient with an eGFR of 25 mL/min is being considered for metformin. Is metformin contraindicated at this level of renal function, and what is the threshold?"
]

def check_api_health():
    """Vérifie si le serveur FastAPI est bien lancé avant de lancer les tests."""
    try:
        response = requests.get(HEALTH_URL)
        if response.status_code == 200:
            print("API FastAPI détectée en ligne (GET /health -> 200).")
            return True
    except requests.exceptions.ConnectionError:
        print("L'API n'est pas joignable.")
        print("Veuillez lancer le serveur avec : uv run uvicorn main:app --reload")
        sys.exit(1)

def run_tests():
    print("="*60)
    print("LANCEMENT DES TESTS D'ÉVALUATION")
    print("="*60 + "\n")

    for i, question in enumerate(QUESTIONS, 1):
        print(f"QUESTION {i}/{len(QUESTIONS)} :\n{question}")
        print("-" * 40)
        
        start_time = time.time()
        
        try:
            # Appel de la route POST /ask
            response = requests.post(API_URL, json={"question": question})
            
            if response.status_code == 200:
                answer = response.json().get("answer", "")
                elapsed = time.time() - start_time
                print(f"Temps de réponse : {elapsed:.2f} secondes\n")
                print(f"RÉPONSE DE L'AGENT :\n{answer}\n")
            else:
                print(f"Erreur de l'API (Code {response.status_code}): {response.text}\n")
                
        except Exception as e:
            print(f"Erreur de requête : {e}\n")
            
        print("="*60 + "\n")

if __name__ == "__main__":
    if check_api_health():
        run_tests()