var currentTab = "Queued";
var refreshNeeded = true;
var refreshTimerInterval = 2000;
var refreshTimer;
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('crawlButton').addEventListener('click', onCrawlClicked);
    document.getElementById('resetButton').addEventListener('click', onResetClicked);
    chrome.runtime.sendMessage({action: "popupReady"}, function(response) {
        if (chrome.runtime.lastError) {
            console.error('Error sending popupReady message:', chrome.runtime.lastError);
        } else {
            onLoad();
        }
    });
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "crawlStarted") {
        refreshPage();
        sendResponse({status: "Received"});
    }
    return true;
});

function onLoad() 
{	
    chrome.runtime.sendMessage({action: "getCrawlStartURL"}, function(response) {
        if (chrome.runtime.lastError) {
            console.error('Error communicating with background script:', chrome.runtime.lastError);
            return;
        }
        var u = response.crawlStartURL;
        if(!u || u=="") { 
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                document.getElementById("crawUrl").value = tabs[0].url;
            });
        }
        else { 
            document.getElementById("crawUrl").value = u;
        }
        refreshPage();
    });
}	

window.addEventListener('unload', function() 
{
    chrome.runtime.sendMessage({action: "getState"}, function(response) {
        if (chrome.runtime.lastError) {
            console.error('Error communicating with background script:', chrome.runtime.lastError);
            return;
        }
        
        const { appState, settings } = response;
        
        if(settings.pauseOnPopClose == 1 && appState == "crawling")
        {
            console.log("Popup Closing Pausing Crawl");
            chrome.runtime.sendMessage({action: "stopCrawl"});
        }
    });
});

function refreshPage() 
{
    // Start the timer again
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshPage, refreshTimerInterval);
        
    // First clear everything out
    document.getElementById("tabs").innerHTML = "";
    document.getElementById("urlsBeingSearched").innerHTML = "";
            
    // Get state from background
    chrome.runtime.sendMessage({action: "getState"}, function(response) {
        if (chrome.runtime.lastError) {
            console.error('Error communicating with background script:', chrome.runtime.lastError);
            return;
        }
        
        const { appState, allPages, settings } = response;
        
        // Build each tab
        ["Queued", "Crawling", "Crawled", "Files", "Errors"].forEach(function(tab) {
            var innerTxt = tab + " (" + getURLsInTab(allPages, tab).length + ")";
            var li = document.createElement("li");
            if (tab == currentTab) {
                li.textContent = innerTxt;
            } else {
                var a = document.createElement("a");
                a.href = "#";
                a.textContent = innerTxt;
                a.addEventListener('click', function(e) {
                    e.preventDefault();
                    openTab(tab);
                });
                li.appendChild(a);
            }
            document.getElementById("tabs").appendChild(li);
        });
    
        // Set button text
        var crawlButton = document.getElementById("crawlButton");
        if(appState=="stopped" && getURLsInTab(allPages, "Queued").length>0) {	
            crawlButton.value = "Resume";
        }
        else if(appState=="stopped" && getURLsInTab(allPages, "Queued").length==0) { 
            crawlButton.value = "Crawl";
        }
        else if(appState=="crawling") { 
            crawlButton.value = "Pause";
        }
        
        // Set enabledness
        var crawUrl = document.getElementById("crawUrl");
        var resetButton = document.getElementById("resetButton");
        if(appState=="crawling"){ 
            crawUrl.disabled = true; 
            resetButton.disabled = true;
        }
        else { 
            crawUrl.disabled = false; 
            resetButton.disabled = false;
        }
        
        if(currentTab=="X")
        {
            //$("#infovis").empty();
            //renderGraph();
        }
        else
        {		
            // List all the urls on this tab
            var urlList = document.getElementById("urlsBeingSearched");
            getURLsInTab(allPages, currentTab).forEach(function(url)
            {
                var li = document.createElement("li");
                var a = document.createElement("a");
                a.href = "#";
                a.textContent = url.url;
                a.addEventListener('click', function(e) {
                    e.preventDefault();
                    onLIURLClicked(url.url);
                });
                li.appendChild(a);
                urlList.appendChild(li);
            });
            
            Array.from(urlList.querySelectorAll("li:nth-child(even)")).forEach(function(li) {
                li.style.backgroundColor = "#f8f8f8";
            });
        }
        
        // If we are done then stop the crawl now
        if(appState=="crawling" && getURLsInTab(allPages, "Crawling").length==0 && getURLsInTab(allPages, "Queued").length==0){ 
            stopCrawl();
        }
    });
}

function getURLsInTab(allPages, tab) {
    return Object.values(allPages).filter(o => {
        if(tab === "Queued" && o.state === "queued" && !o.isFile) return true;
        if(tab === "Crawling" && o.state === "crawling") return true;
        if(tab === "Crawled" && o.state === "crawled") return true;
        if(tab === "Files" && o.isFile) return true;
        if(tab === "Errors" && o.state === "error") return true;
        return false;
    });
}

function onLIURLClicked(url)
{
    chrome.tabs.create({url:url, active:false});
}

function openTab(tab) 
{
     currentTab = tab;
     refreshPage();
}

function onCrawlClicked()
{
    chrome.runtime.sendMessage({action: "getState"}, function(response) {
        if (chrome.runtime.lastError) {
            console.error('Error communicating with background script:', chrome.runtime.lastError);
            return;
        }
        
        const { appState, allPages } = response;
        
        if(appState=="stopped" && getURLsInTab(allPages, "Queued").length>0)
        {
            console.log("Resuming Crawl");	
            chrome.runtime.sendMessage({action: "resumeCrawl"});
        }
        else if(appState=="stopped" && getURLsInTab(allPages, "Queued").length==0)
        {
            console.log("Beginning Crawl");
            chrome.runtime.sendMessage({action: "beginCrawl", url: document.getElementById("crawUrl").value});
        }
        else if(appState=="crawling")
        {
            console.log("Pausing Crawl");
            stopCrawl();		
        }
        refreshPage();
    });
}

function onResetClicked()
{
    stopCrawl();
    chrome.runtime.sendMessage({action: "reset"}, function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            document.getElementById("crawUrl").value = tabs[0].url;
        });
        refreshPage();
    });
}

function stopCrawl()
{
    chrome.runtime.sendMessage({action: "stopCrawl"}, function(response) {
        if (chrome.runtime.lastError) {
            console.error('Error communicating with background script:', chrome.runtime.lastError);
            return;
        }
        
        document.getElementById("crawUrl").disabled = false;
        document.getElementById("crawlButton").value = response.queuedUrls == 0 ? "Crawl" : "Resume";	
        
        refreshPage();
    });
}
