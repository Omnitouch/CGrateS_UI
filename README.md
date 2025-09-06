# Omnitouch CGrateS React UI

This is a simple UI to access the CGrateS API, created by [Omnitouch Network Services](https://omnitouchns.com).

This page is runs in the browser and connects to any CGrateS instance the computer you're reading this on can see, including localhost.

There's nothing to install - [Simply visit the Github Pages link here to start using the tool.](https://omnitouch.github.io/CGrateS_UI/)

## Setup

You don't need to install anything, just visit the above link.

By default this tool tries to connect to a CGrateS instance running on `localhost:2080` (assuming the computer you're visiting the page from is also running CGrateS) but you can change this to point at other CGrateS instances, as well as setting the `Tenants` used in your environment, and any HTTP Basic auth parameters you use, by clicking __Connection to CGrateS__ in the middle of the screen right.

In order to use this tool your version of CGrateS must be later than [this commit](https://github.com/cgrates/cgrates/pull/4430/commits/1b6942397ee7e7211d0d597dba65b2e9721782f1) which adds support for CORS to React can talk to CGrateS.

If you are talking to a CGrateS instance other than `localhost`, the remote CGrateS instance *must* have HTTP TLS enabled, as if this page is rendered via HTTPS, all resources it accesses must be via HTTPS also. This is a browser limitation - you can bypass this by running this Node app on your local machine.

## Self Hosting

If you're not using TLS on CGrateS, you want to save the settings or you want to host this yourself, it's really easy to run locally.

Clone the repo, install Node (if you don't already have it), run `npm install` and then `npm start`, and Node will open the UI in a new browser tab.

If you want to run this on a web server like Nginx or Apache, same steps but run `npm build` and point the outputted `/build` directory in your root web directory.


## Saving your CGrateS instances, Tenants and Credentials

You might want to skip specifying the connection details every time you start the utility, if you're running a copy locally, you can modify [the config.json file in the public directory](https://github.com/Omnitouch/CGrateS_UI/blob/main/public/config.json) to specify what is set when the page is loaded.


## Usage

Only certain functions / endpoints are exposed via this tool, it's in no way comprehensive.

This of it less of a "GUI for CGrateS" and more of a utility for managing data inside CGrateS.

If you're new to CGrateS, and want to learn more about it:

 * [CGrateS Documentation](https://cgrates.readthedocs.io/en/latest/)
 * [ITsysCom (Developers of CGrateS)](support@itsyscom.com)
 * [Mailing List](https://groups.google.com/g/cgrates)
 * [CGrateS in Baby Steps Tutorial Series](https://nickvsnetworking.com/category/voip/cgrates/)

## How do I...
Not all API endpoints are exposed here.
So far what has been include is limited support for:
 * Searching and exporting CDRs
 * Viewing Accounts & Account Balances (And Executing Actions / Viewing ActionPlans)
 * Viewing / Terminating SessionS
 * Managing Resources & monitoring usage of them
 * Managing ActionPlans
 * Managing Actions
 * Managing ChargerS
 * Viewing Routes / Least Cost Routes
 * Managing AttributeS
 * Managing FilterS
 * Viewing DestinationRates & Destinations / Rates
 * Managing RatingPlans & RatingProfiles
 * Managing Timings & testing timing rules
 * Managing TariffPlans
 * Simulating Costs
 * Viewing Config
 * Send random JSON bodies and view the responses


## Contributions
Contributions welcome via the [Github page](https://github.com/Omnitouch/CGrateS_UI).

Changes to the Github pages can be pushed to live with `npm run deploy`