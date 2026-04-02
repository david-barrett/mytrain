var myToken = "e995265f-df60-4787-bafc-af5a433f9b22";

// function fetchTrainData(from, to, label) {
//   console.log("Fetching trains for " + label);
//   var url = "https://lite.realtime.nationalrail.co.uk/OpenLDBWS/ldb9.asmx";
//   var xml = 
//     '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:typ="http://thalesgroup.com/RTTI/2013-11-28/TokenHolder" xmlns:ldb="http://thalesgroup.com/RTTI/2017-10-01/ldb/">' +
//     '<soapenv:Header><typ:AccessToken><typ:TokenValue>' + myToken + '</typ:TokenValue></typ:AccessToken></soapenv:Header>' +
//     '<soapenv:Body><ldb:GetArrivalDepartureBoardRequest>' +
//     '<ldb:numRows>2</ldb:numRows><ldb:crs>' + from + '</ldb:crs><ldb:filterCrs>' + to + '</ldb:filterCrs><ldb:filterType>to</ldb:filterType>' +
//     '</ldb:GetArrivalDepartureBoardRequest></soapenv:Body></soapenv:Envelope>';

//   var xhr = new XMLHttpRequest();
//   xhr.open("POST", url);
//   xhr.setRequestHeader("Content-Type", "text/xml");
//   xhr.onload = function() {
//     var response = xhr.responseText;
//     console.log("Raw Response: " + response); // CRITICAL: Check this in CloudPebble Logs!

//     if (response.indexOf("Fault") !== -1 || response.indexOf("Unauthorized") !== -1) {
//         Pebble.sendAppMessage({"STATION_LABEL": label, "TRAIN_INFO": "TOKEN ERROR", "TRAIN_TIME": "401"});
//         return;
//     }

//     // This looks for anything between <service> and </service> tags regardless of namespace
//     var serviceRegex = /<[^:]*:service>([\s\S]*?)<\/[^:]*:service>/g;
//     var match;
//     var selectedService = null;

//     while ((match = serviceRegex.exec(response)) !== null) {
//         var serviceXml = match[1];
//         var stdMatch = serviceXml.match(/<[^:]*:std>([^<]+)/);
//         var etdMatch = serviceXml.match(/<[^:]*:etd>([^<]+)/);

//         if (stdMatch && etdMatch) {
//             var std = stdMatch[1];
//             var etd = etdMatch[1];

//             if (etd === "Cancelled") continue;

//             selectedService = { time: std, status: etd };
//             break; 
//         }
//     }

//     if (selectedService) {
//         // Normalize status to "ON TIME" or the specific delay/time
//         var statusText = (selectedService.status.toLowerCase() === "on time") ? "ON TIME" : selectedService.status.toUpperCase();
//         Pebble.sendAppMessage({
//             "STATION_LABEL": label,
//             "TRAIN_INFO": statusText,
//             "TRAIN_TIME": selectedService.time
//         });
//     } else {
//         // If we got here, the API worked but no trains were found in the next 2 hours
//         Pebble.sendAppMessage({
//             "STATION_LABEL": label,
//             "TRAIN_INFO": "NO DIRECT TRAINS",
//             "TRAIN_TIME": "N/A"
//         });
//     }
//   };
//   xhr.send(xml);
// }

function fetchTrainData(from, to, label) {
  console.log("Mocking data for: " + from + " to " + to);
  
  // Simulate a 1-second network delay
  setTimeout(function() {
    Pebble.sendAppMessage({
      "STATION_LABEL": label,
      "TRAIN_INFO": "On Time (Mock)",
      "TRAIN_TIME": "14:45"
    });
  }, 1000);
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


Pebble.addEventListener("ready", function(e) {
  console.log("PebbleKit JS Ready! Fetching location...");

  navigator.geolocation.getCurrentPosition(function(pos) {
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

    // Find the closest station within the 10-mile limit
    if (distWGC < limit && distWGC < distKGX && distWGC < distMOG) {
      targetFrom = "WGC";
      targetTo = "KGX";
      displayLabel = "WGC > KGX";
    } else if (distKGX < limit && distKGX <= distMOG) {
      targetFrom = "KGX";
      targetTo = "WGC";
      displayLabel = "KGX > WGC";
    } else if (distMOG < limit) {
      targetFrom = "MOG";
      targetTo = "WGC";
      displayLabel = "MOG > WGC";
    }

    if (targetFrom !== "") {
      console.log("Selected Route: " + displayLabel);
      fetchTrainData(targetFrom, targetTo, displayLabel);
    } else {
      console.log("No station within 10 miles.");
      Pebble.sendAppMessage({
        "STATION_LABEL": "Out of Range",
        "TRAIN_INFO": "Show", 
        "TRAIN_TIME": "N/A"
      });
    }
  }, function(err) {
    console.log("Location Error: " + err.message);
  }, { timeout: 15000, maximumAge: 60000 });
});