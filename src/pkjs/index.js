
var DEBUG = false;

function fetchTrainData(from, to, label) {
  console.log("Fetching trains for " + label);

  var processResponse = function(response) {
    try {
      console.log("Parsing Response (Length: " + response.length + ")");
      
      // Check for SOAP Faults or Auth Errors first
      if (response.indexOf("Fault") !== -1 || response.indexOf("Unauthorized") !== -1) {
        console.log("CRITICAL ERROR IN XML: " + response.substring(0, 200));
        Pebble.sendAppMessage({
          "STATION_LABEL": label,
          "TRAIN_INFO": "XML ERROR",
          "TRAIN_TIME": "ERR",
          "NEXT_TRAIN": "Check Logs"
        });
        return;
      }

      var validTrains = [];
      // Robust regex to handle namespaced tags like <lt4:service>
      var serviceRegex = /<[^:>]*service>([\s\S]*?)<\/[^:>]*service>/g;
      var match;

      // 1. Improved Service Regex: Handles any prefix before 'service'
      var serviceRegex = /<[^>]*service>([\s\S]*?)<\/[^>]*service>/g;
      var match;
      var validTrains = [];

      while ((match = serviceRegex.exec(response)) !== null) {
        var sXml = match[1];
        
        // 2. Greedy Tag Matching: Looks for anything ending in 'std>' or 'etd>'
        // This captures <lt4:std>, <lt7:std>, or just <std>
        var stdMatch = sXml.match(/<[^>]*std>([^<]+)/);
        var etdMatch = sXml.match(/<[^>]*etd>([^<]+)/);
        
        if (stdMatch && etdMatch) {
          var std = stdMatch[1];
          var etd = etdMatch[1];
          
          if (etd.toLowerCase().indexOf("cancelled") !== -1) continue;
          
          // Logic: If ETD is a time (contains ':'), use it. Otherwise use Scheduled time.
          var liveTime = (etd.indexOf(":") !== -1) ? etd : std;
          
          validTrains.push({ 
            displayTime: liveTime, 
            scheduled: std, 
            status: etd 
          });
          
          if (validTrains.length >= 3) break;
        }
      }
      
      if (validTrains.length > 0) {
        var primary = validTrains[0];
        var statusText = (primary.status.toLowerCase() === "on time") ? "ON TIME" : 
                         (primary.delayed ? "DELAYED (" + primary.scheduled + ")" : primary.status.toUpperCase());

        var followers = [];
        for (var i = 1; i < validTrains.length; i++) {
          followers.push(validTrains[i].displayTime);
        }
        var nextString = (followers.length > 0) ? followers.join(", ") : "End of service";

        console.log("Success! Sending to watch: " + statusText);
        Pebble.sendAppMessage({
          "STATION_LABEL": label,
          "TRAIN_INFO": statusText,
          "TRAIN_TIME": primary.displayTime,
          "NEXT_TRAIN": nextString
        });
      } else {
        console.log("No valid trains found in XML.");
        Pebble.sendAppMessage({
          "STATION_LABEL": label,
          "TRAIN_INFO": "NO SERVICE", 
          "TRAIN_TIME": "--:--",
          "NEXT_TRAIN": "Check station"
        });
      }
    } catch (err) {
      console.log("JS CRASHED: " + err.message);
    }
  };

  var url = "https://lite.realtime.nationalrail.co.uk/OpenLDBWS/ldb11.asmx";

  // EXACT SOAP 1.2 XML from your successful Node sniff
  var xml = 
    '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" ' +
    'xmlns:typ="http://thalesgroup.com/RTTI/2013-11-28/Token/types" ' +
    'xmlns:ldb="http://thalesgroup.com/RTTI/2017-10-01/ldb/">' +
      '<soap:Header>' +
        '<typ:AccessToken>' +
          '<typ:TokenValue>' + myToken + '</typ:TokenValue>' +
        '</typ:AccessToken>' +
      '</soap:Header>' +
      '<soap:Body>' +
        '<ldb:GetDepartureBoardRequest>' +
          '<ldb:crs>' + from + '</ldb:crs>' +
          '<ldb:filterCrs>' + to + '</ldb:filterCrs>' +
          '<ldb:filterType>to</ldb:filterType>' +
        '</ldb:GetDepartureBoardRequest>' +
      '</soap:Body>' +
    '</soap:Envelope>';

  var xhr = new XMLHttpRequest();
  xhr.open("POST", url);

  // SOAP 1.2 Header Configuration
  xhr.setRequestHeader("Content-Type", 'application/soap+xml; charset=utf-8; action="http://thalesgroup.com/RTTI/2017-10-01/ldb/GetDepartureBoard"');

  xhr.onload = function() {
    console.log("FULL XML BODY: " + xhr.responseText.substring(0, 300));
    processResponse(xhr.responseText);
  };

  xhr.onerror = function() {
    Pebble.sendAppMessage({ "STATION_LABEL": label, "TRAIN_INFO": "OFFLINE", "TRAIN_TIME": "---", "NEXT_TRAIN": "No Internet" });
  };

  xhr.send(xml);
}

function parseNextTrain(xml) {
  // Logic: Check first service. If 'Cancelled', look at second service.
  // Darwin XML returns <lt4:std> (scheduled) and <lt4:etd> (estimated/status)
  // You'll use regex or a small DOM parser here to find <service> tags.
  // For brevity, assume helper returns {status: "On Time", time: "14:05"}
}

function getDistance(lat1, lon1, lat2, lon2) {
  var p = 0.017453292519943295;    // Math.PI / 180
  var c = Math.cos;
  var a = 0.5 - c((lat2 - lat1) * p)/2 + 
          c(lat1 * p) * c(lat2 * p) * (1 - c((lon2 - lon1) * p))/2;
  return 12742 * Math.asin(Math.sqrt(a)) * 0.621371; // Result in Miles
}

// Pebble.addEventListener("ready", function(e) {
//   console.log("JS is ready, waiting 1 second to mock...");
//   setTimeout(function() {
//     // Manually trigger the mock for testing
//     fetchTrainData("WGC", "KGX", "WGC > KGX"); 
//   }, 1000);
// });

var lastPosition = null;

// 1. Create a global function that handles the location logic
function processLocation(pos) {
  lastPosition = pos; // Save this for later refreshes
  
  var myLat = pos.coords.latitude;
  var myLon = pos.coords.longitude;
  console.log("Current Location: " + myLat + ", " + myLon);

  var distWGC = getDistance(myLat, myLon, 51.8010, -0.2050);
  var distKGX = getDistance(myLat, myLon, 51.5320, -0.1233);
  var distMOG = getDistance(myLat, myLon, 51.5185, -0.0881);
  
  console.log("Distances - WGC: " + distWGC.toFixed(2) + " mi, KGX: " + distKGX.toFixed(2) + " mi, MOG: " + distMOG.toFixed(2) + " mi");

  var limit = 10.0;
  var targetFrom = "";
  var targetTo = "WGC"; 
  var displayLabel = "";

  // Logic to find closest station
  if (distWGC < limit && distWGC < distKGX && distWGC < distMOG) {
    targetFrom = "WGC";
    targetTo = "KGX";
  } else if (distKGX < limit && distKGX <= distMOG) {
    targetFrom = "KGX";
    targetTo = "WGC";
  } else if (distMOG < limit) {
    targetFrom = "MOG";
    targetTo = "WGC";
  }

  if (targetFrom !== "") {
    var displayLabel = targetFrom + " > " + targetTo;
    console.log("Selected Route: " + displayLabel);
    fetchTrainData(targetFrom, targetTo, displayLabel);
  } else {
    console.log("No station within 10 miles.");
    Pebble.sendAppMessage({
      "STATION_LABEL": "Out of Range",
      "TRAIN_INFO": "Check GPS", 
      "TRAIN_TIME": "N/A",
      "NEXT_TRAIN": ""
    });
  }
}

// 2. Initial Ready Event
Pebble.addEventListener("ready", function(e) {
  console.log("PebbleKit JS Ready! Fetching location...");
  navigator.geolocation.getCurrentPosition(processLocation, function(err) {
    console.log("Location Error: " + err.message);
  }, { timeout: 15000, maximumAge: 60000 });
});

// 3. AppMessage Event (Manual Refresh)
Pebble.addEventListener('appmessage', function(e) {
  var dict = e.payload;
  
  if(dict['REFRESH']) {
    console.log("Manual refresh requested via Long Press!");
    
    if (lastPosition) {
      // Fast path: use the last known location
      processLocation(lastPosition);
    } else {
      // Fallback: get a new location if we don't have one yet
      navigator.geolocation.getCurrentPosition(processLocation, function(err) {
        console.log("Refresh Location Error: " + err.message);
      });
    }
  }
});