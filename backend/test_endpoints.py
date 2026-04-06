import asyncio
import aiohttp
import json
from pathlib import Path

async def test_endpoints():
    async with aiohttp.ClientSession() as session:
        print("=" * 60)
        print("TESTING REGISTRATION ENDPOINT")
        print("=" * 60)
        
        # Create a test resume file
        test_resume_path = Path(__file__).parent / "test_resume.pdf"
        test_resume_path.write_text("Test PDF content")
        
        try:
            with open(test_resume_path, 'rb') as f:
                data = aiohttp.FormData()
                data.add_field('email', 'test@gmail.com')
                data.add_field('username', 'testuser')
                data.add_field('password', 'testpass123')
                data.add_field('resume', f, filename='test_resume.pdf')
                
                try:
                    async with session.post('http://localhost:8010/api/register', data=data) as resp:
                        body = await resp.text()
                        print(f"Status: {resp.status}")
                        print(f"Response: {body[:200]}")
                        if resp.status > 201:
                            print(f"❌ Registration failed with status {resp.status}")
                        else:
                            print(f"✓ Registration succeeded")
                except Exception as e:
                    print(f"❌ Registration error: {e}")
        finally:
            test_resume_path.unlink(missing_ok=True)
        
        print("\n" + "=" * 60)
        print("TESTING LOGIN ENDPOINT")
        print("=" * 60)
        
        try:
            login_data = {
                "email": "test@gmail.com",
                "password": "testpass123"
            }
            async with session.post(
                'http://localhost:8010/api/login',
                headers={'Content-Type': 'application/json'},
                json=login_data
            ) as resp:
                body = await resp.text()
                print(f"Status: {resp.status}")
                print(f"Response: {body[:200]}")
                if resp.status > 201:
                    print(f"❌ Login failed with status {resp.status}")
                else:
                    print(f"✓ Login succeeded")
        except Exception as e:
            print(f"❌ Login error: {e}")

asyncio.run(test_endpoints())
