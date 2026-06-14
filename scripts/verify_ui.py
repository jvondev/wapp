import asyncio
from playwright.async_api import async_playwright
import os
import subprocess
import time
import sys

async def main():
    async with async_playwright() as p:
        # Start Vite
        print("Starting Vite server...")
        vite_proc = subprocess.Popen(["npm", "run", "vite"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        time.sleep(5)

        try:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            print("Navigating to app...")
            await page.goto("http://localhost:1420")
            await page.wait_for_load_state("networkidle")
            print("Taking screenshot...")
            await page.screenshot(path="verify_ui.png")
            await browser.close()
            print("Screenshot saved to verify_ui.png")
        finally:
            vite_proc.kill()
            os.system("kill $(lsof -t -i :1420) || true")

if __name__ == "__main__":
    asyncio.run(main())
