#!/usr/bin/env python3
"""
Mistral API Key Test Script - Simple Version
Tests if your MISTRAL_API_KEY in .env file is working correctly.
"""

import os
import sys
from dotenv import load_dotenv

def test_mistral_key():
    """Test the Mistral API key by making a simple API call."""

    # Load environment variables from .env file
    load_dotenv()

    # Get the API key
    api_key = os.getenv("MISTRAL_API_KEY")

    if not api_key:
        print("❌ ERROR: MISTRAL_API_KEY not found in .env file")
        return False

    print(f"🔑 Found API key: {api_key[:20]}...{api_key[-4:] if len(api_key) > 24 else api_key}")

    try:
        print("🔄 Importing mistralai...")
        from mistralai.client import MistralClient
        from mistralai.models.chat_message import ChatMessage
        print("✅ mistralai package imported successfully")

        # Initialize client
        client = MistralClient(api_key=api_key)
        print("✅ Mistral client initialized successfully")

        # Test with a simple prompt
        print("🔄 Testing API call with mistral-small model...")
        
        message = [
            ChatMessage(role="user", content="Say 'Hello, API key is working!' in exactly those words and nothing else.")
        ]
        
        response = client.chat(
            model="mistral-small-latest",
            messages=message,
        )

        result = response.choices[0].message.content.strip()
        print(f"📝 API Response: {result}")

        # Check if we got a response
        if result and len(result) > 0:
            print("✅ SUCCESS: Your Mistral API key is working perfectly!")
            print(f"   Model: mistral-small-latest")
            print(f"   Response length: {len(result)} characters")
            return True
        else:
            print("⚠️  WARNING: API responded but with empty content")
            return False

    except ImportError as e:
        print(f"❌ ERROR: Failed to import mistralai: {e}")
        print("   Install with: uv add mistralai")
        return False

    except Exception as e:
        error_msg = str(e).lower()
        if "401" in str(e) or "unauthorized" in error_msg or "invalid" in error_msg:
            print("❌ ERROR: Invalid API key or authentication failed")
            print(f"   Details: {e}")
            return False
        elif "429" in str(e) or "rate_limit" in error_msg or "quota" in error_msg:
            print("✅ SUCCESS: Your API key is VALID!")
            print("⚠️  RATE LIMIT EXCEEDED: Too many requests")
            print("   This is normal - wait a moment and try again")
            return True
        elif "403" in str(e):
            print("❌ ERROR: Access forbidden - check if your API key has the right permissions")
            print(f"   Details: {e}")
            return False
        else:
            print(f"❌ ERROR: API call failed: {e}")
            print(f"   Error type: {type(e).__name__}")
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
        print("   - mistral-small-latest (fastest, cheapest, recommended for extension)")
        print("   - mistral-medium-latest (balanced)")
        print("   - mistral-large-latest (most powerful)")
        print("\n4. Free tier limit: 2M tokens/month or check console.mistral.ai")
    else:
        print("❌ Please check your API key and try again")
        print("\nTroubleshooting:")
        print("1. Verify your key at: https://console.mistral.ai/")
        print("2. Make sure you have API credits/active plan")
        print("3. Check your internet connection")
        print("4. Reinstall: uv add mistralai --force-reinstall")

    sys.exit(0 if success else 1)