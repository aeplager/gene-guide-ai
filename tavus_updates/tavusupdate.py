import requests
import json
import os
from dotenv import load_dotenv

# Load environment variables from .env in the base directory
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(base_dir, '.env')
load_dotenv(env_path)

# Get Tavus API key from environment variables
TAVUS_API_KEY = os.getenv('TAVUS_API_KEY')
if not TAVUS_API_KEY:
    raise ValueError("TAVUS_API_KEY not found in .env file. Please add it to your .env file.")

API_KEY = TAVUS_API_KEY
BASE_URL = 'https://tavusapi.com/v2'

def get_persona_parameters(persona_id):
    url = f"{BASE_URL}/personas/{persona_id}"
    headers = {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
    }
    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        return response.json()
    else:
        print(f"Failed to fetch persona: {response.status_code} - {response.text}")
        return None

def update_persona_llm(tavus_api_key, persona_id, llm_model, llm_api_key, llm_base_url):
    patch_url = f'{BASE_URL}/personas/{persona_id}'
    headers = {
        'x-api-key': tavus_api_key,  # ✅ Fixed: Use x-api-key (same as GET)
        'Content-Type': 'application/json-patch+json'
    }
    patch_body = [
        {
            "op": "replace",
            "path": "/layers/llm/model",
            "value": llm_model
        },
        {
            "op": "replace",
            "path": "/layers/llm/api_key",
            "value": llm_api_key
        },
        {
            "op": "replace",
            "path": "/layers/llm/base_url",
            "value": llm_base_url
        }
    ]
    response = requests.patch(patch_url, json=patch_body, headers=headers)
    if response.ok:
        print("Persona LLM updated successfully.")
        print(response.json())
    else:
        print(f"Failed to update persona: {response.status_code} - {response.text}")

persona_id = 'p70ec11f62ec'
persona_data = get_persona_parameters(persona_id)

if persona_data:
    # Print to console
    print(json.dumps(persona_data, indent=2, ensure_ascii=False))
    
    # ✅ Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_file = os.path.join(script_dir, 'persona.json')
    
    # Write to persona.json file in the same directory as the script
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(persona_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Persona data written to {output_file}")
else:
    print("No data returned")


exit() 
print("Updating persona LLM...")
llm_model = "Custom-llm-genetic-counsellor"
llm_api_key = "eb75c854-3f5b-4ed5-b538-1d67a157243a"
llm_base_url = "https://custom-llm-gc.ashydune-c5455a7b.centralus.azurecontainerapps.io"

update_persona_llm(TAVUS_API_KEY, persona_id, llm_model, llm_api_key, llm_base_url)

    