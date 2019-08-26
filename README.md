# Instagram Account Verification Bot v0.1

![InstagramBot_v0.1](https://raw.githubusercontent.com/wrny/instagram_account_verification_bot/master/InstagramBot_example.png "Instagram Bot Example")

A python script using Requests, Selenium and JavaScript to bypass Instagram's phone verification system, and verify Instagram accounts.

# Video

Video example can be viewed here:

[Google Drive](https://drive.google.com/file/d/1aUb7tvYj-eJIPyqKLWl2MAG25yoAOfVG/view)

# About

Instagram is one of the world's leading platforms for marketers--and while "influencers" were certainly around pre-Insta, most influencers today are found on and promote via Instagram.

I think among marketers there's also a sense that Instagram is safer or more free from fraud and bot activity, partly due to hoops needed to open an account, such as the need for phone verification.

Let me tell you, as both a marketer and a programmer: nothing could be further from the truth!

Services such as [smspva.com](https://www.smspva.com/) and [sms.ski](https://www.sms.ski/) allow for the creation of low-cost, disposable mobile phone numbers from countries around the world that can receive phone confirmation codes via SMS. Using these tools, verifying an Instagram account becomes much easier. And once an account is verified, a marketer can run entire bot farms of accounts using automated software.

This repo contains a Python script using the Selenium browser automation framework that verifies Instagram accounts.

# What does this script do?

The script:

* Checks to see if you have a valid SMS.SKI api key.
* Takes a list of instagram usernames, passwords, and proxy addresses in a file "insta-test.csv."
* Confirms that the proxy is working / active via the Requests module.
* Launches a Windows Chrome Selenium browser instance with the proxy and a browser extension that minimizes bot detection.
* Goes to the Instagram login page
* Enters a username / password from an Instagram account.
* Lands on the the "Verify Account with mobile number" page.
* Use the SMS.SKI API to fetch a mobile number from anywhere in the world--my script defaults to 'ru' (Russia), 'ue' (Ukraine), and finally 'gb' (Great Britain) because that's the best mix of cost efficiency and speed to verify. 
* Selenium enters in mobile number
* Instagram then sends a confirmation code to that number.
* Use the SMS.SKI API again to actually fetch the confirmation code.
* Selenium enters in the confirmation code.
* Wait a few seconds, and the account is verified!
* The program then goes to the next line in the "insta-test.csv" and goes to the next account.

# Issues

The script as of right now has around a 90% success rate. If it fails, it fails typically when:

1. Some kind of bot activity on the account, has been detected by Instagram, either resulting in a "please try again in a few minutes" or an outright account ban. For the former, the solution is to use better proxies, for the latter, is to get more accounts.
2. Instagram doesn't send the mobile code, or the SMS.SKI doesn't get the mobile code in time. My script will use Selenium to click the "resend confirmation code" button on Instagram, but it won't always work. Instagram not sending the code straight away I think is a feature used to help mitigate automated account verification. But in my experience, this is temporary and these accounts can be verified again later. 
3. The confirmation code has already been entered, and it requires users to log into their email and give the confirmation code--this isn't that hard to do--most of these paid-for accounts use Yahoo! Mail and it's trivial to:
a. Launch another simultaneous Selenium instance
b. log into Yahoo! Mail
c. Get the confirmation code / scrape it
d. Then enter it into Instagram via Selenium.

4. Recently, Instagram has been flagging accounts with a “it looks like your account has been compromised message” and it requires entering in a new email address and verifying that. Again, that would require programmatically creating a new Yahoo! E-mail address, verifying said address with Yahoo!, then entering in the Yahoo! address in Instagram, then doing the steps from #3.

Needless to say I haven’t done that because it defeats the purpose of this exercise.

I haven’t done any logging of successes or failures either, but those are the next steps in the project, if I decide to continue it.

# Usage

To use:
* Have a Windows OS (likely Microsoft Windows 8, 10 or MS Windows Server). In our case, this is actually better than a standard Linux server because anything coming from a Linux server screams “I’m a bot.”
* Install the latest version of Chrome
* Download the files from this Git repository
* Have the latest Chrome WebDriver Installation (found [here](https://chromedriver.chromium.org/downloads)). If your locally installed version of Chrome is too many versions ahead of the WebDriver, the program will throw an error. So download the Chromedriver, and overwrite the ‘chromedriver.exe’ file.
* Get an API Key from SMS.SKI and add a few dollars (or rubles!) to your account. Replace the contents of the api_key.txt file with your API key / save it. Or just overwrite the file.
* Buy some highly anonymous proxies. They are cheap and found with a simple Google search. Residential proxies are less likely to be caught.
* Buy some Instagram accounts. Again, found with a simple Google search or on forums such as [blackhatworld.com](https://www.blackhatworld.com)
* Upload your list of usernames, passwords, and proxies (both IP / Port) into a CSV file with each separated by commas.

example: 

```notwillrand,easypassw0rd1,108.186.244.47:3128```


* And of course have a working / decently fast Internet connection.
* Once all that’s done, go to the instagram_bot directory, and type:

```python InstagramBot.py```

# Headless Chrome Restriction

Note that this program isn't designed to run headless Chrome. Chrome Browser extensions don't work in headless, and that would make it very easy to detect when the program is a bot. Yes, it makes the program run slower--all the more reason to get a remote server when running it. Depending on the speed of the remote server, you can run multiple instances of Selenium and verify several accounts at the same time.
