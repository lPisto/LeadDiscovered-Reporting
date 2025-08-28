from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service

import time
import base64

def CreateDriver():
    from webdriver_manager.chrome import ChromeDriverManager
    options = webdriver.ChromeOptions()
    options.add_argument("--headless=new") 
    options.add_experimental_option('detach', True)
    options.set_capability('goog:loggingPrefs', {'performance': 'ALL'})
    options.add_argument(r"user-data-dir=E:\Documentos\Proyectos\Python\SeleniumProfiles") 
    options.add_argument(r"profile-directory=ProfileSelenium")
    options.add_argument("--start-maximized")

    return webdriver.Chrome(service=Service(ChromeDriverManager().install()),options=options)

     

def WaitElement(elementList, driver, elementSelector = 'xpath'):
    while True:
        for elementPath in elementList:
            try:
                match elementSelector:
                    case "xpath":
                        element = WebDriverWait(driver, 0.2).until(
                            EC.presence_of_element_located((By.XPATH, elementPath))
                        )
                    case "id":
                        element = WebDriverWait(driver, 0.2).until(
                            EC.presence_of_element_located((By.ID, elementPath))
                        )
                    case "class":
                        element = WebDriverWait(driver, 0.2).until(
                            EC.presence_of_element_located((By.CLASS_NAME, elementPath))
                        )
                    case "selector":
                        element = WebDriverWait(driver, 0.2).until(
                            EC.presence_of_element_located((By.CSS_SELECTOR, elementPath))
                        )
                    
                element.click()

                return elementPath, element
            except:
                continue

def ScrapeData():
    driver = CreateDriver()
    driver.get("https://app.gohighlevel.com/v2/location/StmfWqkpBNpd2G8iSTmB/dashboard")

    WaitElement(["#widget_681ba2682dc15d75774b7362"], driver, "selector")

    try:
        element = driver.find_element(By.CSS_SELECTOR, "#widget_681ba2682dc15d75774b7362 > div > div > div > div > div.hl-card-content")
        driver.execute_script("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", element)

        time.sleep(5)

        chart = driver.find_elements(By.CSS_SELECTOR, "#chart > div > div:nth-child(1) > svg")[1]
        svg_code = chart.get_attribute("outerHTML")

        with open(r"reports\funnel.svg", "w", encoding="utf-8") as f:
            f.write(svg_code)

        driver.get("https://app.gohighlevel.com/v2/location/StmfWqkpBNpd2G8iSTmB/reporting/call")

        WaitElement(["#call-reporting-dashboard > div > div > div.n-tabs.n-tabs--line-type.n-tabs--medium-size.n-tabs--top.hl-tabs > div.n-tabs-nav--line-type.n-tabs-nav--top.n-tabs-nav > div > div > div > div.n-tabs-wrapper > div:nth-child(3) > div.n-tabs-tab"], driver, "selector")

        time.sleep(5)

        canvas = driver.find_element(By.XPATH, "/html/body/div[1]/div[1]/div[4]/section/section/div[1]/div/div/div[2]/div[2]/div[1]/div/div[2]/div/div[1]/x-vue-echarts/div/div[1]/canvas")
    

        canvas_base64 = driver.execute_script("""
            var canvas = arguments[0];
            return canvas.toDataURL("image/png").substring(22); 
        """, canvas)

        with open(r"reports\callingReport.png", "wb") as f:
            f.write(base64.b64decode(canvas_base64))

        callingStats = driver.find_element(By.XPATH, "/html/body/div[1]/div[1]/div[4]/section/section/div[1]/div/div/div[2]/div[2]/div[1]/div/div[2]/div/div[2]").text
        with open(r"reports\callingStats.txt", "w", encoding="utf-8") as f:
            f.write(callingStats)

        driver.quit()

    except Exception as e:
        print(f"❌ Error al exportar el gráfico: {e}")
        driver.quit()
        
def main():
    ScrapeData()

main()
