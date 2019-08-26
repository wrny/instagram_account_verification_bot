import pandas as pd
import datetime
import os
import requests
import json

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.keys import Keys
from selenium.common.exceptions import NoSuchElementException, WebDriverException

from bs4 import BeautifulSoup
import time

with open('sms_ski-api-key.txt') as file:
    auth_token = file.read()

headers = {'Authorization': 'Bearer ' + auth_token}

def sms_ski_get_balance():
    """
    Will return sms ski balance. Will be used for error checking on 
    get_mobile_number() and confirming API key is valid.
    """
    url = 'https://sms.ski/api/v1/receive/balance'
    r = requests.get(url, headers=headers)
    try:
        j = json.loads(r.text)
        balance = j['message']
        return balance
    except:
        return ""
    #print(response.json())

def sms_ski_get_mobile_number(service_identifier = 'instagram'):
    """Get mobile phone number from sms ski api"""
    instagram_european_iso_codes = ['ru', 'ua', 'gb', 'de', 'lt', 'fr', 'ie', 'pl', 
                                'es', 'nl', 'be', 'ee', 'cz', 'cn']
    
    error_count = 0
    idx = 0
        
    while True:
        country_code = instagram_european_iso_codes[idx]
        print(f"Trying country_code: {country_code} with error_count: {error_count}...")
        r = requests.get(f'https://sms.ski/api/v1/receive/phone/{country_code}/{service_identifier}', 
                         headers=headers)
        
        j = json.loads(r.text)
        print(f"sms_ski_get_mobile_number json respose: {j}")
        
        if j['status'] == 'success':
            phone_number = json.loads(r.text)['message']
            return phone_number
        
        elif j['error']['code'] == 409:
            current_funds = sms_ski_get_balance()
            print(f"Funds are too low! Current funds at: {current_funds}...")
            time.sleep(10)
                    
        elif j['error']['code'] == 406:
            print("No phone numbers are available at the moment of request initiation...")
            error_count += 1
            print(f"Adding 1 to error_count. Error count is now: {error_count}")
            time.sleep(10)
            
            if error_count >= 0:
                idx += 1
                print("Trying a different geographic region...")
                error_count = 0
        
        else:
            print("There is some sort of error.")


def sms_ski_cancel_phone(mobile_number='79050513150'):
    """Cancels the phone. NOT TESTED, PROLLY DOESN'T WORK!"""
    r = requests.get(f'https://sms.ski/api/v1/receive/cancel/{mobile_number}', headers=headers)
    j = json.loads(r.text)
    print(j)
    if j['status'] == 'success':
        print("Phone has been cancelled.")
        
    else:
        print("Phone not yet cancelled...")

def sms_ski_get_mobile_code(mobile_number='79050513150', time_to_break = 60):
    """
    Get the verification code sent to the mobile phone number. Done via sms ski.
    This fx needs some soft of breaking function incase sms.ski is itelf broken,
    else program will run forever.
    """
    start_time = time.time()
    break_time = start_time + time_to_break
    while True:        
        r = requests.get(f'https://sms.ski/api/v1/receive/code/{mobile_number}', headers=headers)
        j = json.loads(r.text)
        print(f"JSON Respose is: {j}")

        if j['status'] == 'success':
            verification_code = j['message']
            return "success", verification_code
        
        elif j['error']['code'] == 404:
            print("Confirmation Code hasn't arrived yet. Waiting...")
            time.sleep(10)
            
        if time.time() >= break_time:
            print("Code did not arrive on time. Breaking!")
            return "fail", "x"
            
            
def check_proxy(proxy):
    """Checks to see if proxy is up and is working properly as an anonymous proxy"""
    http_proxy  = f"http://{proxy}"
    https_proxy = f"https://{proxy}"
    ftp_proxy   = f"ftp://{proxy}"

    proxy_dict = { 
                  "http"  : http_proxy, 
                  "https" : https_proxy, 
                  "ftp"   : ftp_proxy
                }
    
    httpbin_url = 'https://httpbin.org/ip'

    try:
        r = requests.get(httpbin_url, headers=headers, proxies=proxy_dict)
        
    except requests.exceptions.ProxyError:
        print("Proxy Not Connecting...")
        return False
    
    # checks if httpbin.org/ip is the same ip address as in the proxy.
    if json.loads(r.text)['origin'].split(',')[0] == proxy.split(":")[0]:
        return True
    
    else:
        print("Proxy not anonymous!")
        return False
    
def launch_chrome(proxy):
    options = Options()       
    extension_path = os.path.join(os.getcwd(),'chrome_extension')
    options.add_argument('--load-extension={}'.format(extension_path))

    options.add_argument(f'--proxy-server=http://{proxy}')

    # Return driver object
    driver = webdriver.Chrome(executable_path='chromedriver.exe', options=options)
    return driver

def instagram_login(driver, username, password):
    login_url = 'https://www.instagram.com/accounts/login/?source=auth_switcher'
    driver.get(login_url)
    time.sleep(5)
    # enter in username / password, then rest until you get to the phone section.
    
    username_xpath = '//*[@id="react-root"]/section/main/div/article/div/div[1]/div/form/div[2]/div/label/input'
    password_xpath = '//*[@id="react-root"]/section/main/div/article/div/div[1]/div/form/div[3]/div/label/input'
    # login_button = '//*[@id="react-root"]/section/main/div/article/div/div[1]/div/form/div[4]'

    username_field = driver.find_element_by_xpath(username_xpath)

    try:
        password_field = driver.find_element_by_xpath(password_xpath)

    except:
        password_xpath = '//*[@id="react-root"]/section/main/div/article/div/div[1]/div/form/div[4]/div/label/input'
        password_field = driver.find_element_by_xpath(password_xpath)

    username_field.send_keys(username)
    username_field.send_keys(Keys.TAB)
    time.sleep(3)
    password_field.send_keys(password)
    password_field.send_keys(Keys.ENTER)
    time.sleep(5)
    
    
def instagram_this_was_me(driver):
    this_was_me_xpath = '//*[@id="react-root"]/section/div/div/div[3]/form/div[2]/span/button'
    try:
        this_was_me_field = driver.find_element_by_xpath(this_was_me_xpath)
        this_was_me_field.click()
        
    except NoSuchElementException:
        pass
    
def instagram_turn_off_notifications(driver):
    try:
        turn_off_xpath = '/html/body/div[3]/div/div/div[3]/button[2]'
        turn_off_notifications_field = driver.find_element_by_xpath(turn_off_xpath)
        turn_off_notifications_field.click()
        
    except NoSuchElementException:
        pass
        

# For instagram_next_step_server(driver) There are basically four paths...
# 1. Login succeeds / doesn't need verification. Right now it will get cause with the json.JSONDecodeError
# 2. Get hit with a red ribbon -- "supicious login." If it's this, the play is to click on "phone verification" and do phone verification.
# 3. Instagram Error -- "Try again in a few minutes / fail."
# 4. Requests Phone Verification
# 5. Requests Email Verification
# Each of these should have a function / takes people through different options. All should also have logging!

def instagram_next_step_server(driver):
    # Trying #3 Instagram Error...
    
    source = driver.page_source
    soup = BeautifulSoup(source, 'lxml')
    
    try:
        instagram_error_status = json.loads(soup.text)['status']
                    
        if instagram_error_status == 'fail':
            error_message = json.loads(soup.text)['message']
            print(f"Getting error message: {error_message}. Quitting...")
            driver.close()
            
    except json.JSONDecodeError:
        # Error #1, #2, #4 - #5 will go here...
        time.sleep(5)
        print("This is the error catching portion of the program. Where additional errors will be caght / fixed.")
        print("Need to code in next steps as we see them. This will intentionally close shortly...")
        instagram_this_was_me(driver)
        instagram_turn_off_notifications(driver)
        driver.close()
        
        
def instagram_get_security_code(driver, mobile_number):
    """
    Goal with this fx is to get the mobile code from sms_ski_get_mobile_code, but if it doesn't arrive
    in 90 seconds, then to click the "get_new_code_link" and request another code. If the code doesn't
    attive in two minutes (start_plus_120) then break the entire program. A 'success_code' will be 
    returned with sms_ski_get_mobile_code() to break the while success_code == 'fail' loop.
    """
    try:
        print("Running 'instagram_get_security_code()'...")
        start_time = time.time()
        start_plus_120 = start_time + 120
        print("start_time is: {}, start_plus_120 is: {}".format(start_time, start_plus_120))

        success_code = 'fail'
        print(f"success_code is: {success_code}")
        print("Waiting 60 seconds for the new code should happen now...")
        
        while success_code == 'fail':
            now = time.time()
            now_plus_120 = now + 120
            
            while time.time() < now_plus_120:
                print(f"time.time() is: {time.time()}, now_plus_120 is: {now_plus_120}")
                success_code, mobile_code = sms_ski_get_mobile_code(mobile_number, time_to_break = 60)
                
                if success_code == 'fail':
                    print("Did not get a mobile code. Clicking 'get new one' and getting another code...")
                    get_new_one_xpath = '//*[@id="react-root"]/section/div/div/p[2]/span/a'
                    get_new_code_link = driver.find_element_by_xpath(get_new_one_xpath)
                    get_new_code_link.click()
                    continue

                if success_code == 'success':
                    break
                
            print("{} is later than {}".format(time.time(), now_plus_120))

            if success_code == 'success':
                break

            if time.time() >= start_plus_120:
                break        
        
        
        # There should be some sort of "if success_code == 'fail', then hit back button + request new number.
        if success_code == 'fail':
            number_cancellation_response = sms_ski_cancel_phone(mobile_number)
            print(number_cancellation_response)
            print("More to go here!")
            
            
        #  driver.execute_script("window.history.go(-1)") # This is the back button
        # enter in a new number / continue. IF this happens twice with the same ID, then break the program
        print("Mobile code successfully obtained. Entering in mobile code...")
        security_code = mobile_code
        sec_code_xpath = '//*[@id="security_code"]'
        sec_code_field = driver.find_element_by_xpath(sec_code_xpath)
        sec_code_field.send_keys(security_code)
        sec_code_field.send_keys(Keys.ENTER)
        
    except WebDriverException:
        pass
    
def instagram_verification(driver):
    phone_field_xpath = '//*[@id="phone_number"]'
    
    try:
        phone_field = driver.find_element_by_xpath(phone_field_xpath)
        phone_field = driver.find_element_by_xpath(phone_field_xpath)
        phone_field.clear()    
        mobile_number = sms_ski_get_mobile_number()
        print(f"Mobile number is: {mobile_number}")
        phone_field.send_keys(mobile_number)
        phone_field.send_keys(Keys.ENTER)
        time.sleep(5)
        
        return mobile_number
        
    except NoSuchElementException:
        instagram_next_step_server(driver)
        
if __name__ == '__main__':
    if sms_ski_get_balance() == "":
        print("Invalid API Key. Please get a working API key from sms.ski. Closing program...")
        
    else:
        df = pd.read_csv('insta_test.csv')
        for num in df.index:
            username = df.loc[num, 'username']
            password = df.loc[num, 'password']
            proxy = df.loc[num, 'proxy']
            print("#"+str(num)+" out of #"+str(df.index[-1])+" - Getting: "+username+"\t"+password+"\t"+proxy)
    
            if check_proxy(proxy):
                driver = launch_chrome(proxy)
                instagram_login(driver, username, password)
                mobile_number = instagram_verification(driver)
                
                if type(mobile_number) is str:
                    instagram_get_security_code(driver, mobile_number)
                    time.sleep(5)
                    instagram_this_was_me(driver)
                    time.sleep(5)
                    instagram_turn_off_notifications(driver)
                    driver.close()