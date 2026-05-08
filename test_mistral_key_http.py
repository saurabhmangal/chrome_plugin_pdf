#!/usr/bin/env python3
"""
Mistral API Key Test Script - Using HTTP requests
Direct HTTP test of the Mistral API
"""

import os
import sys
import json
import requests
from dotenv import load_dotenv

def test_mistral_key():
    """Test the Mistral API key by making a direct HTTP request."""

    # Load environment variables from .env file
    load_dotenv()

    # Get the API key
    api_key = os.getenv("MISTRAL_API_KEY")

    if not api_key:
        print("❌ ERROR: MISTRAL_API_KEY not found in .env file")
        return False

    print(f"🔑 Found API key: {api_key[:20]}...{api_key[-4:] if len(api_key) > 24 else api_key}")

    try:
        print("🔄 Testing API call with mistral-small model...")
        
        url = "https://api.mistral.ai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "mistral-small-latest",
            "messages": [
                {
                    "role": "user",
                    "content": "Say 'Hello, API key is working!' in exactly those words and nothing else."
                }
            ],
            "max_tokens": 100
        }

        response = requests.post(url, headers=headers, json=payload, timeout=10)
        
        print(f"📊 HTTP Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            result = data["choices"][0]["message"]["content"].strip()
            print(f"📝 API Response: {result}")
            print("✅ SUCCESS: Your Mistral API key is working perfectly!")
            print(f"   Model: mistral-small-latest")
            print(f"   Response length: {len(result)} characters")
            return True
        
        elif response.status_code == 401:
            print("❌ ERROR: Unauthorized - Invalid API key")
            print(f"   Response: {response.text}")
            return False
        
        elif response.status_code == 429:
            print("✅ SUCCESS: Your API key is VALID!")
            print("⚠️  RATE LIMIT EXCEEDED: Too many requests")
            print("   This is normal - wait a moment and try again")
            return True
        
        elif response.status_code == 403:
            print("❌ ERROR: Forbidden - Check API permissions")
            print(f"   Response: {response.text}")
            return False
        
        else:
            print(f"❌ ERROR: Unexpected status code {response.status_code}")
            print(f"   Response: {response.text}")
            return False

    except requests.exceptions.ConnectionError:
        print("❌ ERROR: Could not connect to Mistral API")
        print("   Check your internet connection")
        return False
    
    except requests.exceptions.Timeout:
        print("❌ ERROR: Request timed out")
        return False
    
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Testing Mistral API Key")
    print("=" * 50)

    success = test_mistral_key()

    print("\n" + "=" * 50)
    if success:
        print("🎉 Your Mistral API key is ready to use!")
        print("\nNext steps:")
        print("1. Your key is stored in .env (safe for version control)")
        print("2. Use it in your Chrome extension")
        print("3. Available models:")
        print("   - mistral-small-latest (fastest, cheapest, recommended)")
        print("   - mistral-medium-latest (balanced)")
        print("   - mistral-large-latest (most powerful)")
        print("\n4. Free tier info: https://console.mistral.ai/")
    else:
        print("❌ Please check your API key and try again")
        print("\nTroubleshooting:")
        print("1. Verify your key at: https://console.mistral.ai/")
        print("2. Make sure you have active credits/plan")
        print("3. Check your internet connection")
        print("4. API Docs: https://docs.mistral.ai/")

    sys.exit(0 if success else 1)