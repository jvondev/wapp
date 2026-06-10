import asyncio
from playwright.async_api import async_playwright
import os
import subprocess
import time
import sys

async def verify():
    # Build first
    print("Building frontend...")
    subprocess.run(["npm", "run", "build"], check=True)

    # Start server
    print("Starting temporary web server on port 8000...")
    server = subprocess.Popen(["python3", "-m", "http.server", "8000"], cwd="dist")
    time.sleep(2) # Give it time to start

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 1280, 'height': 800})

        try:
            print("Navigating to http://localhost:8000")
            await page.goto("http://localhost:8000")
            await page.wait_for_timeout(3000)

            # Inject mock data into window.__WAPP_STORE__
            # This requires the store to be exposed in src/index.tsx for testing
            print("Injecting mock data...")
            await page.evaluate("""
                if (window.__WAPP_STORE__) {
                    const [state, actions] = window.__WAPP_STORE__;
                    actions.setWapps([
                        { id: '1', name: 'Gmail', url: 'https://gmail.com', category: 'Work', path: '', icon: 'https://www.google.com/s2/favicons?domain=gmail.com&sz=128' },
                        { id: '2', name: 'Slack', url: 'https://slack.com', category: 'Work', path: '', icon: 'https://www.google.com/s2/favicons?domain=slack.com&sz=128' },
                        { id: '3', name: 'Notion', url: 'https://notion.so', category: 'Enterprise', path: '', icon: 'https://www.google.com/s2/favicons?domain=notion.so&sz=128' }
                    ]);
                } else {
                    console.error('Store not found on window.__WAPP_STORE__');
                }
            """)
            await page.wait_for_timeout(1000)

            # Take screenshots
            await page.screenshot(path="verify_dashboard.png")
            print("Saved verify_dashboard.png")

            # Click New Wapp (Command Center)
            await page.click("button:has-text('New Wapp')")
            await page.wait_for_timeout(500)
            await page.screenshot(path="verify_command_center.png")
            print("Saved verify_command_center.png")

            # Right click an app
            await page.mouse.click(500, 350, button="right")
            await page.wait_for_timeout(500)
            await page.screenshot(path="verify_context_menu.png")
            print("Saved verify_context_menu.png")

        except Exception as e:
            print(f"Error during verification: {e}")
            sys.exit(1)
        finally:
            server.terminate()

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify())
