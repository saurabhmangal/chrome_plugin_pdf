#!/usr/bin/env python3
"""
Gemini API Key Test Script
Tests if your GEMINI_API_KEY in .env file is working correctly.
"""

import os
import sys
from dotenv import load_dotenv

def test_gemini_key():
    """Test the Gemini API key by making a simple API call."""

    # Load environment variables from .env file
    load_dotenv()

    # Get the API key
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        print("❌ ERROR: GEMINI_API_KEY not found in .env file")
        return False

    print(f"🔑 Found API key: {api_key[:20]}...{api_key[-4:] if len(api_key) > 24 else api_key}")

    try:
        # Import google-genai
        from google import genai
        print("✅ google-genai package imported successfully")

        # Initialize client
        client = genai.Client(api_key=api_key)
        print("✅ Gemini client initialized successfully")

        # Test with a simple prompt
        print("🔄 Testing API call...")
        response = client.models.generate_content(
            model="gemini-2.0-flash-lite",
            contents="Say 'Hello, API key is working!' in exactly those words."
        )

        result = response.text.strip()
        print(f"📝 API Response: {result}")

        # Check if we got the expected response
        if "Hello, API key is working!" in result:
            print("✅ SUCCESS: Your Gemini API key is working perfectly!")
            return True
        else:
            print("⚠️  WARNING: API responded but not with expected text")
            print("   This might still be working, just with different response formatting")
            return True

    except ImportError as e:
        print(f"❌ ERROR: google-genai package not installed. Install with: pip install google-genai")
        return False

    except Exception as e:
        error_msg = str(e).lower()
        if "api_key" in error_msg or "unauthorized" in error_msg or "invalid" in error_msg:
            print("❌ ERROR: Invalid API key or authentication failed")
            print(f"   Details: {e}")
            return False
        elif "429" in str(e) or "resource_exhausted" in error_msg or "quota" in error_msg:
            print("✅ SUCCESS: Your API key is VALID!")
            print("⚠️  QUOTA EXCEEDED: You've hit the free tier limit")
            print("   This is normal - you just need to wait or upgrade")
            print("\n💡 Solutions:")
            print("   1. Wait 24 hours for free quota reset")
            print("   2. Upgrade to paid plan: https://ai.google.dev/pricing")
            print("   3. Use a different model with higher limits")
            return True  # Key is valid, just quota issue
        else:
            print(f"❌ ERROR: API call failed with unexpected error: {e}")
            return False

if __name__ == "__main__":
    print("🚀 Testing Gemini API Key")
    print("=" * 50)

    success = test_gemini_key()

    print("\n" + "=" * 50)
    if success:
        print("🎉 Your Gemini API key is ready to use!")
        print("\nNext steps:")
        print("1. Your key is stored in .env (safe for version control)")
        print("2. Use it in your Chrome extension by loading from .env")
        print("3. For production, consider using Chrome extension storage")
    else:
        print("❌ Please check your API key and try again")
        print("\nTroubleshooting:")
        print("1. Verify your key at: https://aistudio.google.com/app/apikey")
        print("2. Make sure billing is enabled if required")
        print("3. Check your internet connection")

    sys.exit(0 if success else 1)