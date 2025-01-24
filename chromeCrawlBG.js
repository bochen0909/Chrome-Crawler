// JavaScript Document

let tabs = ["Queued","Crawling","Crawled","Files","Errors"];
let allPages = {};
let crawlStartURL = null;
let startingHost = "";
let startingPage = {};
let appState = "stopped";

let settings = {
    maxDepth: 2,
    maxSimultaniousCrawls: 10,
    pauseOnPopClose: 1,
    interestingFileTypes: ["flv","mk4","ogg","swf","avi","mp3","zip","png","gif","jpg"]
};

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['settings'], (result) => {
        if (result.settings) {
            settings = result.settings;
        } else {
            chrome.storage.local.set({settings: settings});
        }
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "beginCrawl") {
        beginCrawl(request.url);
        sendResponse({status: "Crawl started"});
    } else if (request.action === "getState") {
        sendResponse({
            appState: appState,
            allPages: allPages,
            settings: settings
        });
    }
    return true;
});

function beginCrawl(url) {
    reset();    
    appState = "crawling";
    crawlStartURL = url;    
    startingHost = new URL(url).origin;
    allPages[url] = {url:url, state:"queued", depth:0, host:startingHost};
    startingPage = allPages[url];
    crawlMore();
}

function crawlPage(page) {
    page.state = "crawling";
    
    console.log("Starting Crawl --> "+JSON.stringify(page));
    fetch(page.url)
        .then(response => response.text())
        .then(data => {
            onCrawlPageLoaded(page, data);
        })
        .catch(error => {
            console.error('Error:', error);
            page.state = "error";
            crawlMore();
        });
}

function onCrawlPageLoaded(page, data) {
    // Grab all the links on this page
    let links = getAllLinksOnPage(data);    
    
    // We want to count some of the following
    let counts = {roots:0, scripts:0, badProtocols:0, newValids:0, oldValids:0, interestings:0, domWindows:0};
    
    // Loop through each
    links.forEach(linkURL => {
        let absoluteURL = new URL(linkURL, page.url).href;
        let parsed = new URL(absoluteURL);
        let protocol = parsed.protocol.slice(0, -1);  // remove the colon

        if(protocol !== "http" && protocol !== "https") {
            counts.badProtocols++;
            return;
        }
            
        if(!allPages[absoluteURL]) {            
            // Increment the count
            counts.newValids++;
            
            // Build the page object
            let o = {};
            o.depth = page.depth + 1;
            o.url = absoluteURL;
            o.state = page.depth == settings.maxDepth ? "max_depth" : "queued";
            o.host = parsed.origin;
                                            
            // Get the file extension
            let extn = getFileExt(absoluteURL);
            
            // Is this an interesting extension?
            if(settings.interestingFileTypes.includes(extn)) { 
                o.isFile = true; 
                counts.interestings++; 
            }        
            
            // Save the page in our master array
            allPages[absoluteURL] = o;        
        } else {
            counts.oldValids++;
        }
    });
    
    // Debugging is good
    console.log("Page Crawled --> "+JSON.stringify({page:page, counts:counts}));
    
    // This page is crawled
    allPages[page.url].state = "crawled";        
    
    // Check to see if anything else needs to be crawled
    crawlMore();    
}

function crawlMore() {
    if(appState !== "crawling"){ return; }
    while(getURLsInTab("Crawling").length < settings.maxSimultaniousCrawls && getURLsInTab("Queued").length > 0) {
        crawlPage(getURLsInTab("Queued")[0]);
    }
}

function getURLsInTab(tab) {
    return Object.values(allPages).filter(o => {
        if(tab === "Queued" && o.state === "queued" && !o.isFile) return true;
        if(tab === "Crawling" && o.state === "crawling") return true;
        if(tab === "Crawled" && o.state === "crawled") return true;
        if(tab === "Files" && o.isFile) return true;
        if(tab === "Errors" && o.state === "error") return true;
        return false;
    });
}

function reset() {
    allPages = {};    
}

function getAllLinksOnPage(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = doc.querySelectorAll('a');
    return Array.from(links).map(link => link.href);
}

function getFileExt(url) {
    return url.split('.').pop().toLowerCase();
}
