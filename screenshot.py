import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

ARTIFACTS = "C:\\Alessandro\\Work\\Attempts to Code\\V2 Ecosystem\\v2-resort\\screenshots\\"

def js_click(driver, element):
    driver.execute_script("arguments[0].click();", element)

def run():
    chrome_options = Options()
    chrome_options.add_argument('--headless')
    chrome_options.add_argument('--window-size=1440,900')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    driver = webdriver.Chrome(options=chrome_options)
    wait = WebDriverWait(driver, 12)

    try:
        print("Loading /nexus...")
        driver.get("http://platform.localhost:3000/nexus")
        time.sleep(4.5)

        driver.save_screenshot(ARTIFACTS + "nexus_boot.png")
        print("Saved: nexus_boot.png")

        # Labels match the updated sidebar (no number prefix anymore)
        scenes = [
            ("Galaxy Stack",    "nexus_galaxy.png"),
            ("Engine Command",  "nexus_engines.png"),
            ("Security Shield", "nexus_security.png"),
            ("Database Atlas",  "nexus_atlas.png"),
        ]

        for label, filename in scenes:
            try:
                btn = wait.until(EC.presence_of_element_located(
                    (By.XPATH, f"//button[contains(., '{label}')]")
                ))
                js_click(driver, btn)
                time.sleep(2.0)
                driver.save_screenshot(ARTIFACTS + filename)
                print(f"Saved: {filename}")
            except Exception as e:
                print(f"Failed {label}: {e}")

    finally:
        driver.quit()
        print("Done.")

if __name__ == '__main__':
    run()
