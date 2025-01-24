var currentTab = "Queued";
var refreshNeeded = true;
var refreshTimerInterval = 2000;
var refreshTimer;
var bgPage;

document.addEventListener('DOMContentLoaded', function() {
    bgPage = chrome.extension.getBackgroundPage();
    onLoad();
    document.getElementById('crawlButton').addEventListener('click', onCrawlClicked);
    document.getElementById('resetButton').addEventListener('click', onResetClicked);
});

function onLoad() 
{	
    var u = bgPage.crawlStartURL;
    if(!u || u=="") { 
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            document.getElementById("crawUrl").value = tabs[0].url;
        });
    }
    else { 
        document.getElementById("crawUrl").value = u;
    }
    refreshPage();
}	

window.addEventListener('unload', function() 
{
    if(bgPage.settings.pauseOnPopClose==1)
    {
        if(bgPage.appState=="crawling")
        {
            console.log("Popup Closing Pausing Crawl");
            stopCrawl();	
        }
    }
});

function refreshPage() 
{
    // Start the timer again
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshPage, refreshTimerInterval);
        
    // First clear everything out
    document.getElementById("tabs").innerHTML = "";
    document.getElementById("urlsBeingSearched").innerHTML = "";
            
    // Build each tab
    bgPage.tabs.forEach(function(tab)
    {
        var innerTxt = tab + " (" + bgPage.getURLsInTab(tab).length + ")";
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
    if(bgPage.appState=="stopped" && bgPage.getURLsInTab("Queued").length>0) {	
        crawlButton.value = "Resume";
    }
    else if(bgPage.appState=="stopped" && bgPage.getURLsInTab("Queued").length==0) { 
        crawlButton.value = "Crawl";
    }
    else if(bgPage.appState=="crawling") { 
        crawlButton.value = "Pause";
    }
    
    // Set enabledness
    var crawUrl = document.getElementById("crawUrl");
    var resetButton = document.getElementById("resetButton");
    if(bgPage.appState=="crawling"){ 
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
        bgPage.getURLsInTab(currentTab).forEach(function(url)
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
    if(bgPage.appState=="crawling" && bgPage.getURLsInTab("Crawling").length==0 && bgPage.getURLsInTab("Queued").length==0){ 
        stopCrawl();
    }
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
    if(bgPage.appState=="stopped" && bgPage.getURLsInTab("Queued").length>0)
    {
        console.log("Resuming Crawl");	
        bgPage.appState="crawling";
        bgPage.crawlMore();
    }
    else if(bgPage.appState=="stopped" && bgPage.getURLsInTab("Queued").length==0)
    {
        console.log("Beginning Crawl");
        bgPage.beginCrawl(document.getElementById("crawUrl").value);
    }
    else if(bgPage.appState=="crawling")
    {
        console.log("Pausing Crawl");
        stopCrawl();		
    }
    refreshPage();
}

function onResetClicked()
{
    stopCrawl();
    bgPage.reset();
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        document.getElementById("crawUrl").value = tabs[0].url;
    });
    refreshPage();
}

function stopCrawl()
{
    bgPage.appState = "stopped";
    document.getElementById("crawUrl").disabled = false;
    document.getElementById("crawlButton").value = bgPage.getURLsInTab("Queued").length==0 ? "Crawl" : "Resume";	
    
    for(var ref in bgPage.allPages) 
    {
        var o = bgPage.allPages[ref]
        if(o.state=="crawling")
        {			
            o.request.abort(); 
            delete o.request; 
            console.log("AJAX page load aborted -> "+JSON.stringify(o));
            o.state = "queued";
        }
    }
    
    refreshPage();
}
